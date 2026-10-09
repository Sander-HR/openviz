import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const UPLOAD_URL = 'http://s3.local/uploads/u1/123-pic.png';
const THUMB_PATH = '/api/assets/thumbnail';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('uploadBlobToAsset (Sprint 3 asset delivery)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url === '/api/assets/upload-url') {
                return jsonResponse({ uploadUrl: UPLOAD_URL, key: 'uploads/u1/123-pic.png' });
            }
            if (url === UPLOAD_URL) {
                expect(init?.method).toBe('PUT');
                return new Response(null, { status: 200 });
            }
            if (url.startsWith(THUMB_PATH)) {
                const body = JSON.parse(String(init?.body)) as { variant?: string };
                return jsonResponse({ url: `/api/assets/${body.variant === 'preview' ? 'preview-token' : 'thumb-token'}` });
            }
            throw new Error(`unexpected fetch: ${url}`);
        });
        vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns full + thumb + preview refs and sends the immutable Cache-Control header on the PUT', async () => {
        const { uploadBlobToAsset } = await import('./assetUpload');
        const blob = new Blob(['x'], { type: 'image/png' });

        const result = await uploadBlobToAsset(blob, 'pic.png');

        expect(result.url).toBe('/api/assets/' + Buffer.from('uploads/u1/123-pic.png', 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
        expect(result.thumbnailUrl).toBe('/api/assets/thumb-token');
        expect(result.previewUrl).toBe('/api/assets/preview-token');

        const putCall = fetchMock.mock.calls.find((c) => String(c[0]) === UPLOAD_URL)!;
        const headers = (putCall[1]?.headers ?? {}) as Record<string, string>;
        expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');

        const variantCalls = fetchMock.mock.calls
            .filter((c) => String(c[0]).startsWith(THUMB_PATH))
            .map((c) => JSON.parse(String(c[1]?.body)) as { key: string; variant?: string });
        expect(variantCalls).toEqual([
            { key: 'uploads/u1/123-pic.png', variant: 'thumb' },
            { key: 'uploads/u1/123-pic.png', variant: 'preview' },
        ]);
    });

    it('skips both variants for non-image uploads', async () => {
        const { uploadBlobToAsset } = await import('./assetUpload');
        const blob = new Blob(['x'], { type: 'video/mp4' });

        const result = await uploadBlobToAsset(blob, 'clip.mp4');

        expect(result.thumbnailUrl).toBeNull();
        expect(result.previewUrl).toBeNull();
        expect(fetchMock.mock.calls.some((c) => String(c[0]).startsWith(THUMB_PATH))).toBe(false);
    });

    it('still returns the full url when thumbnail generation fails', async () => {
        fetchMock.mockImplementationOnce(async () => jsonResponse({ uploadUrl: UPLOAD_URL, key: 'uploads/u1/123-pic.png' }));
        fetchMock.mockImplementationOnce(async () => new Response(null, { status: 200 }));
        fetchMock.mockImplementationOnce(async () => new Response('boom', { status: 500 }));

        const { uploadBlobToAsset } = await import('./assetUpload');
        const result = await uploadBlobToAsset(new Blob(['x'], { type: 'image/png' }), 'pic.png');

        expect(result.thumbnailUrl).toBeNull();
        expect(result.url).toContain('/api/assets/');
    });

    it('throws AssetStoreUnavailableError when the asset store is unavailable (no base64 fallback)', async () => {
        fetchMock.mockImplementationOnce(async () => new Response('nope', { status: 503 }));

        const { uploadBlobToAsset, AssetStoreUnavailableError } = await import('./assetUpload');
        await expect(uploadBlobToAsset(new Blob(['x'], { type: 'image/png' }), 'pic.png'))
            .rejects.toBeInstanceOf(AssetStoreUnavailableError);
    });
});

describe('reportAssetUploadFailure (refs-only contract error surfacing)', () => {
    it('logs an actionable message and emits the DOM event (never throws)', async () => {
        const { reportAssetUploadFailure, ASSET_UPLOAD_FAILED_EVENT, AssetStoreUnavailableError } = await import('./assetUpload');
        const seen: CustomEvent[] = [];
        const listener = ((event: Event) => { seen.push(event as CustomEvent); }) as EventListener;
        window.addEventListener(ASSET_UPLOAD_FAILED_EVENT, listener);
        const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
            reportAssetUploadFailure(new AssetStoreUnavailableError('boom'));
            expect(seen).toHaveLength(1);
            expect((seen[0].detail as { message: string }).message).toBe('boom');
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('docker compose up s3'));
        } finally {
            window.removeEventListener(ASSET_UPLOAD_FAILED_EVENT, listener);
            logSpy.mockRestore();
        }
    });
});


describe('uploadCanvasThumbnail (Studio exit → durable ref)', () => {
    const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const UPLOAD_URL = 'http://s3.local/uploads/u1/123-canvas.png';

    beforeEach(() => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.startsWith('data:')) {
                return new Response(new Blob(['x'], { type: 'image/png' }), { status: 200 });
            }
            if (url === '/api/assets/upload-url') {
                return new Response(JSON.stringify({ uploadUrl: UPLOAD_URL, key: 'uploads/u1/123-canvas.png' }), { status: 200 });
            }
            if (url === UPLOAD_URL) {
                expect(init?.method).toBe('PUT');
                return new Response(null, { status: 200 });
            }
            if (url.startsWith('/api/assets/thumbnail')) {
                return new Response(JSON.stringify({ url: '/api/assets/variant-token' }), { status: 200 });
            }
            throw new Error(`unexpected fetch: ${url}`);
        });
        vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns null for empty or non-image input (never throws)', async () => {
        const { uploadCanvasThumbnail } = await import('./assetUpload');
        expect(await uploadCanvasThumbnail('')).toBeNull();
        expect(await uploadCanvasThumbnail('not-a-data-url')).toBeNull();
    });

    it('returns a durable ref when the asset store accepts the canvas', async () => {
        const { uploadCanvasThumbnail } = await import('./assetUpload');
        const ref = await uploadCanvasThumbnail(TINY_PNG);
        expect(ref).toMatch(/^\/api\/assets\//);
    });

    it('returns null (keeps the previous thumbnail) when the asset store is down', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
            if (String(input).startsWith('data:')) {
                return new Response(new Blob(['x'], { type: 'image/png' }), { status: 200 });
            }
            return new Response('nope', { status: 503 });
        });

        const { uploadCanvasThumbnail } = await import('./assetUpload');
        expect(await uploadCanvasThumbnail(TINY_PNG)).toBeNull();
    });
});

describe('video poster capture (3-tier pipeline)', () => {
    it('captureVideoPoster returns null when video decode APIs are unavailable (never throws)', async () => {
        const { captureVideoPoster } = await import('./assetUpload');
        // jsdom videos never fire loadeddata — the timeout guard must yield null.
        expect(await captureVideoPoster('/api/assets/video-token', { timeoutMs: 25 })).toBeNull();
    });

    it('uploadVideoPoster returns null without throwing when capture fails (poster is optional)', async () => {
        const { uploadVideoPoster } = await import('./assetUpload');
        expect(await uploadVideoPoster('/api/assets/video-token', { timeoutMs: 25 })).toBeNull();
    });
});
