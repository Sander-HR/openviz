import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { create, type StateCreator } from 'zustand';
import { createRenderTaskSlice, type RenderTaskSlice } from '@/store/slices/renderTaskSlice';

// The slice is authored against AppState; this harness stores it standalone.
const standaloneCreator = createRenderTaskSlice as unknown as StateCreator<RenderTaskSlice, [], [], RenderTaskSlice>;

function makeStore() {
    return create<RenderTaskSlice>()(standaloneCreator);
}

describe('renderTaskSlice (T009)', () => {
    it('starts with no references and an idle task', () => {
        const store = makeStore();
        expect(store.getState().renderReferences).toEqual([]);
        expect(store.getState().renderTaskStatus).toBe('idle');
        expect(store.getState().lastRenderRequest).toBeNull();
    });

    it('adds and removes connected references with stable ids', () => {
        const store = makeStore();
        act(() => store.getState().addRenderReference('Arc Lamp', 'data:image/png;base64,aW1n'));
        expect(store.getState().renderReferences).toHaveLength(1);
        expect(store.getState().renderReferences[0]?.name).toBe('Arc Lamp');

        const id = store.getState().renderReferences[0]?.id;
        act(() => store.getState().removeRenderReference(id as string));
        expect(store.getState().renderReferences).toEqual([]);
    });

    it('tracks the active task and its terminal progress updates', () => {
        const store = makeStore();
        act(() => store.getState().setRenderTaskActive('task-1', 'record-1'));
        expect(store.getState().renderTaskStatus).toBe('queued');
        expect(store.getState().renderTaskId).toBe('task-1');
        expect(store.getState().renderRecordId).toBe('record-1');

        act(() => store.getState().setRenderTaskProgress({ status: 'active', queuePosition: 1 }));
        expect(store.getState().renderTaskStatus).toBe('active');

        act(() =>
            store.getState().setRenderTaskProgress({
                status: 'completed',
                queuePosition: null,
                outputs: [{ id: 'out-1', url: 'data:image/png;base64,eA==', seed: 7 }],
            }),
        );
        expect(store.getState().renderTaskOutputs[0]?.seed).toBe(7);

        act(() => store.getState().resetRenderTask());
        expect(store.getState().renderTaskStatus).toBe('idle');
        expect(store.getState().renderTaskOutputs).toEqual([]);
        expect(store.getState().renderTaskError).toBeNull();
    });

    it('keeps the last request for retry and seed-locked regeneration', () => {
        const store = makeStore();
        const request = { kind: 'modify' as const, prompt: 'make the base matte black', referenceImageId: 'ref-1' };
        act(() => store.getState().setLastRenderRequest(request));
        expect(store.getState().lastRenderRequest).toEqual(request);

        act(() => store.getState().resetRenderTask());
        // reset clears task state but keeps the request (retry after failure).
        expect(store.getState().lastRenderRequest).toEqual(request);
    });
});
