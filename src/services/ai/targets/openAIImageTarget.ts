/**
 * OpenAI-compatible image generation target (Unsloth endpoint).
 *
 * Feature 012 (T006): payload building and step-level progress polling live
 * in `openAIImagePayload.ts` / `openAIImageProgress.ts`. The native route
 * passes through `negative_prompt`, `strength`, per-output `seeds`, and
 * `reference_resolution`; fields the endpoint rejects are dropped on a single
 * retry (capability-tolerant, R4). Runtime internals are never emitted
 * (FR-002).
 */

import type {
    ExecutionTargetAdapter,
    GenerationOutput,
    NormalizedJobStatus,
    PreflightResult,
    SubmittedJob,
    TargetCapabilities,
    TargetHealth,
} from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { AssetStoreUnavailableError, uploadBlobToAsset } from '@/services/assetUpload';
import {
    NATIVE_OPTIONAL_FIELDS,
    buildNativeImagePayload,
    endpointRoot,
    normalizeInputImage,
    parseImageOutputs,
    parseModels,
    parseNativeImageOutputs,
    parseRequestDimensions,
} from './openAIImagePayload';
import { createNativeProgressPoller, type NativeProgressState } from './openAIImageProgress';

type Fetcher = typeof fetch;
type JsonRecord = Record<string, unknown>;

export interface OpenAIImageTargetOptions {
    id: string;
    endpoint: string;
    model: string;
    apiKey?: string;
    keyless?: boolean;
    size?: string;
    /** Capability probe result: the endpoint exposes generate-progress (SC-009). */
    progressTelemetry?: boolean;
    fetcher?: Fetcher;
}

function asRecord(value: unknown): JsonRecord {
    return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

function normalizeEndpoint(endpoint: string): string {
    return endpoint.trim().replace(/\/$/, '');
}

async function readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return { error: text };
    }
}

function errorMessage(body: unknown, fallback: string): string {
    const record = asRecord(body);
    const nested = asRecord(record.error);
    if (typeof nested.message === 'string') return nested.message;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
    // FastAPI-style validation errors (400/422) surface in `detail`.
    if (typeof record.detail === 'string') return record.detail;
    return fallback;
}

function authorizationHeader(options: OpenAIImageTargetOptions): string | undefined {
    if (options.keyless) return undefined;
    if (!options.apiKey?.trim()) throw new Error('An API key is required unless keyless API access is enabled.');
    return `Bearer ${options.apiKey.trim()}`;
}

function headers(options: OpenAIImageTargetOptions, includeJson = false): HeadersInit {
    const authorization = authorizationHeader(options);
    return {
        ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
    };
}

/**
 * Re-hosts every rendered image to the S3-backed asset store so scene data
 * holds durable refs only (refs-only contract). Handles both http(s) outputs
 * and inline provider data URLs. A storage failure is rethrown as a distinct,
 * recoverable error — the render can be re-run seed-locked (SC-008).
 */
async function materializeNativeImageOutputs(
    outputs: GenerationOutput[],
    options: OpenAIImageTargetOptions,
    fetcher: Fetcher,
): Promise<GenerationOutput[]> {
    return Promise.all(outputs.map(async (output) => {
        let blob: Blob;
        if (/^https?:\/\//.test(output.url)) {
            const response = await fetcher(output.url, { headers: headers(options) });
            if (!response.ok) {
                throw new Error(`Rendered image download failed (${response.status}).`);
            }
            blob = await response.blob();
        } else if (output.url.startsWith('data:image/')) {
            // Provider returned an inline data URL — decode and re-host instead
            // of persisting base64 into scene data. Decoding is local work, so
            // it uses global fetch rather than the endpoint-bound fetcher.
            const response = await fetch(output.url);
            if (!response.ok) {
                throw new Error('Rendered image decode failed.');
            }
            blob = await response.blob();
        } else {
            return output; // non-image or unknown scheme — leave untouched
        }

        try {
            const { url } = await uploadBlobToAsset(blob, `render-${output.assetId ?? output.index}.png`);
            return { ...output, url };
        } catch (error) {
            if (error instanceof AssetStoreUnavailableError) {
                const wrapped: Error & { cause?: unknown } = new Error(
                    'Render finished but asset storage is unavailable — the image was not saved. Start S3 (docker compose up s3) and re-run with the same seed.',
                );
                wrapped.cause = error;
                throw wrapped;
            }
            throw error;
        }
    }));
}

