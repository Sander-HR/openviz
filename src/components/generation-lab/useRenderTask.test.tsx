import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRenderTask } from '@/components/generation-lab/useRenderTask';
import { useStore } from '@/store/useStore';
import type { RenderTaskService, RenderTaskResult } from '@/services/renderTaskService';
import type { RenderTaskRequest } from '@/types/renderTask.types';

const REQUEST: RenderTaskRequest = { kind: 'modify', prompt: 'make the base matte black', referenceImageId: 'ref-1' };

function resetStore() {
    const store = useStore.getState();
    store.resetRenderTask();
    store.setLastRenderRequest(null);
}

function makeService(result: RenderTaskResult, submitError?: Error): RenderTaskService {
    return {
        submit: vi.fn(async () => {
            if (submitError) throw submitError;
            const id = 'task-1';
            return {
                id,
                recordId: 'record-1',
                promise: Promise.resolve(result),
            };
        }),
        cancel: vi.fn(),
        getStatus: vi.fn(() => result.allOutputsSucceeded ? 'completed' : 'failed'),
        getError: vi.fn(() => (result.allOutputsSucceeded ? null : 'The image backend returned no outputs.')),
        getQueuePosition: vi.fn(() => null),
    } as unknown as RenderTaskService;
}

describe('useRenderTask (T009, Constitution III)', () => {
    beforeEach(resetStore);

    it('submits through the service and lands the outputs in the store', async () => {
        const result: RenderTaskResult = { outputIds: ['o1'], allOutputsSucceeded: true, outputs: [{ id: 'o1', url: 'data:image/png;base64,eA==', seed: 7 }] };
        const service = makeService(result);
        const { result: api } = renderHook(() => useRenderTask(service));

        act(() => api.current.submit(REQUEST));

        await waitFor(() => expect(useStore.getState().renderTaskStatus).toBe('completed'));
        expect(useStore.getState().renderRecordId).toBe('record-1');
        expect(useStore.getState().renderTaskOutputs).toEqual([{ id: 'o1', url: 'data:image/png;base64,eA==', seed: 7 }]);
        expect(useStore.getState().lastRenderRequest).toEqual(REQUEST);
    });

    it('surfaces submission rejections (validation / gate / capability) as a failed state with the reason', async () => {
        const service = makeService({ outputIds: [], allOutputsSucceeded: false, outputs: [] }, new Error('A reference image is required for every render task.'));
        const { result: api } = renderHook(() => useRenderTask(service));

        act(() => api.current.submit(REQUEST));

        await waitFor(() => expect(useStore.getState().renderTaskStatus).toBe('failed'));
        expect(useStore.getState().renderTaskError).toContain('A reference image is required');
    });

    it('blocks submission when no image backend is configured and keeps the request for retry (T031, spec edge case)', async () => {
        const previousSettings = useStore.getState().computeSettings;
        useStore.setState((state) => ({ computeSettings: { ...state.computeSettings, protocol: 'openai-image', imageApiEndpoint: '' } }));
        try {
            const service = makeService({ outputIds: [], allOutputsSucceeded: true, outputs: [] });
            const { result: api } = renderHook(() => useRenderTask(service));

            act(() => api.current.submit(REQUEST));

            await waitFor(() => expect(useStore.getState().renderTaskStatus).toBe('failed'));
            expect(service.submit).not.toHaveBeenCalled();
            expect(useStore.getState().renderTaskError).toContain('AI not ready');
            // Queued user input is preserved for retry once a backend is configured.
            expect(useStore.getState().lastRenderRequest).toEqual(REQUEST);
        } finally {
            useStore.setState({ computeSettings: previousSettings });
        }
    });

    it('cancels the active task through the service', async () => {
        let resolveResult: (result: RenderTaskResult) => void = () => undefined;
        const pending = new Promise<RenderTaskResult>((resolve) => {
            resolveResult = resolve;
        });
        const service = {
            submit: vi.fn(async () => ({ id: 'task-1', recordId: 'record-1', promise: pending })),
            cancel: vi.fn(),
            getStatus: vi.fn(() => 'cancelled'),
            getError: vi.fn(() => null),
            getQueuePosition: vi.fn(() => 1),
        } as unknown as RenderTaskService;
        const { result: api } = renderHook(() => useRenderTask(service));

        act(() => api.current.submit(REQUEST));
        await waitFor(() => expect(useStore.getState().renderTaskStatus).toBe('queued'));

        act(() => api.current.cancel());
        expect(service.cancel).toHaveBeenCalledWith('task-1');

        resolveResult({ outputIds: [], allOutputsSucceeded: false, outputs: [] });
        await waitFor(() => expect(useStore.getState().renderTaskStatus).toBe('cancelled'));
    });

    it('retries with the last submitted request', async () => {
        const result: RenderTaskResult = { outputIds: [], allOutputsSucceeded: false, outputs: [] };
        const service = makeService(result);
        const { result: api } = renderHook(() => useRenderTask(service));

        act(() => api.current.submit(REQUEST));
        await waitFor(() => expect(useStore.getState().renderTaskStatus).toBe('failed'));

        act(() => api.current.retry());
        expect(service.submit).toHaveBeenCalledTimes(2);
        expect(service.submit).toHaveBeenLastCalledWith(REQUEST);
    });

    it('regenerates locked to an output seed with a single-output request (SC-008)', async () => {
        const result: RenderTaskResult = { outputIds: ['o1'], allOutputsSucceeded: true, outputs: [{ id: 'o1', url: 'data:image/png;base64,eA==', seed: 42 }] };
        const service = makeService(result);
        const { result: api } = renderHook(() => useRenderTask(service));

        act(() => api.current.submit({ ...REQUEST, variationCount: 4 }));
        await waitFor(() => expect(useStore.getState().renderTaskStatus).toBe('completed'));

        act(() => api.current.regenerateWithSeed('o1'));
        expect(service.submit).toHaveBeenLastCalledWith({ ...REQUEST, variationCount: undefined, seed: 42 });
    });
});
