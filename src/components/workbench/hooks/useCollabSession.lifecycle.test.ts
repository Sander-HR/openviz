import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { SceneDataJson } from '@/types/collab.types';
import type { TextWorkbenchNode } from '@/types';
import { createSceneDoc, seedSceneFromJson, extractSceneFromDoc, jsonToYValue } from '@/services/collab/sceneDocMapping';
import { useCollabSession } from './useCollabSession';
import { useStore } from '@/store/useStore';
import type { UseCollabSessionOptions } from './useCollabSession';
import { PROJECT_ID, OTHER_PROJECT_ID, FakeProvider, seedOptions } from './useCollabSession.testUtils';

describe('useCollabSession lifecycle', () => {
    it('stays idle and never fetches a token without a project', async () => {
        const options = seedOptions({ projectId: null });
        const { result } = renderHook(() => useCollabSession(options));

        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(options.getToken).not.toHaveBeenCalled();
        expect(FakeProvider.instances).toHaveLength(0);
    });

    it('fetches a room token and joins the scene room named by the main scene ID', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));

        await waitFor(() => expect(result.current.status).toBe('connected'));
        expect(options.getToken).toHaveBeenCalledWith(PROJECT_ID);
        expect(FakeProvider.instances).toHaveLength(1);
        expect(FakeProvider.instances[0].config).toMatchObject({
            url: 'ws://localhost:1234',
            token: 'tok.abc',
            name: 'scene-main-1',
        });
    });

    it('keeps online collaboration available but reports non-durable offline state when IndexedDB is unavailable', async () => {
        const doc = createSceneDoc();
        const options = seedOptions({
            createProvider: (request) => {
                const provider = new FakeProvider(request as unknown as Record<string, unknown>);
                return {
                    provider,
                    doc,
                    origin: `user:${request.userId}`,
                    connect: () => provider.connect(),
                    disconnect: () => provider.disconnect(),
                    localPersistenceAvailable: false,
                    localStoreReady: Promise.reject(new Error('IndexedDB unavailable')),
                    destroy: () => { provider.destroy(); doc.destroy(); },
                };
            },
        });
        const { result } = renderHook(() => useCollabSession(options));

        await waitFor(() => expect(result.current.status).toBe('connected'));
        expect(result.current.localPersistenceAvailable).toBe(false);
        act(() => FakeProvider.instances[0].emitStatus('disconnected'));
        await waitFor(() => expect(result.current.status).toBe('offline-unpersisted'));
    });

    it('waits for local IndexedDB restoration before connecting the provider', async () => {
        let finishRestore: (() => void) | null = null;
        const localStoreReady = new Promise<void>((resolve) => { finishRestore = resolve; });
        const doc = createSceneDoc();
        const options = seedOptions({
            createProvider: (request) => {
                const provider = new FakeProvider(request as unknown as Record<string, unknown>);
                return {
                    provider,
                    doc,
                    origin: `user:${request.userId}`,
                    connect: () => provider.connect(),
                    disconnect: () => provider.disconnect(),
                    localStoreReady,
                    destroy: () => { provider.destroy(); doc.destroy(); },
                };
            },
        });
        const { result } = renderHook(() => useCollabSession(options));

        await waitFor(() => expect(FakeProvider.instances).toHaveLength(1));
        expect(FakeProvider.instances[0].connectCalls).toBe(0);
        expect(result.current.doc).toBeNull();

        act(() => finishRestore?.());
        await waitFor(() => expect(result.current.status).toBe('connected'));
        expect(FakeProvider.instances[0].connectCalls).toBe(1);
    });

    it('projects the shared document into the workbench store once connected', async () => {
        // Real persisted shape: flat x/y, from/to connections. image→render is
        // the only direction the connection policy allows.
        const scene: SceneDataJson = {
            nodes: [
                { id: 'n2', type: 'render', x: 5, y: 6, data: {} },
                { id: 'n1', type: 'image', x: 1, y: 2, data: { alt: 'a' } },
            ],
            connections: [{ id: 'c1', from: 'n1', to: 'n2' }],
        };
        const doc = createSceneDoc();
        seedSceneFromJson(doc, scene);
        const options = seedOptions({}, doc);

        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        const state = useStore.getState();
        expect(state.workbenchNodes.map((n) => n.id)).toEqual(['n1', 'n2']); // canonical ID order
        expect(state.connections).toHaveLength(1);
        expect(state.connections[0]).toMatchObject({ id: 'c1', from: 'n1', to: 'n2' });
        expect(state.collabSessionActive).toBe(true);
    });

    it('projects remote document changes into the store', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'n1', x: 0, y: 0 }], connections: [] });
        const options = seedOptions({}, doc);

        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));
        expect(useStore.getState().workbenchNodes.map((n) => n.id)).toEqual(['n1']);

        // A peer adds a node (different origin).
        act(() => {
            doc.transact(() => {
                const nodes = doc.getMap('nodes');
                nodes.set('n9', jsonToYValue({ id: 'n9', x: 42, y: 43 }));
            }, 'user:bob');
        });

        await waitFor(() => {
            expect(useStore.getState().workbenchNodes.map((n) => n.id).sort()).toEqual(['n1', 'n9']);
        });
    });

    it('keeps a mid-gesture node at its transient position when a remote update arrives', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, {
            nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n2', x: 5, y: 5 }],
            connections: [],
        });
        const options = seedOptions({}, doc);

        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        // Simulate an in-progress drag on n1: transient position is already in the store.
        act(() => {
            useStore.setState({
                workbenchNodes: useStore.getState().workbenchNodes.map((node) =>
                    node.id === 'n1' ? { ...node, x: 50, y: 51 } : node
                ),
                activeWorkbenchGesture: {
                    kind: 'move',
                    projectId: PROJECT_ID,
                    startedAt: Date.now(),
                    startSnapshot: { workbenchNodes: [], connections: [], selectedNodeIds: [], activeNodeId: null },
                    affectedNodeIds: ['n1'],
                },
            });
        });

        // A peer moves n2; the doc still holds n1's pre-drag position.
        act(() => {
            doc.transact(() => {
                const nodes = doc.getMap('nodes');
                (nodes.get('n2') as { set(key: string, value: unknown): void }).set('x', 9);
            }, 'user:bob');
        });

        await waitFor(() => {
            expect(useStore.getState().workbenchNodes.find((node) => node.id === 'n2')?.x).toBe(9);
        });
        // The dragged node must not snap back to its pre-drag position.
        expect(useStore.getState().workbenchNodes.find((node) => node.id === 'n1')?.x).toBe(50);
    });

    it('does not promote local store-only graph changes into the shared document', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'n1', x: 0, y: 0 }], connections: [] });
        const options = seedOptions({}, doc);

        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        act(() => {
            const moved: TextWorkbenchNode = {
                id: 'n1',
                type: 'text',
                x: 7,
                y: 8,
                data: { text: 'moved', fontSize: 14, color: '#fff' },
            };
            useStore.getState().setWorkbenchNodes([moved]);
        });

        expect(useStore.getState().workbenchNodes[0].x).toBe(0);
        expect(useStore.getState().workbenchNodes[0].y).toBe(0);
        expect(extractSceneFromDoc(doc).nodes[0]).toMatchObject({ x: 0, y: 0 });
    });

    it('tears down the old session on project switch and everything on unmount', async () => {
        const options = seedOptions();
        const { result, rerender, unmount } = renderHook((props: UseCollabSessionOptions) => useCollabSession(props), {
            initialProps: options,
        });

        await waitFor(() => expect(result.current.status).toBe('connected'));
        const firstProvider = FakeProvider.instances[0];

        // Project switch destroys the old session and joins the new project's room.
        rerender(seedOptions({ projectId: OTHER_PROJECT_ID }));
        await waitFor(() => expect(FakeProvider.instances).toHaveLength(2));
        expect(firstProvider.destroyed).toBe(true);
        await waitFor(() => expect(result.current.status).toBe('connected'));

        // Unmount tears down the remaining session.
        unmount();
        expect(FakeProvider.instances[1].destroyed).toBe(true);
    });

    it('reconnects when the tab becomes visible while disconnected (frozen-tab recovery)', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));
        const provider = FakeProvider.instances[0];
        const initialConnectCalls = provider.connectCalls;

        // The transport drops (e.g. the tab was frozen long enough to exhaust
        // retries). Once synced, a drop means offline-queued (US3), not a cold
        // reconnect.
        act(() => {
            provider.emitStatus('disconnected');
        });
        await waitFor(() => expect(result.current.status).toBe('offline-queued'));

        // Coming back to the tab must re-trigger the connection so the
        // state-vector sync can deliver everything missed while away.
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(provider.connectCalls).toBeGreaterThan(initialConnectCalls);
    });

    it('reports reconnecting while a previously synced provider is reconnecting', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        act(() => FakeProvider.instances[0].emitStatus('connecting'));

        await waitFor(() => expect(result.current.status).toBe('reconnecting'));
    });

    it('marks the session failed when the provider exhausts its retries', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        act(() => {
            FakeProvider.instances[0].emitMaxAttemptsFailed();
        });

        await waitFor(() => expect(result.current.status).toBe('failed'));
    });
});
