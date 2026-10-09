/**
 * Feature 012 — render task protocol runners (T007 split).
 *
 * Per-workflow execution behind `RenderTaskRunner`: image (edit/reference),
 * video (OpenAI-compatible native route or ComfyUI fallback) and the
 * structured extraction pipeline. Kept separate from the service facade so
 * each file stays within the 300-line budget (Constitution V).
 */

import type { ComputeSettings, ExecutionTargetAdapter } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import type { RenderTaskOutcome, ResolvedRenderParameters, RenderTaskRequest } from '@/types/renderTask.types';
import { RenderTaskCancelledError, type RenderTaskRunner } from './ai/renderTaskCoordinator';
import { PROXY_API_KEY } from './ai/proxyFetcher';
import { probeEndpointCapabilities } from './ai/targets/openApiDiscovery';
import { createOpenAIImageTarget } from './ai/targets/openAIImageTarget';
import { createOpenAIVideoTarget } from './ai/targets/openAIVideoTarget';
import { createLocalComfyTarget } from './ai/targets/localComfyTarget';
import { submitProductAnimation } from './ai/productAnimationGeneration';
import { pollProductWorkflow, isTerminalJobStatus } from './ai/generationJobService';
import { createExtractionRunner, type ExtractionOutput } from './ai/extractionService';
import { generateUUID } from '@/utils/uuid';

type Fetcher = typeof fetch;

/** One displayable output of a task (data for the node UI + seed lock). */
export interface RenderTaskOutputRef {
    id: string;
    url?: string;
    seed?: number;
}

/** Facade-level result: coordinator outcome plus display data. */
export interface RenderTaskResult extends RenderTaskOutcome {
    outputs: RenderTaskOutputRef[];
    extraction?: ExtractionOutput;
}

/** No active protocol serves the required capability (R1 — never mis-route). */
export class RenderTaskCapabilityError extends Error {
    constructor(readonly capability: 'image' | 'video') {
        super(
            capability === 'video'
                ? 'No active protocol supports video generation. Configure an OpenAI-compatible endpoint with video routes or a ComfyUI target.'
                : 'No image backend is configured. Set an OpenAI-compatible image endpoint in the AI compute settings.',
        );
        this.name = 'RenderTaskCapabilityError';
    }
}

export interface RenderTaskRunnerContext {
    getSettings: () => ComputeSettings;
    /** Resolve a connected reference id to a data URL (node attachment). */
    resolveReferenceImage: (imageId: string) => Promise<string | undefined>;
    /** Injected fetch for the protocol targets and probes (tests). */
    fetcher?: Fetcher;
    /** Video polling cadence; default 1000 ms. */
    pollIntervalMs: number;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal.aborted) return resolve();
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            resolve();
        };
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export interface RenderTaskRunners {
    buildRunner: (request: RenderTaskRequest, resolved: ResolvedRenderParameters, captured: { current?: RenderTaskResult }) => RenderTaskRunner;
}

