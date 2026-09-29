import { describe, expect, it, vi } from 'vitest';
import { createOpenAIImageTarget, normalizeNativeImageDimensions, parseImageOutputs, parseModels } from './openAIImageTarget';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';

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
        expect(outputs[0]?.url.startsWith('data:image/png;base64,')).toBe(true);
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
