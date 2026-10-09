/**
 * OpenAI-compatible video generation target (Unsloth endpoint, R1).
 *
 * Feature 012 (T006b/T028): routes Animate to the active protocol's video
 * route. When capability probing reports the native route, `POST
 * /api/inference/video/generate` starts a background job whose terminal
 * outcome arrives via `/api/inference/video/generate-progress`; otherwise
 * `POST /v1/videos` returns a `VideoJob` polled by id. Optional fields an
 * older endpoint rejects are dropped on a single retry (capability-tolerant,
 * R4). Runtime internals are never emitted (FR-002). Payload building and
 * I/O helpers live in `openAIVideoPayload.ts`.
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
import { uploadBlobToAsset } from '@/services/assetUpload';
import { endpointRoot, normalizeInputImage } from './openAIImagePayload';
import {
    NATIVE_VIDEO_OPTIONAL_FIELDS,
    asVideoRecord,
    buildNativeVideoPayload,
    buildOpenAIVideoPayload,
    parseVideoJob,
    readVideoJson,
    videoErrorMessage,
    videoHeaders,
} from './openAIVideoPayload';

type Fetcher = typeof fetch;

export interface OpenAIVideoTargetOptions {
    id: string;
    endpoint: string;
    model: string;
    apiKey?: string;
    keyless?: boolean;
    /** Capability probe result: the native /api/inference/video/generate route exists (R1). */
    nativeVideoRoute?: boolean;
    fetcher?: Fetcher;
}

interface NativeVideoJob {
    protocol: 'native';
    status: NormalizedJobStatus['status'];
    progress: number;
    message?: string;
    outputs: GenerationOutput[] | null;
}

interface OpenAIVideoJob {
    protocol: 'openai';
    videoId: string;
    status: NormalizedJobStatus['status'];
    progress: number;
    message?: string;
    outputs: GenerationOutput[] | null;
}

type VideoJobState = NativeVideoJob | OpenAIVideoJob;

function normalizeEndpoint(endpoint: string): string {
    return endpoint.trim().replace(/\/$/, '');
}

