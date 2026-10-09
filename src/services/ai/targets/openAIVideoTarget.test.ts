import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAssetPipeline } from '@/services/assetPipelineMock';
import { createOpenAIVideoTarget } from './openAIVideoTarget';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

// Runtime internals that must never leak into any outbound payload (FR-002).
const RUNTIME_INTERNALS = ['guidance_2', 'quantization', 'offload', 'memory_mode', 'attention_backend', 'cache', 'caches'];

function bodyOf(call: unknown[]): Record<string, unknown> {
    const init = call[1] as RequestInit | undefined;
    if (typeof init?.body !== 'string' || init.body.length === 0) return {};
    return JSON.parse(init.body) as Record<string, unknown>;
}

const request: ProductWorkflowRequest = {
    workflowId: 'animate',
    prompt: 'Slow 360 degree turntable of the product',
    references: [],
    width: 1280,
    height: 720,
    batchSize: 1,
    parameters: {},
    initImage: 'data:image/png;base64,aW5wdXQ=',
    numFrames: 96,
    fps: 24,
};

beforeEach(() => {
    mockAssetPipeline();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('openAIVideoTarget — native route (R1)', () => {
    it('emits first/last frame, num_frames, fps and seed on the native video payload', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(JSON.stringify({ status: 'started', video: null }), { status: 200 }),
        );
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'wan-2.2', apiKey: 'secret', nativeVideoRoute: true, fetcher });

        const submitted = await target.submit({ ...request, endImage: 'data:image/png;base64,ZW5k', seed: 7 });
        void submitted;
        expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8001/api/inference/video/generate');
        expect(bodyOf(fetcher.mock.calls[0])).toMatchObject({
            prompt: request.prompt,
            first_frame: 'data:image/png;base64,aW5wdXQ=',
            last_frame: 'data:image/png;base64,ZW5k',
            num_frames: 96,
            fps: 24,
            seed: 7,
        });
    });

    it('tracks the background job via generate-progress and materializes the completed clip', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'started', video: null }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ active: true, phase: 'denoise', step: 6, total_steps: 30, fraction: 0.2 }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ active: false, phase: 'completed', video: { id: 'v1', url: '/api/inference/video/gallery/v1/file.mp4' } }), { status: 200 }))
            .mockResolvedValueOnce(new Response('video-bytes', { status: 200, headers: { 'Content-Type': 'video/mp4' } }));
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'wan-2.2', apiKey: 'secret', nativeVideoRoute: true, fetcher });

        const submitted = await target.submit(request);
        await expect(target.getStatus(submitted.jobId)).resolves.toMatchObject({ status: 'running', progress: 20 });
        expect(fetcher.mock.calls[1]?.[0]).toBe('http://localhost:8001/api/inference/video/generate-progress');

        const done = await target.getStatus(submitted.jobId);
        expect(done).toMatchObject({ status: 'completed', progress: 100 });
        const outputs = await target.getOutputs(submitted.jobId);
        expect(outputs).toHaveLength(1);
        expect(outputs[0]?.url).toMatch(/^\/api\/assets\//); // refs-only: re-hosted to S3
    });

    it('surfaces the client-safe error when the native job fails', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'started', video: null }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ active: false, phase: 'failed', error: 'Video model failed to load' }), { status: 200 }));
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'wan-2.2', apiKey: 'secret', nativeVideoRoute: true, fetcher });

        const submitted = await target.submit(request);
        await expect(target.getStatus(submitted.jobId)).resolves.toMatchObject({ status: 'failed', message: expect.stringContaining('Video model failed to load') });
    });

    it('drops capability-rejected optional fields and retries once (R4)', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'unexpected field negative_prompt' }), { status: 400 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'started', video: null }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ active: true, phase: 'denoise', step: 1, total_steps: 30, fraction: 0.05 }), { status: 200 }));
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'wan-2.2', apiKey: 'secret', nativeVideoRoute: true, fetcher });

        await target.submit({ ...request, negativePrompt: 'text, watermarks', seed: 7 });
        expect(fetcher).toHaveBeenCalledTimes(2);
        const retried = bodyOf(fetcher.mock.calls[1]);
        expect(retried).not.toHaveProperty('negative_prompt');
        expect(retried).not.toHaveProperty('seed');
        expect(retried).toMatchObject({ prompt: request.prompt, first_frame: 'data:image/png;base64,aW5wdXQ=', num_frames: 96 });
    });

    it('cancels through the native cancel route without throwing when unsupported', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'started', video: null }), { status: 200 }))
            .mockResolvedValueOnce(new Response('not found', { status: 404 })); // cancel route unsupported — best effort, ignored
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'wan-2.2', apiKey: 'secret', nativeVideoRoute: true, fetcher });

        await target.submit(request);
        await expect(target.cancel('job-1')).resolves.toBeUndefined();
        expect(fetcher.mock.calls[1]?.[0]).toBe('http://localhost:8001/api/inference/video/generate/cancel');
        expect(fetcher.mock.calls[1]?.[1]?.method).toBe('POST');
        await expect(target.getStatus('job-1')).resolves.toMatchObject({ status: 'cancelled' });
    });
});

