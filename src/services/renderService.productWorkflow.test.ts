import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderService } from './renderService';
import { useStore } from '@/store/useStore';

type FetchMock = ReturnType<typeof vi.fn>;

const comfyHistoryBody = {
    test_prompt_id: {
        status: { status_str: 'success' },
        outputs: {
            9: { images: [{ filename: 'out.png', subfolder: '', type: 'output' }] },
        },
    },
};

const openAIModelsBody = { data: [{ id: 'Qwen-Image-2.1' }] };
const openAIGenerationsBody = { data: [{ url: 'https://cdn.example.com/generated.png' }] };

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function installFetchMock(): FetchMock {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('data:image')) {
            // Plain object (not a real Response) so blob() resolves to the
            // jsdom global Blob, which FormData.append accepts.
            return { ok: true, blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' })) } as unknown as Response;
        }
        if (url.includes('/upload/image')) {
            return jsonResponse({ name: 'uploaded_file.png' });
        }
        if (url.includes('/prompt')) {
            return jsonResponse({ prompt_id: 'test_prompt_id' });
        }
        if (url.includes('/history/')) {
            return jsonResponse(comfyHistoryBody);
        }
        if (url.includes('/system_stats')) {
            return jsonResponse({ system: {} });
        }
        if (url.includes('/models')) {
            return jsonResponse(openAIModelsBody);
        }
        if (url.includes('/images/generations')) {
            return jsonResponse(openAIGenerationsBody);
        }
        if (url.includes('/api/inference/images/generate')) {
            return jsonResponse({ images: [{ url: '/api/inference/images/gallery/new-view/file' }] });
        }
        if (url.includes('/api/inference/images/gallery/')) {
            return new Response('image-bytes', { status: 200, headers: { 'Content-Type': 'image/png' } });
        }
        return new Response('not found', { status: 404 });
    });
    global.fetch = fetchMock;
    return fetchMock;
}

function calledUrls(fetchMock: FetchMock): string[] {
    return fetchMock.mock.calls.map((call) => String(call[0]));
}

