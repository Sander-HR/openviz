import { describe, expect, it } from 'vitest';
import type { ExecutionTargetAdapter, TargetHealth } from '@/types/executionTarget.types';
import type { ProductWorkflowRequest } from '@/types/productWorkflow.types';
import { createHybridTarget } from './hybridTarget';

const request: ProductWorkflowRequest = {
    workflowId: 'product_concept',
    prompt: 'A modular speaker',
    references: [],
    width: 1024,
    height: 1024,
    batchSize: 1,
    parameters: {},
};

function fakeTarget(id: string, status: TargetHealth['status']): ExecutionTargetAdapter {
    return {
        health: async () => ({ targetId: id, status, capabilities: null }),
        capabilities: async () => ({
            checkedAt: Date.now(), devices: [], customNodes: [], availableModels: [], availableNodeTypes: [],
            supportedPrecisions: ['unknown'], supportedWorkflows: [],
        }),
        preflight: async () => ({ ready: true, status: 'ready', issues: [] }),
        submit: async () => ({ jobId: `${id}-job`, targetId: id }),
        getStatus: async () => ({ jobId: `${id}-job`, status: 'completed', progress: 100 }),
        cancel: async () => undefined,
        getOutputs: async () => [],
    };
}

describe('createHybridTarget', () => {
    it('uses local execution when local health is ready', async () => {
        const target = createHybridTarget(fakeTarget('local', 'ready'), fakeTarget('hosted', 'ready'));
        expect(await target.submit(request)).toEqual({ jobId: 'local-job', targetId: 'local' });
    });

    it('falls back to hosted execution when local is unavailable', async () => {
        const target = createHybridTarget(fakeTarget('local', 'unavailable'), fakeTarget('hosted', 'ready'));
        expect(await target.submit(request)).toEqual({ jobId: 'hosted-job', targetId: 'hosted' });
    });
});
