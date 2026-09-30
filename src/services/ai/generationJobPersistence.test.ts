import { describe, expect, it } from 'vitest';
import type { GenerationJob } from '@/types/generationJob.types';
import { createGenerationJobPersistence, type GenerationJobRepository } from './generationJobPersistence';

const job: GenerationJob = {
    id: '00000000-0000-0000-0000-000000000001',
    projectId: '00000000-0000-0000-0000-000000000002',
    workflowId: 'product_concept',
    workflowVersion: '1.0.0',
    targetId: 'local',
    targetKind: 'local',
    modelTier: 'fp8',
    prompt: 'A modular speaker',
    references: [],
    parameters: { aspectRatio: '1:1', batchSize: 2 },
    status: 'queued',
    progress: 0,
    outputs: [],
    createdAt: 1,
    updatedAt: 1,
};

describe('generation job persistence', () => {
    it('persists inputs before submission and reloads complete lineage', async () => {
        const records = new Map<string, Parameters<GenerationJobRepository['insert']>[0]>();
        const repository: GenerationJobRepository = {
            insert: async (record) => { records.set(record.id, record); },
            update: async (id, updates) => {
                const current = records.get(id);
                if (current) records.set(id, { ...current, ...updates });
            },
            find: async (id) => records.get(id),
        };
        const persistence = createGenerationJobPersistence(repository);

        await persistence.create(job);
        await persistence.update(job.id, { status: 'failed', retryOf: 'original-job' });
        const restored = await persistence.get(job.id);

        expect(restored).toMatchObject({
            id: job.id,
            prompt: job.prompt,
            status: 'failed',
            retryOf: 'original-job',
        });
        expect(records.get(job.id)?.metadata.references).toEqual([]);
    });

    it('rejects jobs without a project id because durable jobs are project-owned', async () => {
        const repository: GenerationJobRepository = {
            insert: async () => undefined,
            update: async () => undefined,
            find: async () => undefined,
        };
        const persistence = createGenerationJobPersistence(repository);

        await expect(persistence.create({ ...job, projectId: undefined })).rejects.toThrow('projectId');
    });
});