describe('renderService execution-target boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useStore.setState((state) => ({
            computeSettings: { ...state.computeSettings, protocol: 'comfyui' },
        }));
    });

    it('routes legacy style presets through the ComfyUI target boundary', async () => {
        const fetchMock = installFetchMock();

        const response = await renderService.generate({
            prompt: 'A desk lamp',
            stylePreset: 'Cyberpunk / Neon',
            drawingInfluence: 0.65,
            numImages: 1,
            init_image: 'data:image/png;base64,input',
            width: 1024,
            height: 1024,
        });

        expect(response.success).toBe(true);
        expect(response.images[0]).toContain('/comfy-api/view?');
        const urls = calledUrls(fetchMock);
        expect(urls.some((url) => url.includes('/prompt'))).toBe(true);
        expect(urls.some((url) => url.includes('/images/generations'))).toBe(false);

        const promptCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/prompt'));
        const payload = JSON.parse(String(promptCall?.[1]?.body));
        expect(payload.prompt['6'].inputs.text).toContain('A desk lamp');
        expect(payload.prompt['6'].inputs.text).toContain('Style direction:');
    });

    it('routes the openai-image protocol through the OpenAI target boundary', async () => {
        const fetchMock = installFetchMock();
        useStore.setState((state) => ({
            computeSettings: {
                ...state.computeSettings,
                protocol: 'openai-image',
                imageApiEndpoint: 'http://localhost:8001/v1',
                imageApiKey: 'secret',
                imageApiModel: 'Qwen-Image-2.1',
            },
        }));

        const response = await renderService.generate({
            prompt: 'A desk lamp',
            stylePreset: 'Cyberpunk / Neon',
            drawingInfluence: 0.65,
            numImages: 1,
            init_image: '',
            width: 1024,
            height: 704,
        });

        expect(response.success).toBe(true);
        expect(response.images).toEqual(['https://cdn.example.com/generated.png']);
        const urls = calledUrls(fetchMock);
        expect(urls.some((url) => url.includes('/images/generations'))).toBe(true);
        expect(urls.some((url) => url.includes('/comfy-api'))).toBe(false);

        const generationsCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/images/generations'));
        const payload = JSON.parse(String(generationsCall?.[1]?.body));
        expect(payload.model).toBe('Qwen-Image-2.1');
        expect(payload.size).toBe('1024x704');
        expect(payload.prompt).toContain('Style direction:');
    });

    it('routes new-view through the ComfyUI target boundary with a view-conditioned prompt', async () => {
        const fetchMock = installFetchMock();

        const response = await renderService.newView({
            referenceImages: ['data:image/png;base64,ref1'],
            init_image: 'data:image/png;base64,ref1',
            view: 'Rear Right 3/4 view',
            width: 1024,
            height: 704,
        });

        expect(response.success).toBe(true);
        const urls = calledUrls(fetchMock);
        expect(urls.some((url) => url.includes('/prompt'))).toBe(true);
        expect(urls.some((url) => url.includes('/images/generations'))).toBe(false);

        const promptCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/prompt'));
        const payload = JSON.parse(String(promptCall?.[1]?.body));
        expect(payload.prompt['6'].inputs.text).toContain('Rear Right 3/4 view');
    });

    it('routes new-view through the OpenAI target boundary with reference images', async () => {
        const fetchMock = installFetchMock();
        useStore.setState((state) => ({
            computeSettings: {
                ...state.computeSettings,
                protocol: 'openai-image',
                imageApiEndpoint: 'http://localhost:8001/v1',
                imageApiKey: 'secret',
                imageApiModel: 'Qwen-Image-2.1',
            },
        }));

        const response = await renderService.newView({
            referenceImages: ['data:image/png;base64,ref1', 'data:image/png;base64,ref2'],
            init_image: 'data:image/png;base64,ref1',
            view: 'Rear',
            width: 1024,
            height: 704,
        });

        expect(response.success).toBe(true);
        const urls = calledUrls(fetchMock);
        expect(urls.some((url) => url.includes('/api/inference/images/generate'))).toBe(true);
        expect(urls.some((url) => url.includes('/comfy-api'))).toBe(false);

        const generateCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/inference/images/generate'));
        const payload = JSON.parse(String(generateCall?.[1]?.body));
        expect(payload.prompt).toContain('Rear');
        expect(payload.reference_images).toEqual(['data:image/png;base64,ref1', 'data:image/png;base64,ref2']);
        expect(payload.workflow).toBe('reference');
    });

    it('reports new-view capability per backend for Generate gating', async () => {
        useStore.setState((state) => ({
            computeSettings: { ...state.computeSettings, protocol: 'comfyui' },
        }));
        expect(renderService.capabilities()).toContain('new-view');

        useStore.setState((state) => ({
            computeSettings: {
                ...state.computeSettings,
                protocol: 'openai-image',
                imageApiEndpoint: 'http://localhost:8001/v1',
                imageApiKey: 'secret',
                imageApiModel: 'Qwen-Image-2.1',
            },
        }));
        expect(renderService.capabilities()).toContain('new-view');
    });

    it('routes connection health checks through the active protocol target', async () => {
        const fetchMock = installFetchMock();
        expect(await renderService.checkConnection()).toBe(true);
        expect(calledUrls(fetchMock).some((url) => url.includes('/system_stats'))).toBe(true);

        vi.clearAllMocks();
        useStore.setState((state) => ({
            computeSettings: {
                ...state.computeSettings,
                protocol: 'openai-image',
                imageApiEndpoint: 'http://localhost:8001/v1',
                imageApiKey: 'secret',
                imageApiModel: 'Qwen-Image-2.1',
            },
        }));

        expect(await renderService.checkConnection()).toBe(true);
        const urls = calledUrls(fetchMock);
        expect(urls.some((url) => url.includes('/models'))).toBe(true);
        expect(urls.some((url) => url.includes('/system_stats'))).toBe(false);
    });
});