export function createOpenAIImageTarget(options: OpenAIImageTargetOptions): ExecutionTargetAdapter {
    const endpoint = normalizeEndpoint(options.endpoint);
    const fetcher = options.fetcher ?? fetch;
    let cachedModels: string[] = [];
    let cachedOutputs: GenerationOutput[] = [];
    const progressState: NativeProgressState = {
        inFlight: false,
        telemetry: Boolean(options.progressTelemetry),
        lastFraction: null,
    };
    const progressPoller = createNativeProgressPoller(progressState, endpointRoot(endpoint), fetcher);

    async function listModels(): Promise<string[]> {
        const response = await fetcher(`${endpoint}/models`, { headers: headers(options) });
        const body = await readJson(response);
        if (!response.ok) {
            const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
            throw new Error(`${errorMessage(body, `Model discovery failed (${response.status}).`)}${suffix}`);
        }
        cachedModels = parseModels(body);
        if (cachedModels.length === 0) throw new Error('The image API returned no usable models.');
        return cachedModels;
    }

    async function postJson(url: string, payload: Record<string, unknown>): Promise<Response> {
        return fetcher(url, { method: 'POST', headers: headers(options, true), body: JSON.stringify(payload) });
    }

    async function submitNative(request: ProductWorkflowRequest): Promise<void> {
        const dimensions = parseRequestDimensions(options.size, request, options.model);
        const baseOptions = { model: options.model, width: dimensions.width, height: dimensions.height };
        const targetUrl = `${endpointRoot(endpoint)}/api/inference/images/generate`;
        const hadOptionalFields = Boolean(
            request.negativePrompt
            || request.strength !== undefined
            || (request.seeds?.length ?? 0) > 0
            || request.referenceResolution,
        );

        let response = await postJson(targetUrl, buildNativeImagePayload(request, baseOptions));
        if (!response.ok && hadOptionalFields && (response.status === 400 || response.status === 422)) {
            // Capability-tolerant retry: drop the optional fields an older
            // endpoint may not support; never fatal (R4).
            response = await postJson(targetUrl, buildNativeImagePayload(request, baseOptions, new Set(NATIVE_OPTIONAL_FIELDS)));
        }

        const body = await readJson(response);
        if (!response.ok) {
            const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
            throw new Error(`${errorMessage(body, `Image generation failed (${response.status}).`)}${suffix}`);
        }

        const parsedOutputs = parseNativeImageOutputs(body, endpoint);
        cachedOutputs = request.initImage
            ? await materializeNativeImageOutputs(parsedOutputs, options, fetcher)
            : parsedOutputs;
        if (cachedOutputs.length === 0) throw new Error('The image API returned no usable image URLs.');
    }

    return {
        async health(): Promise<TargetHealth> {
            try {
                const models = await listModels();
                return { targetId: options.id, status: 'ready', capabilities: await this.capabilities(), message: models.join(', ') };
            } catch (error) {
                return {
                    targetId: options.id,
                    status: error instanceof Error && /401|403|API key|Authorization/i.test(error.message) ? 'auth-required' : 'unavailable',
                    message: error instanceof Error ? error.message : 'Image API is unavailable.',
                    capabilities: null,
                };
            }
        },

        async capabilities(): Promise<TargetCapabilities> {
            return {
                checkedAt: Date.now(),
                devices: [],
                customNodes: [],
                availableModels: cachedModels,
                availableNodeTypes: [],
                supportedPrecisions: [],
                supportedWorkflows: ['image-generation', 'image-edit'],
            };
        },

        async preflight(request: ProductWorkflowRequest): Promise<PreflightResult> {
            if (!options.model.trim()) {
                return { ready: false, status: 'incompatible', issues: [{ code: 'missing-model', message: 'Select an image API model before generating.' }] };
            }
            if (!request.prompt.trim()) {
                return { ready: false, status: 'incompatible', issues: [{ code: 'missing-prompt', message: 'Enter a prompt before generating.' }] };
            }
            return { ready: true, status: 'ready', issues: [], selectedTier: 'hosted-auto', explanation: 'Synchronous OpenAI-compatible image generation.' };
        },

        async submit(request: ProductWorkflowRequest): Promise<SubmittedJob> {
            const initImage = await normalizeInputImage(request.initImage, fetcher);
            const referenceImages = await Promise.all(
                (request.referenceImages ?? [])
                    .filter((image) => image.trim().length > 0)
                    .map((image) => normalizeInputImage(image, fetcher)),
            ).then((images) => images.filter((image): image is string => Boolean(image)));

            // Rebind the normalized inputs so the native payload carries data URLs.
            const nativeRequest: ProductWorkflowRequest = {
                ...request,
                ...(initImage ? { initImage } : {}),
                ...(referenceImages.length > 0 ? { referenceImages } : {}),
            };

            cachedOutputs = [];
            if (!initImage && referenceImages.length === 0 && !request.maskImage) {
                // Plain OpenAI-compatible generation — no native conditions.
                const response = await postJson(`${endpoint}/images/generations`, {
                    model: options.model,
                    prompt: request.prompt,
                    n: request.batchSize,
                    size: options.size ?? `${request.width}x${request.height}`,
                });
                const body = await readJson(response);
                if (!response.ok) {
                    const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
                    throw new Error(`${errorMessage(body, `Image generation failed (${response.status}).`)}${suffix}`);
                }
                cachedOutputs = parseImageOutputs(body);
                if (cachedOutputs.length === 0) throw new Error('The image API returned no usable image URLs.');
            } else {
                progressState.inFlight = true;
                progressPoller.start();
                try {
                    await submitNative(nativeRequest);
                } finally {
                    progressState.inFlight = false;
                    progressPoller.stop();
                }
            }

            return { jobId: `image-api-${Date.now()}`, targetId: options.id };
        },

        async getStatus(jobId: string): Promise<NormalizedJobStatus> {
            if (progressState.inFlight) {
                return { jobId, status: 'running', progress: progressPoller.getProgress() };
            }
            return { jobId, status: cachedOutputs.length > 0 ? 'completed' : 'failed', progress: cachedOutputs.length > 0 ? 100 : 0 };
        },

        async cancel(): Promise<void> {
            // The synchronous image API has no cancellation endpoint.
        },

        async getOutputs(): Promise<GenerationOutput[]> {
            return cachedOutputs;
        },
    };
}

export { normalizeNativeImageDimensions, parseModels, parseImageOutputs, parseNativeImageOutputs } from './openAIImagePayload';
