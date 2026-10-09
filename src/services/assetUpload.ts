import { buildAssetUrl } from '@/lib/services/assetUrl';

/** Cache policy matching the server-signed upload URL (see s3.ts). */
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface UploadedAsset {
    /** Durable reference for full-resolution use (`/api/assets/<token>` or data-URL fallback). */
    url: string;
    /** ≤512px WebP variant for dashboard cards / workbench first paint; `null` when unavailable (non-image, already small, generation failure). */
    thumbnailUrl: string | null;
    /** ≤1024px WebP variant — the background-loaded higher quality tier; `null` when unavailable. */
    previewUrl: string | null;
}

export type AssetVariant = 'thumb' | 'preview';

/**
 * Raised when the S3-backed asset store is unavailable (not configured, or the
 * presign/PUT round-trip failed). Scene data must never contain base64, so
 * uploads fail loudly instead of degrading to inline data URLs — callers catch
 * this and surface {@link reportAssetUploadFailure} without creating a node.
 */
export class AssetStoreUnavailableError extends Error {
    readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'AssetStoreUnavailableError';
        this.cause = cause;
    }
}

/** DOM event name emitted for failed asset uploads (UI hook for toasts). */
export const ASSET_UPLOAD_FAILED_EVENT = 'openviz:asset-upload-failed';

/**
 * Surfaces an asset-upload failure: logs an actionable message and emits a
 * window CustomEvent so UI layers can render a toast. Never throws.
 */
export function reportAssetUploadFailure(error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
        `[assets] upload failed — asset storage unavailable (start it with: docker compose up s3). ${detail}`,
    );
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(ASSET_UPLOAD_FAILED_EVENT, { detail: { message: detail } }));
    }
}

async function requestVariant(key: string, variant: AssetVariant): Promise<string | null> {
    try {
        const res = await fetch('/api/assets/thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, variant }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as { url?: string | null };
        return json.url ?? null;
    } catch {
        return null; // variants are a progressive enhancement, never blocking
    }
}

export interface CaptureVideoPosterOptions {
    /** Max wait for video data before giving up (default 8000ms). */
    timeoutMs?: number;
}

/**
 * Captures the first frame of a video as a ≤512px WebP blob (3-tier pipeline).
 * Drives the static poster on video nodes so the workbench never downloads the
 * full video just to show a preview. Returns null (never throws) when the
 * video cannot be decoded, times out, or canvas APIs are missing — the node
 * then falls back to a placeholder tile.
 */
export async function captureVideoPoster(videoUrl: string, options: CaptureVideoPosterOptions = {}): Promise<Blob | null> {
    if (typeof document === 'undefined') return null;
    const timeoutMs = options.timeoutMs ?? 8000;

    const video = document.createElement('video');
    try {
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = videoUrl;

        await waitForMediaEvent(video, ['loadeddata', 'canplay'], timeoutMs);
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
        try {
            video.currentTime = Math.min(0.1, duration / 2);
            await waitForMediaEvent(video, ['seeked'], timeoutMs);
        } catch {
            // Seek unsupported — use whatever frame is already available.
        }

        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return null;

        const scale = Math.min(1, 512 / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    } catch {
        return null; // decode failure / timeout / tainted canvas — no poster
    } finally {
        video.removeAttribute('src');
        video.load(); // release the media resource
    }
}

function waitForMediaEvent(media: HTMLMediaElement, successEvents: readonly string[], timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => settle(() => reject(new Error('media event timed out'))), timeoutMs);
        const onSettle = (outcome: () => void): void => settle(outcome);
        const settle = (outcome: () => void): void => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            for (const eventName of [...successEvents, 'error']) media.removeEventListener(eventName, onEvent);
            outcome();
        };
        const onEvent = (): void => onSettle(resolve);
        for (const eventName of successEvents) media.addEventListener(eventName, onEvent, { once: true });
        media.addEventListener('error', () => onSettle(() => reject(new Error('media error'))), { once: true });
    });
}

/**
 * Uploads a flattened Studio canvas (`stage.toDataURL()` PNG) through the
 * normal asset pipeline and returns its durable ref (3-tier pipeline). Returns
 * `null` on failure (empty input, S3 down) — the caller keeps the previous
 * thumbnail and never blocks exiting Studio.
 */
export async function uploadCanvasThumbnail(dataUrl: string): Promise<string | null> {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
    try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const asset = await uploadBlobToAsset(blob, 'canvas-thumbnail');
        return asset.url;
    } catch {
        return null; // S3 down — keep the previous thumbnail
    }
}

/**
 * Captures a poster frame from a generated video and uploads it through the
 * normal asset pipeline, returning a durable ref (or `null`). Poster failure
 * never fails the caller — video nodes fall back to a placeholder tile.
 */
export async function uploadVideoPoster(videoUrl: string, options?: CaptureVideoPosterOptions): Promise<string | null> {
    const blob = await captureVideoPoster(videoUrl, options);
    if (!blob) return null;
    try {
        const asset = await uploadBlobToAsset(blob, 'poster.webp');
        return asset.url;
    } catch {
        return null; // asset store down — no poster, the video itself is already stored
    }
}

/**
 * Upload an image/video blob to the S3-backed asset store and return durable
 * reference URLs suitable for storing in node state. The bytes live in S3;
 * only the short refs are persisted/synced, which keeps `/api/projects/[id]`
 * responses and collab scene seeds small.
 *
 * Image uploads additionally generate both WebP variants server-side (3-tier
 * pipeline): ≤512px for first paint and ≤1024px for the background-loaded
 * higher quality tier, so canvas + dashboard previews never download full
 * resolution.
 *
 * Throws {@link AssetStoreUnavailableError} when the asset store is
 * unavailable — scene data holds S3 refs only, never base64 (refs-only
 * contract). Callers catch it and surface {@link reportAssetUploadFailure}.
 */
export async function uploadBlobToAsset(blob: Blob, filename?: string): Promise<UploadedAsset> {
    const contentType = blob.type || 'application/octet-stream';

    try {
        const res = await fetch('/api/assets/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: filename ?? 'asset', contentType }),
        });

        if (!res.ok) throw new Error(`upload-url request failed (${res.status})`);

        const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };
        if (!uploadUrl || !key) throw new Error('upload-url response missing fields');

        // Cache-Control is signed into the presigned URL — S3 stores it as
        // object metadata so browsers cache the bytes forever (immutable).
        const putRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType, 'Cache-Control': IMMUTABLE_CACHE_CONTROL },
            body: blob,
        });
        if (!putRes.ok) throw new Error(`asset upload failed (${putRes.status})`);

        const url = buildAssetUrl(key);
        if (!contentType.startsWith('image/')) {
            return { url, thumbnailUrl: null, previewUrl: null };
        }
        const [thumbnailUrl, previewUrl] = await Promise.all([
            requestVariant(key, 'thumb'),
            requestVariant(key, 'preview'),
        ]);
        return { url, thumbnailUrl, previewUrl };
    } catch (error) {
        // Refs-only contract: no base64 fallback. Fail loudly so callers can
        // surface the problem and skip node creation.
        throw new AssetStoreUnavailableError(
            'Asset store unavailable — upload aborted (no inline base64 fallback).',
            { cause: error },
        );
    }
}
