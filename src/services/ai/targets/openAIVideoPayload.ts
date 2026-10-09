/**
 * Feature 012 — T028 video payload & I/O helpers (split from
 * openAIVideoTarget.ts to keep the target within the ≤300-line budget).
 *
 * Builds the native `POST /api/inference/video/generate` and OpenAI-compatible
 * `POST /v1/videos` bodies from a workflow request. Capability-tolerant:
 * optional fields are emitted when present and dropped wholesale when the
 * endpoint rejects them (R4). Runtime internals (guidance_2, quantization,
 * offload, memory mode, attention backend, caches) are never part of this
 * surface (FR-002).
 */

import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

type JsonRecord = Record<string, unknown>;

/** Optional native video fields that older endpoints may reject (R4). */
export const NATIVE_VIDEO_OPTIONAL_FIELDS = ['negative_prompt', 'seed'] as const;

export function asVideoRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

export async function readVideoJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { error: text };
    }
}

export function videoErrorMessage(body: unknown, fallback: string): string {
    const record = asVideoRecord(body);
    const nested = asVideoRecord(record.error);
    if (typeof nested.message === 'string') return nested.message;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
    // FastAPI-style validation errors (400/422) surface in `detail`.
    if (typeof record.detail === 'string') return record.detail;
    return fallback;
}

export interface OpenAIVideoAuthOptions {
    apiKey?: string;
    keyless?: boolean;
}

export function videoHeaders(options: OpenAIVideoAuthOptions, includeJson = false): HeadersInit {
    let authorization: string | undefined;
    if (!options.keyless) {
        if (!options.apiKey?.trim()) throw new Error('An API key is required unless keyless API access is enabled.');
        authorization = `Bearer ${options.apiKey.trim()}`;
    }
    return {
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
    };
}

/** Build the native Unsloth video-generation body. `droppedFields` stay out of a retry (R4). */
export function buildNativeVideoPayload(request: ProductWorkflowRequest, droppedFields?: ReadonlySet<string>): Record<string, unknown> {
    const payload: Record<string, unknown> = { prompt: request.prompt };
    if (request.width > 0) payload.width = request.width;
    if (request.height > 0) payload.height = request.height;
    if (request.numFrames && request.numFrames > 0) payload.num_frames = request.numFrames;
    if (request.fps && request.fps > 0) payload.fps = request.fps;
    if (request.initImage) payload.first_frame = request.initImage;
    if (request.endImage) payload.last_frame = request.endImage;
    const optional: Array<[string, unknown]> = [
        ['negative_prompt', request.negativePrompt],
        ['seed', request.seed],
    ];
    for (const [key, value] of optional) {
        if (value !== undefined && !droppedFields?.has(key)) payload[key] = value;
    }
    return payload;
}

/** Build the OpenAI-compatible video body; duration is derived from frames/fps. */
export function buildOpenAIVideoPayload(request: ProductWorkflowRequest, model: string): Record<string, unknown> {
    const payload: Record<string, unknown> = { model, prompt: request.prompt };
    if (request.width > 0 && request.height > 0) payload.size = `${request.width}x${request.height}`;
    if (request.numFrames && request.fps && request.fps > 0) {
        const seconds = Math.round((request.numFrames / request.fps) * 10) / 10;
        if (seconds > 0) payload.seconds = String(seconds);
    }
    return payload;
}

/** Parse a `VideoJob` status response into its normalized fields. */
export function parseVideoJob(body: unknown): { videoId?: string; status?: string; progress?: number; error?: string } {
    const job = asVideoRecord(body);
    const result: { videoId?: string; status?: string; progress?: number; error?: string } = {};
    if (typeof job.id === 'string' && job.id.length > 0) result.videoId = job.id;
    if (typeof job.status === 'string') result.status = job.status;
    if (typeof job.progress === 'number' && Number.isFinite(job.progress)) result.progress = job.progress;
    const error = asVideoRecord(job.error);
    if (typeof error.message === 'string') result.error = error.message;
    return result;
}
