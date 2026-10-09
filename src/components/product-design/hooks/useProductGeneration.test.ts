import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ExecutionTargetAdapter } from '@/types/executionTarget.types';
import { useProductGeneration } from './useProductGeneration';

const adapter: ExecutionTargetAdapter = {
    health: async () => ({ targetId: 'local', status: 'ready', capabilities: null }),
    capabilities: async () => ({ checkedAt: 1, devices: [], customNodes: [], availableModels: [], availableNodeTypes: [], supportedPrecisions: ['unknown'], supportedWorkflows: [] }),
    preflight: async () => ({ ready: true, status: 'ready', issues: [] }),
    submit: async () => ({ jobId: 'remote-1', targetId: 'local' }),
    getStatus: async () => ({ jobId: 'remote-1', status: 'queued', progress: 0 }),
    cancel: async () => undefined,
    getOutputs: async () => [],
};

describe('useProductGeneration', () => {
    it('submits a concept and exposes it through product job state', async () => {
        const { result } = renderHook(() => useProductGeneration({ adapter, targetKind: 'local' }));
        await act(async () => {
            await result.current.generateConcept({ prompt: 'A desk lamp', aspectRatio: '1:1', width: 1024, height: 1024, batchSize: 1 });
        });
        expect(Object.values(result.current.jobs)).toHaveLength(1);
        expect(Object.values(result.current.jobs)[0]?.status).toBe('queued');
    });

    it('persists project-owned concept submissions through the jobs API', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 201, json: async () => ({ jobId: 'remote-1' }) }));
        vi.stubGlobal('fetch', fetchMock);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const { result } = renderHook(() => useProductGeneration({ adapter, targetKind: 'local', projectId: 'project-1' }));
            await act(async () => {
                await result.current.generateConcept({ prompt: 'A desk lamp', aspectRatio: '1:1', width: 1024, height: 1024, batchSize: 1 });
            });
            expect(fetchMock).toHaveBeenCalled();
            const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
            expect(url).toMatch(/^\/api\/jobs\//);
            expect(init.method).toBe('POST');
            expect(String(init.body)).toContain('"projectId":"project-1"');
        } finally {
            consoleSpy.mockRestore();
            vi.unstubAllGlobals();
        }
    });
});