export function createOpenAIVideoTarget(options: OpenAIVideoTargetOptions): ExecutionTargetAdapter {
    const endpoint = normalizeEndpoint(options.endpoint);
    const fetcher = options.fetcher ?? fetch;
    let cachedModels: string[] = [];
    let jobCounter = 0;
    const jobs = new Map<string, VideoJobState>();

    async function listModels(): Promise<void> {
        const response = await fetcher(`${endpoint}/models`, { headers: videoHeaders(options) });
        const body = asVideoRecord(await readVideoJson(response));
        if (!response.ok) {
            const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
            throw new Error(`${videoErrorMessage(body, `Model discovery failed (${response.status}).`)}${suffix}`);
        }
        const data = Array.isArray(body.data) ? body.data : [];
        cachedModels = data.map((item) => asVideoRecord(item).id).filter((id): id is string => typeof id === 'string');
        if (cachedModels.length === 0) throw new Error('The video API returned no usable models.');
    }

    async function postJson(url: string, payload: Record<string, unknown>): Promise<Response> {
        return fetcher(url, { method: 'POST', headers: videoHeaders(options, true), body: JSON.stringify(payload) });
    }

    /** One best-effort progress check; never throws (SC-009 parity). */
    async function pollNativeOnce(state: NativeVideoJob): Promise<void> {
        try {
            const response = await fetcher(`${endpointRoot(endpoint)}/api/inference/video/generate-progress`, { headers: videoHeaders(options) });
            if (!response.ok) return;
            const body = asVideoRecord(await readVideoJson(response));
            const phase = typeof body.phase === 'string' ? body.phase : null;
            if (phase === 'completed') {
                state.status = 'completed';
                state.progress = 100;
                const video = asVideoRecord(body.video);
                if (typeof video.url === 'string' && video.url.length > 0) {
                    state.outputs = [await materializeVideoOutput(video.url)];
                } else {
                    state.outputs = [];
                }
            } else if (phase === 'failed') {
                state.status = 'failed';
                state.message = typeof body.error === 'string' ? body.error : 'The video generation failed.';
            } else if (state.status !== 'cancelled') {
                const fraction = typeof body.fraction === 'number' && Number.isFinite(body.fraction) ? Math.min(1, Math.max(0, body.fraction)) : null;
                state.status = 'running';
                state.progress = fraction === null ? state.progress : Math.round(fraction * 100);
            }
        } catch {
            // Best effort: progress telemetry must never break the generation.
        }
    }

    async function pollOpenAIOnce(state: OpenAIVideoJob): Promise<void> {
        try {
            const response = await fetcher(`${endpoint}/videos/${state.videoId}`, { headers: videoHeaders(options) });
            if (!response.ok) return;
            const job = parseVideoJob(await readVideoJson(response));
            if (job.status === 'completed') {
                state.status = 'completed';
                state.progress = 100;
                const contentUrl = `${endpoint}/videos/${state.videoId}/content`;
                state.outputs = [await materializeVideoOutput(contentUrl)];
            } else if (job.status === 'failed') {
                state.status = 'failed';
                state.message = job.error ?? 'The video generation failed.';
            } else {
                state.status = job.status === 'queued' ? 'queued' : 'running';
                if (typeof job.progress === 'number') state.progress = Math.min(100, Math.max(0, Math.round(job.progress)));
            }
        } catch {
            // Best effort: keep the last known status.
        }
    }

    async function materializeVideoOutput(url: string): Promise<GenerationOutput> {
        const absolute = /^https?:\/\//.test(url) ? url : `${endpointRoot(endpoint)}${url.startsWith('/') ? '' : '/'}${url}`;
        const response = await fetcher(absolute, { headers: videoHeaders(options) });
        if (!response.ok) throw new Error(`Rendered video download failed (${response.status}).`);
        const contentType = response.headers.get('content-type')?.split(';')[0] ?? 'video/mp4';
        // Store a short asset ref (S3) instead of inlining base64; falls back to
        // a data URL when the asset store is unavailable.
        const { url: assetUrl } = await uploadBlobToAsset(await response.blob(), `render-video.mp4`);
        return { url: assetUrl, index: 0, contentType };
    }

    return {
        async health(): Promise<TargetHealth> {
            try {
                await listModels();
                return { targetId: options.id, status: 'ready', capabilities: await this.capabilities(), message: cachedModels.join(', ') };
            } catch (error) {
                return {
                    targetId: options.id,
                    status: error instanceof Error && /401|403|API key|Authorization/i.test(error.message) ? 'auth-required' : 'unavailable',
                    message: error instanceof Error ? error.message : 'Video API is unavailable.',
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
                supportedWorkflows: ['video-generation'],
            };
        },

        async preflight(request: ProductWorkflowRequest): Promise<PreflightResult> {
            const issues: PreflightResult['issues'] = [];
            if (!options.model.trim()) issues.push({ code: 'missing-model', message: 'Select a video model before generating.' });
            if (!request.prompt.trim()) issues.push({ code: 'missing-prompt', message: 'Describe the motion before animating.' });
            // FR-017: a connected start frame is required.
            if (!request.initImage?.trim()) issues.push({ code: 'missing-start-frame', message: 'Connect a start frame before animating.' });
            if (issues.length > 0) return { ready: false, status: 'incompatible', issues };
            return { ready: true, status: 'ready', issues: [], selectedTier: 'hosted-auto', explanation: options.nativeVideoRoute ? 'Native Unsloth video route.' : 'OpenAI-compatible video job.' };
        },

        async submit(request: ProductWorkflowRequest): Promise<SubmittedJob> {
            const initImage = await normalizeInputImage(request.initImage, fetcher);
            const endImage = await normalizeInputImage(request.endImage, fetcher);
            if (!initImage) throw new Error('A start frame is required for animation.');

            let state: VideoJobState;
            if (options.nativeVideoRoute) {
                const nativeRequest: ProductWorkflowRequest = {
                    ...request,
                    initImage,
                    ...(endImage ? { endImage } : {}),
                };
                const payload = buildNativeVideoPayload(nativeRequest);
                let response = await postJson(`${endpointRoot(endpoint)}/api/inference/video/generate`, payload);
                if (!response.ok && (response.status === 400 || response.status === 422)) {
                    // Capability-tolerant retry: drop the optional fields an older endpoint may not support (R4).
                    response = await postJson(`${endpointRoot(endpoint)}/api/inference/video/generate`, buildNativeVideoPayload(nativeRequest, new Set(NATIVE_VIDEO_OPTIONAL_FIELDS)));
                }
                const body = await readVideoJson(response);
                if (!response.ok) {
                    const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
                    throw new Error(`${videoErrorMessage(body, `Video generation failed (${response.status}).`)}${suffix}`);
                }
                state = { protocol: 'native', status: 'queued', progress: 0, outputs: null };
            } else {
                const response = await postJson(`${endpoint}/videos`, buildOpenAIVideoPayload(request, options.model));
                const rawBody = await readVideoJson(response);
                if (!response.ok) {
                    const suffix = response.status === 401 || response.status === 403 ? ' Check the API key and Authorization header.' : '';
                    throw new Error(`${videoErrorMessage(rawBody, `Video generation failed (${response.status}).`)}${suffix}`);
                }
                const body = parseVideoJob(rawBody);
                if (!body.videoId) throw new Error('The video API returned no job id.');
                state = { protocol: 'openai', videoId: body.videoId, status: typeof body.status === 'string' ? (body.status as OpenAIVideoJob['status']) : 'queued', progress: 0, outputs: null };
            }

            jobCounter += 1;
            const jobId = `job-${jobCounter}`;
            jobs.set(jobId, state);
            return { jobId, targetId: options.id };
        },

        async getStatus(jobId: string): Promise<NormalizedJobStatus> {
            const state = jobs.get(jobId);
            if (!state) return { jobId, status: 'failed', progress: 0, message: `Unknown video job ${jobId}.` };
            if (state.status !== 'completed' && state.status !== 'failed' && state.status !== 'cancelled') {
                if (state.protocol === 'native') await pollNativeOnce(state);
                else await pollOpenAIOnce(state);
            }
            return { jobId, status: state.status, progress: state.progress, ...(state.message ? { message: state.message } : {}) };
        },

        async cancel(jobId: string): Promise<void> {
            const state = jobs.get(jobId);
            if (!state || state.protocol !== 'native' || state.status === 'completed' || state.status === 'failed') return;
            try {
                await fetcher(`${endpointRoot(endpoint)}/api/inference/video/generate/cancel`, { method: 'POST', headers: videoHeaders(options, true), body: '{}' });
            } catch {
                // Best effort: some endpoints have no live job to cancel.
            }
            state.status = 'cancelled';
        },

        async getOutputs(jobId: string): Promise<GenerationOutput[]> {
            const state = jobs.get(jobId);
            if (!state || state.outputs === null) return [];
            return state.outputs;
        },
    };
}
