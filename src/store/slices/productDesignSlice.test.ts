import { describe, expect, it } from 'vitest';
import type { GenerationJob } from '@/types/generationJob.types';
import type { ProductReference, ProductVariantSet } from '@/types';
import { useStore } from '../useStore';

const job: GenerationJob = {
    id: 'job-1', workflowId: 'product_edit', workflowVersion: '1.0.0', targetId: 'local', targetKind: 'local', modelTier: 'fp8',
    prompt: 'Change material', references: [{ assetId: 'asset-1', role: 'primary' }], parameters: {}, status: 'queued', progress: 0, outputs: [], createdAt: 1, updatedAt: 1,
};

describe('productDesignSlice', () => {
    it('tracks job lifecycle updates and retains retryable inputs', () => {
        useStore.getState().upsertProductJob(job);
        for (const status of ['running', 'partial', 'completed', 'cancelled'] as const) {
            useStore.getState().updateProductJob('job-1', { status });
            expect(useStore.getState().productJobs['job-1'].status).toBe(status);
        }
        useStore.getState().updateProductJob('job-1', { status: 'failed', error: { code: 'offline', message: 'Target offline', retryable: true } });

        expect(useStore.getState().productJobs['job-1']).toMatchObject({ status: 'failed', prompt: 'Change material', error: { retryable: true } });
    });

    it('stores selected product references and variant-set lineage', () => {
        const reference: ProductReference = { id: 'reference-1', assetId: 'asset-1', role: 'selected-concept', sourceJobId: 'job-1', createdAt: 1 };
        const variantSet: ProductVariantSet = { id: 'variants-1', referenceId: reference.id, variableType: 'material', requestedValues: ['aluminum'], jobIds: ['job-1'], status: 'pending', createdAt: 1, updatedAt: 1 };
        useStore.getState().upsertProductReference(reference);
        useStore.getState().upsertProductVariantSet(variantSet);

        expect(useStore.getState().activeProductReferenceId).toBe(reference.id);
        expect(useStore.getState().productVariantSets[variantSet.id].referenceId).toBe(reference.id);
    });
});
