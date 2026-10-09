import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpenAIImageTarget, normalizeNativeImageDimensions, parseImageOutputs, parseModels } from './openAIImageTarget';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { mockAssetPipeline } from '@/services/assetPipelineMock';

// Runtime internals that must never leak into any outbound payload (FR-002).
const RUNTIME_INTERNALS = ['guidance_2', 'quantization', 'offload', 'memory_mode', 'attention_backend', 'cache', 'caches'];

function bodyOf(call: unknown[]): Record<string, unknown> {
    const init = call[1] as RequestInit | undefined;
    if (typeof init?.body !== 'string' || init.body.length === 0) return {};
    return JSON.parse(init.body) as Record<string, unknown>;
}

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept',
    prompt: 'A red desk lamp',
    references: [],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

describe('openAIImageTarget', () => {
    beforeEach(() => {
        mockAssetPipeline();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rounds Qwen Image dimensions to multiples of 32', () => {
        expect(normalizeNativeImageDimensions({ width: 1024, height: 688 }, 'unsloth/Qwen-Image-2.1-GGUF'))
            .toEqual({ width: 1024, height: 704 });
    });

    it('parses OpenAI model objects, image URLs, and base64 image data', () => {
        expect(parseModels({ data: [{ id: 'Qwen-Image-2.1' }, { id: 'other' }] })).toEqual(['Qwen-Image-2.1', 'other']);
        expect(parseImageOutputs({
            data: [
                { url: 'https://images.example/result.png' },
                { b64_json: 'encoded-image' },
            ],
        })).toEqual([
            { url: 'https://images.example/result.png', index: 0, contentType: 'image/*' },
            { url: 'data:image/png;base64,encoded-image', index: 1, contentType: 'image/png' },
        ]);
    });

    it('discovers models and sends an authenticated generation request', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'Qwen-Image-2.1' }] }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: 'https://images.example/result.png' }] }), { status: 200 }));
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'Qwen-Image-2.1', apiKey: 'secret', fetcher });

        await expect(target.health()).resolves.toMatchObject({ status: 'ready' });
        await expect(target.submit(request)).resolves.toMatchObject({ targetId: 'unsloth' });
        expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8001/v1/models');
        expect(fetcher.mock.calls[1]?.[0]).toBe('http://localhost:8001/v1/images/generations');
        expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer secret' });
        expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ model: 'Qwen-Image-2.1', prompt: request.prompt, n: 1, size: '1024x1024' });
        await expect(target.getOutputs('image-api-1')).resolves.toEqual([{ url: 'https://images.example/result.png', index: 0, contentType: 'image/*' }]);
    });

    it('uses native Unsloth edit generation when an input image is provided', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                images: [{ url: '/api/inference/images/gallery/result/file' }],
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));
        const target = createOpenAIImageTarget({
            id: 'unsloth',
            endpoint: 'http://localhost:8001/v1',
            model: 'unsloth/Qwen-Image-2.1-GGUF',
            apiKey: 'secret',
            size: '1024x688',
            fetcher,
        });

        await expect(target.submit({
            ...request,
            workflowId: 'product_edit',
            initImage: 'data:image/png;base64,aW5wdXQ=',
            parameters: { strength: 0.7 },
        })).resolves.toMatchObject({ targetId: 'unsloth' });

        expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8001/api/inference/images/generate');
        expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
            model: 'unsloth/Qwen-Image-2.1-GGUF',
            prompt: request.prompt,
            width: 1024,
            height: 704,
            batch_size: 1,
            init_image: 'data:image/png;base64,aW5wdXQ=',
            workflow: 'edit',
        });
        expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).not.toHaveProperty('strength');
        await expect(target.getOutputs('image-api-1')).resolves.toHaveLength(1);
        expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer secret' });
    });

    it('uses native reference workflow when connected reference images are provided', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                images: [{ url: '/api/inference/images/gallery/reference-result' }],
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));
        const target = createOpenAIImageTarget({
            id: 'unsloth',
            endpoint: 'http://localhost:8001/v1',
            model: 'Qwen-Image-2.1',
            apiKey: 'secret',
            fetcher,
        });

        await target.submit({
            ...request,
            imageWorkflow: 'reference',
            initImage: 'data:image/png;base64,source',
            referenceImages: ['data:image/png;base64,source'],
            referenceResolution: 512,
        });

        expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8001/api/inference/images/generate');
        expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
            workflow: 'reference',
            reference_images: ['data:image/png;base64,source'],
            reference_resolution: 512,
        });
        expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toHaveProperty('init_image', 'data:image/png;base64,source');
    });

    it('downloads URL inputs and sends them as base64 image data', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/jpeg' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ images: [{ url: '/api/inference/images/gallery/result' }] }), { status: 200 }))
            .mockResolvedValueOnce(new Response('result-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));
        const target = createOpenAIImageTarget({
            id: 'unsloth',
            endpoint: 'http://localhost:8001/v1',
            model: 'unsloth/Qwen-Image-2.1-GGUF',
            apiKey: 'secret',
            fetcher,
        });

        await target.submit({
            ...request,
            initImage: 'https://picsum.photos/seed/732/1024/682',
            imageWorkflow: 'edit',
        });

        const payload = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)) as { init_image?: string };
        expect(payload.init_image).toMatch(/^data:image\/jpeg;base64,/);
        expect(payload.init_image).not.toContain('picsum.photos');
        expect(fetcher.mock.calls[0]?.[1]?.headers).toBeUndefined();
    });

    it('adds the native gallery file suffix when the backend returns only the gallery id path', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                images: [{ url: '/api/inference/images/gallery/79c92d21480b42f6a3031f08a4b5d328' }],
            }), { status: 200 }))
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));
        // Asset pipeline (re-host to S3) — refs-only contract.
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === '/api/assets/upload-url') return new Response(JSON.stringify({ uploadUrl: 'http://s3.local/uploads/r/render.png', key: 'uploads/r/render.png' }), { status: 200 });
            if (url.startsWith('http://s3.local/')) return new Response(null, { status: 200 });
            if (url.startsWith('/api/assets/thumbnail')) return new Response(JSON.stringify({ url: null }), { status: 200 });
            throw new Error(`unexpected fetch: ${url}`);
        });

        const target = createOpenAIImageTarget({
            id: 'unsloth',
            endpoint: 'http://100.85.5.85:8888/v1',
            model: 'unsloth/Qwen-Image-2.1-GGUF',
            apiKey: 'secret',
            fetcher,
        });

        await target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=' });
        const outputs = await target.getOutputs('native-edit');
        expect(outputs).toHaveLength(1);
        // Re-hosted to a durable S3 ref — never an inline data URL.
        expect(outputs[0]?.url).toMatch(/^\/api\/assets\//);
        vi.restoreAllMocks();
    });

    it('re-hosts provider data-URL outputs through the asset pipeline (refs-only contract)', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                images: [{ url: 'data:image/png;base64,ZW5jb2RlZC1pbWFnZQ==' }],
            }), { status: 200 }));
        const globalFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.startsWith('data:image/')) return new Response(new Blob(['image-bytes'], { type: 'image/png' }), { status: 200 });
            if (url === '/api/assets/upload-url') return new Response(JSON.stringify({ uploadUrl: 'http://s3.local/uploads/r/render.png', key: 'uploads/r/render.png' }), { status: 200 });
            if (url.startsWith('http://s3.local/')) {
                expect(init?.method).toBe('PUT');
                return new Response(null, { status: 200 });
            }
            if (url.startsWith('/api/assets/thumbnail')) return new Response(JSON.stringify({ url: null }), { status: 200 });
            throw new Error(`unexpected fetch: ${url}`);
        });

        const target = createOpenAIImageTarget({
            id: 'unsloth',
            endpoint: 'http://100.85.5.85:8888/v1',
            model: 'unsloth/Qwen-Image-2.1-GGUF',
            apiKey: 'secret',
            fetcher,
        });

        await target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=' });
        const outputs = await target.getOutputs('native-edit');
        expect(outputs[0]?.url).toMatch(/^\/api\/assets\//);
        // The data URL was decoded locally (global fetch) and PUT to S3.
        expect(globalFetch.mock.calls.some((c) => String(c[0]).startsWith('data:image/'))).toBe(true);
        expect(globalFetch.mock.calls.some((c) => String(c[0]) === 'http://s3.local/uploads/r/render.png')).toBe(true);
    });

    it('fails with a storage-specific error when the asset store is down during re-host (SC-008)', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                images: [{ url: 'data:image/png;base64,ZW5jb2RlZC1pbWFnZQ==' }],
            }), { status: 200 }));
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
            // Decode succeeds; the storage round-trip fails.
            if (String(input).startsWith('data:image/')) return new Response(new Blob(['image-bytes'], { type: 'image/png' }), { status: 200 });
            return new Response('nope', { status: 503 });
        });

        const target = createOpenAIImageTarget({
            id: 'unsloth',
            endpoint: 'http://100.85.5.85:8888/v1',
            model: 'unsloth/Qwen-Image-2.1-GGUF',
            apiKey: 'secret',
            fetcher,
        });

        await expect(target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=' }))
            .rejects.toThrow(/asset storage is unavailable/i);
        vi.restoreAllMocks();
    });

    it('requires a key unless keyless mode is explicitly enabled', async () => {
        const fetcher = vi.fn<typeof fetch>();
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'model', fetcher });
        await expect(target.health()).resolves.toMatchObject({ status: 'auth-required' });
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('reports authentication failures clearly', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), { status: 401 }));
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'model', apiKey: 'bad', fetcher });
        await expect(target.health()).resolves.toMatchObject({ status: 'auth-required', message: expect.stringContaining('Authorization header') });
    });

    it('supports an explicit request size override through target configuration', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: 'https://images.example/result.png' }] }), { status: 200 }));
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'model', apiKey: 'secret', size: '1536x1024', fetcher });
        await target.submit(request);
        expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({ size: '1536x1024' });
    });
});

