import { describe, expect, it, vi } from 'vitest';
import { createApiTaskRecordRepository } from '@/services/renderTaskRepository';
import type { TaskRecord } from '@/types/renderTask.types';

const RECORD: TaskRecord = {
    id: '01JTEST',
    projectId: null,
    kind: 'modify',
    request: { kind: 'modify', prompt: 'make the base matte black', referenceImageId: 'img-1' },
    resolved: { workflow: 'edit', prompt: 'p', seeds: [7], benchmarkStatus: 'starting' },
    protocol: 'openai-compatible',
    modelFamily: 'qwen-image-edit-2511',
    status: 'queued',
    queuePositionAtSubmit: 1,
    error: null,
    outputIds: [],
    createdAt: 1,
    updatedAt: 1,
};

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

function okFetcher(): FetchMock {
    return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response('{}', { status: 200 }));
}

describe('createApiTaskRecordRepository (T007, FR-019)', () => {
    it('POSTs the full record and PATCHes terminal updates', async () => {
        const fetcher = okFetcher();
        const repo = createApiTaskRecordRepository('/api/render-tasks', fetcher);

        await repo.create(RECORD);
        await repo.update('01JTEST', { status: 'completed', outputIds: ['out-1'], error: null });

        expect(fetcher).toHaveBeenCalledTimes(2);
        const [createUrl, createInit] = fetcher.mock.calls[0];
        expect(createUrl).toBe('/api/render-tasks');
        expect((createInit as RequestInit).method).toBe('POST');
        expect(JSON.parse((createInit as RequestInit).body as string)).toEqual({ record: RECORD });

        const [updateUrl, updateInit] = fetcher.mock.calls[1];
        expect(updateUrl).toBe('/api/render-tasks/01JTEST');
        expect((updateInit as RequestInit).method).toBe('PATCH');
        expect(JSON.parse((updateInit as RequestInit).body as string)).toEqual({ status: 'completed', outputIds: ['out-1'], error: null });
    });

    it('surfaces the API error message on failure', async () => {
        const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ error: 'A valid task record is required.' }), { status: 400 }));
        const repo = createApiTaskRecordRepository('/api/render-tasks', fetcher);

        await expect(repo.create(RECORD)).rejects.toThrow('A valid task record is required.');
    });
});