export function createRenderTaskRunners(ctx: RenderTaskRunnerContext): RenderTaskRunners {
    const { getSettings, resolveReferenceImage } = ctx;
    const fetcher = ctx.fetcher;
    const pollIntervalMs = ctx.pollIntervalMs;

    async function resolveSource(request: RenderTaskRequest): Promise<{ firstFrame: string | undefined; endFrame?: string }> {
        if (!request.referenceImageId) return { firstFrame: undefined };
        const firstFrame = await resolveReferenceImage(request.referenceImageId);
        if (!firstFrame) throw new Error('The connected reference image could not be loaded.');
        let endFrame: string | undefined;
        if (request.endFrameImageId) {
            endFrame = await resolveReferenceImage(request.endFrameImageId);
            if (!endFrame) throw new Error('The connected end frame could not be loaded.');
        }
        return { firstFrame, endFrame };
    }

    function toProductRequest(resolved: ResolvedRenderParameters, firstFrame?: string, endFrame?: string): ProductWorkflowRequest {
        const base: ProductWorkflowRequest = {
            workflowId: 'render-task',
            prompt: resolved.prompt,
            negativePrompt: resolved.negativePrompt ?? undefined,
            references: [],
            width: resolved.width ?? 1024,
            height: resolved.height ?? 1024,
            batchSize: Math.max(1, resolved.seeds.length),
            seed: resolved.seeds[0],
            parameters: {},
        };
        if (resolved.workflow === 'edit') {
            return {
                ...base,
                initImage: firstFrame,
                imageWorkflow: 'edit',
                ...(resolved.strength !== null && resolved.strength !== undefined ? { strength: resolved.strength } : {}),
                ...(resolved.seeds.length > 1 ? { seeds: resolved.seeds } : {}),
                ...(resolved.referenceResolution ? { referenceResolution: resolved.referenceResolution } : {}),
            };
        }
        if (resolved.workflow === 'reference') {
            return { ...base, referenceImages: firstFrame ? [firstFrame] : [], imageWorkflow: 'reference' };
        }
        return {
            ...base,
            initImage: firstFrame,
            ...(endFrame ? { endImage: endFrame } : {}),
            numFrames: resolved.numFrames ?? undefined,
            fps: resolved.fps ?? undefined,
        };
    }

    async function runImage(resolved: ResolvedRenderParameters, firstFrame?: string): Promise<RenderTaskResult> {
        const settings = getSettings();
        if (!settings.imageApiEndpoint?.trim()) throw new RenderTaskCapabilityError('image');

        const target = createOpenAIImageTarget({
            id: 'render-task-image',
            endpoint: settings.imageApiEndpoint,
            model: settings.imageApiModel ?? '',
            apiKey: settings.imageApiKey || PROXY_API_KEY,
            keyless: settings.imageApiKeyless ?? false,
            size: `${resolved.width ?? 1024}x${resolved.height ?? 1024}`,
            ...(fetcher ? { fetcher } : {}),
        });

        const submitted = await target.submit(toProductRequest(resolved, firstFrame));
        const outputs = await target.getOutputs(submitted.jobId);
        if (outputs.length === 0) throw new Error('The image backend returned no outputs.');
        return {
            outputIds: outputs.map(() => generateUUID()),
            allOutputsSucceeded: true,
            outputs: outputs.map((output, index) => ({ id: generateUUID(), url: output.url, seed: resolved.seeds[index] })),
        };
    }

    async function runVideoOpenAI(resolved: ResolvedRenderParameters, signal: AbortSignal, firstFrame?: string, endFrame?: string): Promise<RenderTaskResult> {
        const settings = getSettings();
        const probe = await probeEndpointCapabilities(settings.imageApiEndpoint as string, {
            apiKey: settings.imageApiKey || PROXY_API_KEY,
            keyless: settings.imageApiKeyless ?? false,
            ...(fetcher ? { fetcher } : {}),
        });

        const target = createOpenAIVideoTarget({
            id: 'render-task-video',
            endpoint: settings.imageApiEndpoint as string,
            model: settings.imageApiModel ?? '',
            apiKey: settings.imageApiKey || PROXY_API_KEY,
            keyless: settings.imageApiKeyless ?? false,
            nativeVideoRoute: probe.videoGenerateNative,
            ...(fetcher ? { fetcher } : {}),
        });

        const submitted = await target.submit(toProductRequest(resolved, firstFrame, endFrame));
        for (;;) {
            if (signal.aborted) throw new RenderTaskCancelledError();
            const status = await target.getStatus(submitted.jobId);
            if (status.status === 'completed' || status.status === 'partial') break;
            if (status.status === 'failed') throw new Error(status.message ?? 'Video generation failed.');
            if (status.status === 'cancelled') throw new RenderTaskCancelledError();
            await sleep(pollIntervalMs, signal);
        }

        const outputs = await target.getOutputs(submitted.jobId);
        return {
            outputIds: outputs.map(() => generateUUID()),
            allOutputsSucceeded: true,
            outputs: outputs.map((output, index) => ({ id: generateUUID(), url: output.url, seed: resolved.seeds[index] })),
        };
    }

    async function runVideoComfyUI(resolved: ResolvedRenderParameters, request: RenderTaskRequest, signal: AbortSignal, firstFrame?: string, endFrame?: string): Promise<RenderTaskResult> {
        const settings = getSettings();
        if (!settings.localEndpoint?.trim()) throw new RenderTaskCapabilityError('video');
        const duration = request.duration ?? '2s';
        if (duration === '8s') throw new Error('The ComfyUI video fallback supports 2s and 4s durations only.');

        const adapter: ExecutionTargetAdapter = createLocalComfyTarget({ id: 'local', endpoint: settings.localEndpoint });
        const job = await submitProductAnimation(
            adapter,
            {
                projectId: undefined,
                prompt: resolved.prompt,
                referenceAssetId: request.referenceImageId as string,
                startAssetId: firstFrame,
                endAssetId: endFrame,
                duration: duration === '4s' ? '4s' : '2s',
                motionStrength: 0.5,
                width: resolved.width ?? 1280,
                height: resolved.height ?? 720,
                seed: resolved.seeds[0],
            },
            settings.targetKind === 'local' ? 'local' : 'hosted',
        );

        let current = job;
        while (!isTerminalJobStatus(current.status)) {
            if (signal.aborted) throw new RenderTaskCancelledError();
            await sleep(pollIntervalMs, signal);
            current = await pollProductWorkflow(adapter, current);
        }
        if (current.status === 'failed') throw new Error(current.error?.message ?? 'The ComfyUI video workflow failed.');
        if (current.status === 'cancelled') throw new RenderTaskCancelledError();

        const outputs = current.outputs;
        return {
            outputIds: outputs.map(() => generateUUID()),
            allOutputsSucceeded: true,
            outputs: outputs.map((output, index) => ({ id: generateUUID(), url: output.url, seed: resolved.seeds[index] })),
        };
    }

    async function runExtract(request: RenderTaskRequest, firstFrame?: string): Promise<RenderTaskResult> {
        const settings = getSettings();
        if (!settings.imageApiEndpoint?.trim()) throw new RenderTaskCapabilityError('image');
        if (!firstFrame) throw new Error('An image is required for extraction.');

        const runner = createExtractionRunner({
            endpoint: settings.imageApiEndpoint,
            model: settings.imageApiModel ?? '',
            apiKey: settings.imageApiKey || PROXY_API_KEY,
            keyless: settings.imageApiKeyless ?? false,
            ...(fetcher ? { fetcher } : {}),
        });
        const extraction = await runner.run(request, firstFrame);
        const recordId = generateUUID();
        return { outputIds: [recordId], allOutputsSucceeded: true, outputs: [{ id: recordId }], extraction };
    }

    /** The runner captures its full result so the submit promise can surface display data. */
    function buildRunner(request: RenderTaskRequest, resolved: ResolvedRenderParameters, captured: { current?: RenderTaskResult }): RenderTaskRunner {
        return async ({ signal }) => {
            const { firstFrame, endFrame } = await resolveSource(request);
            let result: RenderTaskResult;
            switch (resolved.workflow) {
                case 'edit':
                case 'reference':
                    result = await runImage(resolved, firstFrame);
                    break;
                case 'video':
                    if (getSettings().imageApiEndpoint?.trim()) {
                        result = await runVideoOpenAI(resolved, signal, firstFrame, endFrame);
                    } else {
                        result = await runVideoComfyUI(resolved, request, signal, firstFrame, endFrame);
                    }
                    break;
                case 'extract':
                    result = await runExtract(request, firstFrame);
                    break;
            }
            captured.current = result;
            return { outputIds: result.outputIds, allOutputsSucceeded: result.allOutputsSucceeded };
        };
    }

    return { buildRunner };
}