describe('openAIVideoTarget — OpenAI-compatible fallback (R1)', () => {
    it('submits to /v1/videos and polls the VideoJob until the clip content is materialized', async () => {
        const job = { id: 'vid-1', model: 'wan-2.2', status: 'queued', created_at: 1, size: '1280x720', seconds: '4' };
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify(job), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...job, status: 'in_progress', progress: 35 }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ ...job, status: 'completed', progress: 100 }), { status: 200 }))
            .mockResolvedValueOnce(new Response('video-bytes', { status: 200, headers: { 'Content-Type': 'video/mp4' } }));
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'wan-2.2', apiKey: 'secret', fetcher });

        await target.submit(request);
        expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8001/v1/videos');
        expect(bodyOf(fetcher.mock.calls[0])).toMatchObject({ model: 'wan-2.2', prompt: request.prompt, size: '1280x720', seconds: '4' });

        await expect(target.getStatus('job-1')).resolves.toMatchObject({ status: 'running', progress: 35 });
        expect(fetcher.mock.calls[1]?.[0]).toBe('http://localhost:8001/v1/videos/vid-1');
        const done = await target.getStatus('job-1');
        expect(done).toMatchObject({ status: 'completed', progress: 100 });
        const outputs = await target.getOutputs('job-1');
        expect(outputs[0]?.url).toMatch(/^\/api\/assets\//); // refs-only: re-hosted to S3
    });

    it('reports the VideoJob failure reason on failed status', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'vid-1', model: 'm', status: 'queued', created_at: 1, size: '1280x720', seconds: '4' }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'vid-1', model: 'm', status: 'failed', created_at: 1, size: '1280x720', seconds: '4', error: { code: 'render_failed', message: 'Render failed' } }), { status: 200 }));
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', fetcher });

        const submitted = await target.submit(request);
        await expect(target.getStatus(submitted.jobId)).resolves.toMatchObject({ status: 'failed', message: expect.stringContaining('Render failed') });
    });
});

describe('openAIVideoTarget — contract guards', () => {
    it('preflights for a prompt and a connected start frame (FR-017)', async () => {
        const target = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret' });
        await expect(target.preflight({ ...request, prompt: '' })).resolves.toMatchObject({ ready: false });
        await expect(target.preflight({ ...request, initImage: undefined })).resolves.toMatchObject({ ready: false });
        await expect(target.preflight(request)).resolves.toMatchObject({ ready: true });
    });

    it('never emits runtime internals on any payload (FR-002)', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'started', video: null }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'vid-1', model: 'm', status: 'queued', created_at: 1, size: '1280x720', seconds: '4' }), { status: 200 }));
        const native = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', nativeVideoRoute: true, fetcher });
        await native.submit({ ...request, negativePrompt: 'text', seed: 3 });

        const openai = createOpenAIVideoTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', fetcher });
        await openai.submit(request);

        for (const call of fetcher.mock.calls) {
            const body = bodyOf(call);
            for (const key of RUNTIME_INTERNALS) expect(body).not.toHaveProperty(key);
        }
    });
});
