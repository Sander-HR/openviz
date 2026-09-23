import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TextWorkbenchNode } from '@/types';
import { useStore } from '@/store/useStore';
import { useAutoSaveScene } from './useAutoSaveScene';

// Isolate the autosave layer: no IndexedDB durability net, no immediate-flush bus.
vi.mock('@/services/workbench/pendingSceneStore', () => ({
    getPendingScene: vi.fn().mockResolvedValue(null),
    setPendingScene: vi.fn().mockResolvedValue(undefined),
    clearPendingScene: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/workbench/sceneSyncBus', () => ({
    onImmediateSceneSaveRequested: vi.fn(() => () => undefined),
    requestImmediateSceneSave: vi.fn(),
}));

const PROJECT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const AUTOSAVE_DELAY_MS = 1_300; // debounce is 1000ms

function textNode(id: string, x: number, y: number): TextWorkbenchNode {
    return { id, type: 'text', x, y, data: { text: id, fontSize: 14, color: '#fff' } };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('useAutoSaveScene single-writer rule (FR-012)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        useStore.setState({
            currentProjectId: PROJECT_ID,
            workbenchNodes: [textNode('n1', 0, 0)],
            connections: [],
            sceneHydrated: true,
            currentSceneVersion: 3,
            collabSessionActive: false,
        });

        fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/scenes') && !url.includes('PATCH')) {
                // Version bootstrap GET.
                return new Response(JSON.stringify([{ version: 3, isMain: true }]), { status: 200 });
            }
            return new Response(JSON.stringify({ version: 4 }), { status: 200 });
        });
        vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const patchCalls = () => fetchMock.mock.calls.filter((call) => call[1]?.method === 'PATCH');

    it('issues no JSON PATCH autosave while a collab session is active', async () => {
        useStore.setState({ collabSessionActive: true });

        renderHook(() => useAutoSaveScene(PROJECT_ID));

        // Local edits while the room is active must NOT trigger single-user saves.
        useStore.setState({ workbenchNodes: [textNode('n1', 10, 10)] });
        await sleep(AUTOSAVE_DELAY_MS);
        expect(patchCalls()).toHaveLength(0);

        // Even a second burst of edits stays silent.
        useStore.setState({ workbenchNodes: [textNode('n1', 20, 20), textNode('n2', 30, 30)] });
        await sleep(AUTOSAVE_DELAY_MS);
        expect(patchCalls()).toHaveLength(0);
    });

    it('resumes the single-user autosave path unchanged after the session closes', async () => {
        renderHook(() => useAutoSaveScene(PROJECT_ID));

        // Session was active on mount, then closed.
        useStore.setState({ collabSessionActive: true });
        useStore.setState({ workbenchNodes: [textNode('n1', 5, 5)] });
        await sleep(AUTOSAVE_DELAY_MS);
        expect(patchCalls()).toHaveLength(0);

        useStore.setState({ collabSessionActive: false });
        useStore.setState({ workbenchNodes: [textNode('n1', 6, 6)] });
        await sleep(AUTOSAVE_DELAY_MS);

        const patches = patchCalls();
        expect(patches).toHaveLength(1);
        const body = JSON.parse(String(patches[0][1]?.body)) as {
            data: { nodes: Array<{ id: string }> };
            expectedVersion?: number;
        };
        expect(body.data.nodes.map((n) => n.id)).toEqual(['n1']);
        expect(body.expectedVersion).toBe(3); // 409/version machinery untouched
    });

    it('does not PATCH on unmount while a collab session is still active', async () => {
        useStore.setState({ collabSessionActive: true });

        const { unmount } = renderHook(() => useAutoSaveScene(PROJECT_ID));
        unmount(); // unmount flush path

        await sleep(50);
        expect(patchCalls()).toHaveLength(0);
    });
});
