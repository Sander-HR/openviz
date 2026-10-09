import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerationJob } from '@/types/generationJob.types';
import { toRecord } from './generationJobPersistence';
import { createApiGenerationJobPersistence, createApiGenerationJobRepository } from './apiGenerationJobRepository';

function makeJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
    return {
        id: 'job-1',
        projectId: 'project-1',
        workflowId: 'product_concept',
        workflowVersion: '1.0.0',
        targetId: 'local',
        targetKind: 'local',
        modelTier: 'hosted-auto',
        prompt: 'A desk lamp',
        references: [],
        parameters: {},
        status: 'queued',
        progress: 0,
        outputs: [],
        createdAt: 1,
        updatedAt: 2,
        ...overrides,
    };
}

function jsonResponse(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('createApiGenerationJobRepository', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('inserts jobs through POST /api/jobs/:id with the job payload', async () => {
        const fetchMock = vi.fn(async () => jsonResponse(201, { jobId: 'job-1' }));
        vi.stubGlobal('fetch', fetchMock);
        await createApiGenerationJobRepository().insert(toRecord(makeJob()));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('/api/jobs/job-1');
        expect(init.method).toBe('POST');
        expect(JSON.parse(String(init.body))).toMatchObject({ job: { id: 'job-1', projectId: 'project-1' } });
    });

    it('updates jobs through PATCH /api/jobs/:id with the merged job payload', async () => {
        const fetchMock = vi.fn(async () => jsonResponse(200, { job: makeJob({ status: 'failed' }) }));
        vi.stubGlobal('fetch', fetchMock);
        await createApiGenerationJobRepository().update('job-1', toRecord(makeJob({ status: 'failed' })));
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('/api/jobs/job-1');
        expect(init.method).toBe('PATCH');
        expect(JSON.parse(String(init.body))).toMatchObject({ job: { id: 'job-1', status: 'failed' } });
    });

    it('reads jobs through GET /api/jobs/:id and maps them back to records', async () => {
        const stored = makeJob({ status: 'completed', outputs: [{ url: '/img/1.png', index: 0 }] });
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, stored)));
        const record = await createApiGenerationJobRepository().find('job-1');
        expect(record).toMatchObject({ id: 'job-1', projectId: 'project-1', status: 'completed', resultUrl: '/img/1.png' });
        expect(record?.metadata).toEqual(stored);
    });

    it('returns undefined for missing or legacy job rows', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(404, { error: 'Not Found' })));
        await expect(createApiGenerationJobRepository().find('missing')).resolves.toBeUndefined();
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { id: 'job-1', type: 'render' })));
        await expect(createApiGenerationJobRepository().find('legacy')).resolves.toBeUndefined();
    });

    it('surfaces server errors with the API message', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(401, { error: 'Unauthorized' })));
        await expect(createApiGenerationJobRepository().insert(toRecord(makeJob()))).rejects.toThrow('Unauthorized');
    });

    it('exposes a persistence facade that creates jobs through the API', async () => {
        const fetchMock = vi.fn(async () => jsonResponse(201, { jobId: 'job-1' }));
        vi.stubGlobal('fetch', fetchMock);
        await createApiGenerationJobPersistence().create(makeJob());
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('/api/jobs/job-1');
        expect(init.method).toBe('POST');
    });
});
