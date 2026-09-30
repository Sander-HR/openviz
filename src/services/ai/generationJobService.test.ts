import { describe, expect, it, vi } from 'vitest';
import type { ExecutionTargetAdapter } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { cancelProductWorkflow, pollProductWorkflow, submitProductWorkflow } from './generationJobService';

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept', prompt: 'A modular speaker', references: [], width: 1024, height: 1024, batchSize: 1, parameters: {},
};

const projectRequest: ProductWorkflowRequest = { ...request, projectId: 'project-1' };

function fakePersistence() {
    return {
        create: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
        get: vi.fn(async () => undefined),
    };
}

function adapter(preflightReady: boolean): ExecutionTargetAdapter {
    return {
        health: async () => ({ targetId: 'local', status: 'ready', capabilities: null }),
        capabilities: async () => ({ checkedAt: 1, devices: [], customNodes: [], availableModels: [], availableNodeTypes: [], supportedPrecisions: ['unknown'], supportedWorkflows: [] }),
        preflight: async () => ({ ready: preflightReady, status: preflightReady ? 'ready' : 'missing', issues: preflightReady ? [] : [{ code: 'missing', message: 'Missing model' }] }),
        submit: async () => ({ jobId: 'remote-1', targetId: 'local' }),
        getStatus: async () => ({ jobId: 'remote-1', status: 'queued', progress: 0 }),
        cancel: async () => undefined,
        getOutputs: async () => [],
    };
}

describe('submitProductWorkflow', () => {
    it('submits only after preflight and returns a queued job', async () => {
        const result = await submitProductWorkflow(adapter(true), request, 'local');
        expect(result.status).toBe('queued');
        expect(result.remoteJobId).toBe('remote-1');
    });

    it('returns a failed job draft when preflight is not ready', async () => {
        const result = await submitProductWorkflow(adapter(false), request, 'local');
        expect(result.status).toBe('failed');
        expect(result.error?.retryable).toBe(true);
        expect(result.prompt).toBe(request.prompt);
    });

    it('retains inputs when adapter submission fails', async () => {
        const failingAdapter = { ...adapter(true), submit: async () => { throw new Error('ComfyUI is offline.'); } };
        const result = await submitProductWorkflow(failingAdapter, request, 'local');
        expect(result.status).toBe('failed');
        expect(result.error).toMatchObject({ message: 'ComfyUI is offline.', retryable: true });
    });

    it('normalizes terminal status and outputs', async () => {
        const result = await submitProductWorkflow(adapter(true), request, 'local');
        const synced = await pollProductWorkflow(adapter(true), result);
        expect(synced).toMatchObject({ status: 'queued', progress: 0 });
    });

    it('cancels a submitted remote job', async () => {
        const cancel = vi.fn(async () => undefined);
        const remoteAdapter = { ...adapter(true), cancel };
        const result = await submitProductWorkflow(remoteAdapter, request, 'local');
        const cancelled = await cancelProductWorkflow(remoteAdapter, result);
        expect(cancel).toHaveBeenCalledWith('remote-1');
        expect(cancelled).toMatchObject({ status: 'cancelled', progress: 0 });
    });

    it('creates a durable record before queue submission', async () => {
        const persistence = fakePersistence();
        const order: string[] = [];
        persistence.create.mockImplementation(async () => { order.push('create'); });
        const trackingAdapter = {
            ...adapter(true),
            submit: async () => { order.push('submit'); return { jobId: 'remote-1', targetId: 'local' }; },
        };
        await submitProductWorkflow(trackingAdapter, projectRequest, 'local', undefined, { persistence });
        expect(order).toEqual(['create', 'submit']);
        expect(persistence.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued', prompt: request.prompt, projectId: 'project-1' }));
    });

    it('retains a failed preflight in the durable record', async () => {
        const persistence = fakePersistence();
        const result = await submitProductWorkflow(adapter(false), projectRequest, 'local', undefined, { persistence });
        expect(result.status).toBe('failed');
        expect(persistence.update).toHaveBeenCalledWith(result.id, expect.objectContaining({ status: 'failed' }));
    });

    it('retains a submission failure in the durable record', async () => {
        const persistence = fakePersistence();
        const failingAdapter = { ...adapter(true), submit: async () => { throw new Error('ComfyUI is offline.'); } };
        const result = await submitProductWorkflow(failingAdapter, projectRequest, 'local', undefined, { persistence });
        expect(result.status).toBe('failed');
        expect(persistence.update).toHaveBeenCalledWith(result.id, expect.objectContaining({ status: 'failed', error: expect.objectContaining({ message: 'ComfyUI is offline.' }) }));
    });

    it('persists the remote job id after successful submission', async () => {
        const persistence = fakePersistence();
        await submitProductWorkflow(adapter(true), projectRequest, 'local', undefined, { persistence });
        expect(persistence.update).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ remoteJobId: 'remote-1' }));
    });

    it('continues submitting when durable persistence fails', async () => {
        const failingPersistence = { ...fakePersistence(), create: vi.fn(async () => { throw new Error('db down'); }), update: vi.fn(async () => { throw new Error('db down'); }) };
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const result = await submitProductWorkflow(adapter(true), projectRequest, 'local', undefined, { persistence: failingPersistence });
            expect(result.status).toBe('queued');
            expect(result.remoteJobId).toBe('remote-1');
        } finally {
            consoleSpy.mockRestore();
        }
    });

    it('skips durable persistence for jobs without a project', async () => {
        const persistence = fakePersistence();
        await submitProductWorkflow(adapter(true), request, 'local', undefined, { persistence });
        expect(persistence.create).not.toHaveBeenCalled();
        expect(persistence.update).not.toHaveBeenCalled();
    });

    it('persists terminal outputs when polling reports completion', async () => {
        const persistence = fakePersistence();
        const doneAdapter = {
            ...adapter(true),
            getStatus: async () => ({ jobId: 'remote-1', status: 'completed' as const, progress: 100 }),
            getOutputs: async () => [{ url: '/img/1.png', index: 0 }],
        };
        const submitted = await submitProductWorkflow(doneAdapter, projectRequest, 'local', undefined, { persistence });
        persistence.update.mockClear();
        await pollProductWorkflow(doneAdapter, submitted, { persistence });
        expect(persistence.update).toHaveBeenCalledWith(submitted.id, expect.objectContaining({ status: 'completed', outputs: [{ url: '/img/1.png', index: 0 }] }));
    });

    it('persists cancellation in the durable record', async () => {
        const persistence = fakePersistence();
        const result = await submitProductWorkflow(adapter(true), projectRequest, 'local', undefined, { persistence });
        persistence.update.mockClear();
        await cancelProductWorkflow(adapter(true), result, { persistence });
        expect(persistence.update).toHaveBeenCalledWith(result.id, expect.objectContaining({ status: 'cancelled' }));
    });
});
