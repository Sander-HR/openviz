import { describe, expect, it, vi } from 'vitest';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { createHostedComfyTarget } from './hostedComfyTarget';

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept',
    prompt: 'A premium desk lamp',
    references: [],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

describe('createHostedComfyTarget', () => {
    it('passes authentication headers to the hosted ComfyUI target', async () => {
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(new Response(JSON.stringify({ devices: [] }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'hosted-1' }), { status: 200 }));
        const target = createHostedComfyTarget({
            id: 'hosted',
            endpoint: 'https://gpu.example.com',
            token: 'secret-token',
            fetcher,
        });

        await target.health();
        await target.submit(request);

        expect(fetcher).toHaveBeenLastCalledWith('https://gpu.example.com/prompt', expect.objectContaining({
            headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
        }));
    });
});
