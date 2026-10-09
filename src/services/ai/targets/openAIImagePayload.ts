/**
 * Feature 012 — T006 native image payload & I/O helpers (split from
 * openAIImageTarget.ts to keep both files within the ≤300-line budget).
 *
 * Builds the `POST /api/inference/images/generate` body from a workflow
 * request. Capability-tolerant: optional fields are emitted when present and
 * dropped wholesale when the endpoint rejects them (R4). Runtime internals
 * (guidance_2, quantization, offload, memory mode, attention backend, caches)
 * are never part of this surface (FR-002).
 */

import type { GenerationOutput } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

export interface NativeImagePayloadOptions {
    model: string;
    width: number;
    height: number;
}

/** Optional native fields that older endpoints may reject (R4). */
export const NATIVE_OPTIONAL_FIELDS = [
    'negative_prompt',
    'strength',
    'seeds',
    'reference_resolution',
] as const;

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

/**
 * Normalize an input image to a data URL. `https:`/`blob:` sources are
 * downloaded without forwarding the image API's Authorization header — the
 * source belongs to the user's project or a third-party host.
 */
export async function normalizeInputImage(input: string | undefined, fetcher: Fetcher): Promise<string | undefined> {
    if (!input?.trim()) return undefined;
    const value = input.trim();

    if (value.startsWith('data:')) {
        const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
        if (!match || match[2].length % 4 === 1) {
            throw new Error('The source image is not valid base64 image data.');
        }
        return value;
    }

    if (/^(?:https?:|blob:)/i.test(value)) {
        const response = await fetcher(value);
        if (!response.ok) throw new Error(`Source image download failed (${response.status}).`);
        const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'image/png';
        if (!contentType.startsWith('image/')) throw new Error('The source image URL did not return an image.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        return `data:${contentType};base64,${bytesToBase64(bytes)}`;
    }

    throw new Error('The source image must be a data URL or an image URL.');
}

function parseSize(size: string | undefined, width: number, height: number): { width: number; height: number } {
    const match = size?.match(/^(\d+)x(\d+)$/);
    return match ? { width: Number(match[1]), height: Number(match[2]) } : { width, height };
}

export function normalizeNativeImageDimensions(
    dimensions: { width: number; height: number },
    model: string,
): { width: number; height: number } {
    // Qwen Image 2.1 requires both dimensions to be divisible by 32.
    if (/qwen[-_ ]image[-_ ]2\.1/i.test(model)) {
        return {
            width: Math.max(32, Math.round(dimensions.width / 32) * 32),
            height: Math.max(32, Math.round(dimensions.height / 32) * 32),
        };
    }
    return dimensions;
}

/**
 * Build the native image-generation body. `droppedFields` are optional fields
 * a previous attempt had the endpoint reject; they stay out of the retry.
 */
export function buildNativeImagePayload(
    request: ProductWorkflowRequest,
    options: NativeImagePayloadOptions,
    droppedFields: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        prompt: request.prompt,
        model: options.model,
        width: options.width,
        height: options.height,
        batch_size: request.batchSize,
    };

    if (request.initImage) payload.init_image = request.initImage;
    if (request.maskImage) payload.mask_image = request.maskImage;
    if (request.referenceImages && request.referenceImages.length > 0) {
        payload.reference_images = request.referenceImages;
    }
    payload.workflow = request.imageWorkflow ?? (request.referenceImages && request.referenceImages.length > 0 ? 'reference' : 'edit');

    if (request.negativePrompt && !droppedFields.has('negative_prompt')) payload.negative_prompt = request.negativePrompt;
    if (request.strength !== undefined && !droppedFields.has('strength')) payload.strength = request.strength;
    // Per-output seeds: one per batch output, unique within the batch (FR-014).
    if (request.seeds && request.seeds.length > 0 && !droppedFields.has('seeds')) payload.seeds = request.seeds;
    else if (request.seed !== undefined) payload.seed = request.seed;
    if (request.referenceResolution && !droppedFields.has('reference_resolution')) {
        payload.reference_resolution = request.referenceResolution;
    }

    return payload;
}

/**
 * Extract optional-field names an endpoint rejected from its error message.
 * Only known optional fields are ever dropped — unknown fields surface as-is.
 */
export function extractRejectedFields(errorMessage: string): Set<string> {
    const dropped = new Set<string>();
    for (const field of NATIVE_OPTIONAL_FIELDS) {
        if (new RegExp(`\\b${field}\\b`, 'i').test(errorMessage)) dropped.add(field);
    }
    return dropped;
}

function asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

export function parseModels(body: unknown): string[] {
    const record = asRecord(body);
    const data = Array.isArray(record.data) ? record.data : [];
    return data.flatMap((entry) => {
        if (typeof entry === 'string') return [entry];
        const model = asRecord(entry);
        return typeof model.id === 'string' ? [model.id] : [];
    });
}

export function parseImageOutputs(body: unknown): GenerationOutput[] {
    const data = asRecord(body).data;
    if (!Array.isArray(data)) return [];
    return data.flatMap((entry, index) => {
        const record = asRecord(entry);
        if (typeof record.url === 'string' && /^https?:\/\//.test(record.url)) {
            return [{ url: record.url, index, contentType: 'image/*' }];
        }

        // OpenAI's Images API commonly returns base64 image data instead of a
        // hosted URL. Convert it to a browser-readable data URL so the rest of
        // the render pipeline can treat both response formats identically.
        if (typeof record.b64_json === 'string' && record.b64_json.length > 0) {
            const contentType = typeof record.mime_type === 'string' && record.mime_type.startsWith('image/')
                ? record.mime_type
                : 'image/png';
            return [{ url: `data:${contentType};base64,${record.b64_json}`, index, contentType }];
        }

        return [];
    });
}

export function endpointRoot(endpoint: string): string {
    return endpoint.replace(/\/v\d+$/i, '');
}

function resolveNativeImageUrl(endpoint: string, url: string): string {
    const normalizedUrl = url.replace(/\/$/, '');
    const galleryPath = normalizedUrl.match(/^(\/api\/inference\/images\/gallery\/[^/]+)(?:\/file)?$/);
    const resolvedPath = galleryPath ? `${galleryPath[1]}/file` : normalizedUrl;
    if (/^(?:data:|https?:\/\/)/.test(resolvedPath)) return resolvedPath;
    return `${endpointRoot(endpoint)}${resolvedPath.startsWith('/') ? '' : '/'}${resolvedPath}`;
}

export function parseNativeImageOutputs(body: unknown, endpoint: string): GenerationOutput[] {
    const images = asRecord(body).images;
    if (!Array.isArray(images)) return [];
    return images.flatMap((entry, index) => {
        const record = asRecord(entry);
        return typeof record.url === 'string'
            ? [{ url: resolveNativeImageUrl(endpoint, record.url), index, contentType: 'image/png' }]
            : [];
    });
}

export function parseRequestDimensions(
    size: string | undefined,
    request: ProductWorkflowRequest,
    model: string,
): { width: number; height: number } {
    return normalizeNativeImageDimensions(parseSize(size, request.width, request.height), model);
}
