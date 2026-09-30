import { describe, expect, it, vi } from 'vitest';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { createLocalComfyTarget } from './localComfyTarget';

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept',
    prompt: 'A compact air purifier',
    references: [],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

describe('createLocalComfyTarget', () => {
    it('normalizes health and submits a prompt through the ComfyUI API', async () => {
        const fetcher = vi.fn<typeof fetch>();
        fetcher
            .mockResolvedValueOnce(new Response(JSON.stringify({ devices: [] }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'prompt-1' }), { status: 200 }));
        const target = createLocalComfyTarget({ id: 'local', endpoint: 'http://localhost:8188', fetcher });

        const health = await target.health();
        expect(health.status).toBe('ready');
        const submitted = await target.submit(request);
        expect(submitted).toEqual({ jobId: 'prompt-1', targetId: 'local' });
        const submitCall = fetcher.mock.calls[2];
        expect(submitCall?.[0]).toBe('http://localhost:8188/prompt');
        const submitInit = submitCall?.[1];
        expect(submitInit?.method).toBe('POST');
        const submittedBody = JSON.parse(String(submitInit?.body)) as {
            prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
            client_id?: string;
        };
        expect(Object.values(submittedBody.prompt).find((node) => node.class_type === 'CLIPTextEncode')?.inputs.text).toBe(request.prompt);
        expect(Object.values(submittedBody.prompt).find((node) => node.class_type === 'KSampler')?.inputs.seed).toEqual(expect.any(Number));
        expect(submittedBody.client_id).toBe('openviz-product-design');
    });

    it('normalizes history status and image outputs', async () => {
        const historyResponse = () => new Response(JSON.stringify({
            'prompt-1': {
                status: { status_str: 'success' },
                outputs: { save_image: { images: [{ filename: 'result.png', subfolder: '', type: 'output' }] } },
            },
        }), { status: 200 });
        const fetcher = vi.fn<typeof fetch>()
            .mockImplementation(async () => historyResponse());
        const target = createLocalComfyTarget({ id: 'local', endpoint: 'http://localhost:8188', fetcher });

        await expect(target.getStatus('prompt-1')).resolves.toMatchObject({ status: 'completed', progress: 100 });
        await expect(target.getOutputs('prompt-1')).resolves.toEqual([{ url: 'http://localhost:8188/view?filename=result.png&subfolder=&type=output', index: 0, contentType: 'image/png' }]);
    });

    it('returns an unavailable health state when the endpoint fails', async () => {
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
        const target = createLocalComfyTarget({ id: 'local', endpoint: 'http://localhost:8188', fetcher });
        const health = await target.health();
        expect(health.status).toBe('unavailable');
        expect(health.message).toContain('offline');
    });
});