describe('openAIImageTarget — feature 012 render task pass-through', () => {
    beforeEach(() => {
        mockAssetPipeline();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
    const nativeOk = (fetcher: ReturnType<typeof vi.fn>) => {
        fetcher
            .mockResolvedValueOnce(new Response(JSON.stringify({ images: [{ url: '/api/inference/images/gallery/result/file' }] }), { status: 200 }))
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));
    };

    it('passes strength, seeds, negative_prompt and reference_resolution through on the native path', async () => {
        const fetcher = vi.fn<typeof fetch>();
        nativeOk(fetcher);
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', fetcher });

        await target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=', imageWorkflow: 'edit', strength: 0.35, seeds: [11, 22], batchSize: 2 });
        expect(bodyOf(fetcher.mock.calls[0])).toMatchObject({ workflow: 'edit', strength: 0.35, seeds: [11, 22], batch_size: 2 });

        nativeOk(fetcher);
        await target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=', imageWorkflow: 'reference', referenceImages: ['data:image/png;base64,aW5wdXQ='], negativePrompt: 'text, watermarks', referenceResolution: 1024 });
        expect(bodyOf(fetcher.mock.calls[2])).toMatchObject({ workflow: 'reference', negative_prompt: 'text, watermarks', reference_resolution: 1024 });
    });

    it('drops capability-rejected fields and retries once (capability-tolerant)', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'unexpected field strength' }), { status: 400 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ images: [{ url: '/api/inference/images/gallery/result/file' }] }), { status: 200 }))
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } }));
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', fetcher });

        await target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=', imageWorkflow: 'edit', strength: 0.35, negativePrompt: 'text' });
        expect(fetcher).toHaveBeenCalledTimes(3);
        const retried = bodyOf(fetcher.mock.calls[1]);
        expect(retried).not.toHaveProperty('strength');
        expect(retried).not.toHaveProperty('negative_prompt');
        expect(retried).toHaveProperty('prompt', request.prompt);
    });

    it('surfaces the endpoint error when the retry also fails', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ detail: 'unexpected field strength' }), { status: 400 }));
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', fetcher });

        await expect(target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=', strength: 0.35 })).rejects.toThrow('unexpected field strength');
    });

    it('never emits runtime internals on any payload (FR-002)', async () => {
        const fetcher = vi.fn<typeof fetch>();
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', fetcher });

        // Plain OpenAI-compatible path.
        fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ url: 'https://images.example/result.png' }] }), { status: 200 }));
        await target.submit(request);
        // Native edit path with every optional field set.
        nativeOk(fetcher);
        await target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=', imageWorkflow: 'edit', strength: 0.35, seeds: [1], negativePrompt: 'text', referenceResolution: 512 });

        for (const call of fetcher.mock.calls) {
            const body = bodyOf(call);
            for (const key of RUNTIME_INTERNALS) expect(body).not.toHaveProperty(key);
        }
    });

    it('polls step-level progress while a generation is in flight when telemetry is probed', async () => {
        let releaseSubmit!: () => void;
        const submitResponse = new Promise<Response>((resolve) => {
            releaseSubmit = () => resolve(new Response(JSON.stringify({ images: [{ url: '/api/inference/images/gallery/result/file' }] }), { status: 200 }));
        });
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ active: true, step: 6, total_steps: 30, fraction: 0.2 }), { status: 200 })) // call 0: immediate progress poll (poller starts before the POST)
            .mockReturnValueOnce(submitResponse) // call 1: submit (held until releaseSubmit)
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } })); // call 2: materialize
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', progressTelemetry: true, fetcher });

        const submitPromise = target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=' });
        // Let the async input normalization finish so the job is in flight and the first poll has landed.
        await new Promise((resolve) => setTimeout(resolve, 10));
        await expect(target.getStatus('image-api-1')).resolves.toMatchObject({ status: 'running', progress: 20 });
        expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:8001/api/inference/images/generate-progress');

        releaseSubmit();
        await submitPromise;
        await expect(target.getStatus('image-api-1')).resolves.toMatchObject({ status: 'completed', progress: 100 });
    });

    it('falls back to 0→100 on completion when telemetry is not probed', async () => {
        let releaseSubmit!: () => void;
        const submitResponse = new Promise<Response>((resolve) => {
            releaseSubmit = () => resolve(new Response(JSON.stringify({ images: [{ url: '/api/inference/images/gallery/result/file' }] }), { status: 200 }));
        });
        const fetcher = vi.fn<typeof fetch>()
            .mockReturnValueOnce(submitResponse) // call 0: submit (held until releaseSubmit)
            .mockResolvedValueOnce(new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } })); // call 1: materialize
        const target = createOpenAIImageTarget({ id: 'unsloth', endpoint: 'http://localhost:8001/v1', model: 'm', apiKey: 'secret', fetcher });

        const submitPromise = target.submit({ ...request, initImage: 'data:image/png;base64,aW5wdXQ=' });
        await new Promise((resolve) => setTimeout(resolve, 10)); // let normalization finish so the job is in flight
        await expect(target.getStatus('image-api-1')).resolves.toMatchObject({ status: 'running', progress: 0 });
        releaseSubmit();
        await submitPromise;
        await expect(target.getStatus('image-api-1')).resolves.toMatchObject({ status: 'completed', progress: 100 });
        expect(fetcher).toHaveBeenCalledTimes(2); // submit + materialize only — no progress route
    });
});
