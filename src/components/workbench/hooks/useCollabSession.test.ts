import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import * as Y from 'yjs';
import type { CollabTokenResponse, SceneDataJson } from '@/types/collab.types';
import type { TextWorkbenchNode } from '@/types';
import { useStore } from '@/store/useStore';
import { createSceneDoc, seedSceneFromJson, extractSceneFromDoc, jsonToYValue } from '@/services/collab/sceneDocMapping';
import { useCollabSession, type UseCollabSessionOptions } from './useCollabSession';

const PROJECT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER_PROJECT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

/** Minimal stand-in for HocuspocusProvider — records wiring, no network. */
class FakeAwareness {
    clientID = 1;
    local: Record<string, unknown> = {};
    states = new Map<number, Record<string, unknown>>([[1, {}]]);

    getLocal(): Record<string, unknown> {
        return this.local;
    }

    setLocalField(key: string, value: unknown): void {
        this.local[key] = value;
    }

    getStates(): Map<number, Record<string, unknown>> {
        return this.states;
    }
}

type StatusListener = (event: { status: string }) => void;

class FakeProvider {
    static instances: FakeProvider[] = [];
    config: Record<string, unknown>;
    awareness = new FakeAwareness();
    private statusListeners: StatusListener[] = [];
    private syncedListeners: Array<() => void> = [];
    private maxAttemptsFailedListeners: Array<() => void> = [];
    private authenticationFailedListeners: Array<(data: { reason: string }) => void> = [];
    private awarenessUpdateListeners: Array<(data: { states: Array<Record<string, unknown> & { clientId: number }> }) => void> = [];
    destroyed = false;
    connectCalls = 0;

    constructor(config: Record<string, unknown>) {
        this.config = config;
        FakeProvider.instances.push(this);
    }

    on(event: string, listener: StatusListener | (() => void) | ((data: { reason: string }) => void) | ((data: { states: Array<Record<string, unknown> & { clientId: number }> }) => void)): this {
        if (event === 'status') this.statusListeners.push(listener as StatusListener);
        if (event === 'synced') this.syncedListeners.push(listener as () => void);
        if (event === 'maxAttemptsFailed') this.maxAttemptsFailedListeners.push(listener as () => void);
        if (event === 'authenticationFailed') this.authenticationFailedListeners.push(listener as (data: { reason: string }) => void);
        if (event === 'awarenessUpdate') this.awarenessUpdateListeners.push(listener as (data: { states: Array<Record<string, unknown> & { clientId: number }> }) => void);
        return this;
    }

    /** Test helper: simulate the provider reporting a new connection status. */
    emitStatus(status: string): void {
        for (const listener of this.statusListeners) listener({ status });
    }

    /** Test helper: simulate the retry loop giving up. */
    emitMaxAttemptsFailed(): void {
        for (const listener of this.maxAttemptsFailedListeners) listener();
    }

    /** Test helper: simulate the server rejecting the join (SC-006). */
    emitAuthenticationFailed(reason = 'unauthorized'): void {
        for (const listener of this.authenticationFailedListeners) listener({ reason });
    }

    /** Test helper: simulate an awareness snapshot update from the transport. */
    emitAwarenessUpdate(states: Array<Record<string, unknown> & { clientId: number }>): void {
        for (const listener of this.awarenessUpdateListeners) listener({ states });
    }

    setAwarenessField(key: string, value: unknown): void {
        this.awareness.setLocalField(key, value);
    }

    connect(): void {
        this.connectCalls += 1;
        // Report connected, then synced, on later microtasks — like the real transport.
        queueMicrotask(() => this.emitStatus('connected'));
        queueMicrotask(() => {
            for (const listener of this.syncedListeners) listener();
        });
    }

    disconnect(): void {
        /* no-op */
    }

    destroy(): void {
        this.destroyed = true;
    }
}

beforeEach(() => {
    FakeProvider.instances = [];
    vi.restoreAllMocks();
    useStore.setState({
        workbenchNodes: [],
        connections: [],
        activeWorkbenchGesture: null,
        collabSessionActive: false,
    });
});

function seedOptions(overrides: Partial<UseCollabSessionOptions> = {}, doc = createSceneDoc()): UseCollabSessionOptions {
    return {
        projectId: PROJECT_ID,
        userId: 'u-alice',
        userName: 'Alice',
        serverUrl: 'ws://localhost:1234',
        getToken: vi.fn().mockResolvedValue({
            token: 'tok.abc',
            sceneId: 'scene-main-1',
            projectId: PROJECT_ID,
            expiresAt: Date.now() + 300_000,
        } satisfies CollabTokenResponse),
        createProvider: (config) => {
            const provider = new FakeProvider(config as unknown as Record<string, unknown>);
            return { provider, doc, origin: `user:${config.userId}`, destroy: () => provider.destroy() };
        },
        ...overrides,
    };
}

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

    it('pushes local store edits into the shared document with the user origin', async () => {
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

        await waitFor(() => {
            const extracted = extractSceneFromDoc(doc) as SceneDataJson;
            const node = extracted.nodes.find((n) => n.id === 'n1');
            expect(node?.x).toBe(7);
            expect(node?.y).toBe(8);
        });
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

describe('useCollabSession offline queue (US3 / SC-004)', () => {
    it('moves to offline-queued on transport loss and keeps the session owning writes', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        act(() => {
            FakeProvider.instances[0].emitStatus('disconnected');
        });

        await waitFor(() => expect(result.current.status).toBe('offline-queued'));
        // The session still owns this scene's writes — autosave stays suspended,
        // hydration guards stay up, local edits keep flowing into the doc.
        expect(useStore.getState().collabSessionActive).toBe(true);
    });

    it('keeps local edits flowing into the document while queued', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'n1', x: 0, y: 0 }], connections: [] });
        const options = seedOptions({}, doc);
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        act(() => {
            FakeProvider.instances[0].emitStatus('disconnected');
        });
        await waitFor(() => expect(result.current.status).toBe('offline-queued'));

        // Offline edit: store → doc flush must still happen (the doc IS the queue).
        act(() => {
            useStore.getState().setWorkbenchNodes([
                { id: 'n1', type: 'text', x: 0, y: 0, data: { text: 'a', fontSize: 14, color: '#fff' } },
                { id: 'n2', type: 'note', x: 9, y: 9, data: { text: 'offline', colorVariant: 'yellow' } },
            ]);
        });

        expect(doc.getMap('nodes').size).toBe(2);
    });

    it('converges on reconnect: local queued edits + remote edits both survive', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'n1', x: 0, y: 0 }], connections: [] });
        const options = seedOptions({}, doc);
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        // Go offline and queue a local edit (adds n2).
        act(() => {
            FakeProvider.instances[0].emitStatus('disconnected');
        });
        await waitFor(() => expect(result.current.status).toBe('offline-queued'));
        act(() => {
            useStore.getState().setWorkbenchNodes([
                { id: 'n1', type: 'text', x: 0, y: 0, data: { text: 'a', fontSize: 14, color: '#fff' } },
                { id: 'n2', type: 'note', x: 9, y: 9, data: { text: 'offline', colorVariant: 'yellow' } },
            ]);
        });

        // While offline, the server-side scene gained n3 (a peer's edit).
        const remote = createSceneDoc();
        seedSceneFromJson(remote, { nodes: [{ id: 'n1', x: 0, y: 0 }, { id: 'n3', type: 'note', x: 4, y: 4, data: { text: 'remote', colorVariant: 'blue' } }], connections: [] });

        // Reconnect: the transport re-syncs (state-vector exchange delivers the
        // remote update into our doc under a foreign origin).
        act(() => {
            FakeProvider.instances[0].connect();
        });
        await waitFor(() => expect(result.current.status).toBe('connected'));
        act(() => {
            Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote), 'server-sync');
        });

        // Converged: local queued edit (n2) AND remote edit (n3) both present.
        const state = useStore.getState();
        expect(state.workbenchNodes.map((node) => node.id).sort()).toEqual(['n1', 'n2', 'n3']);
    });
});

/** Token-fetch call count for the injected getToken (seedOptions always sets one). */
function tokenCallCount(options: UseCollabSessionOptions): number {
    return options.getToken ? vi.mocked(options.getToken).mock.calls.length : 0;
}

describe('useCollabSession awareness projection (US2 wiring)', () => {
    it('projects remote awareness updates into presence, cursors and soft locks', async () => {
        const options = seedOptions();
        renderHook(() => useCollabSession(options));
        await waitFor(() => expect(useStore.getState().collabSessionActive).toBe(true));

        // A peer (client 7) publishes identity + cursor + a soft lock.
        // The local client's own entry (clientID 1) must be excluded.
        act(() => {
            FakeProvider.instances[0].emitAwarenessUpdate([
                { clientId: 1, user: { id: 'u-alice', name: 'Alice' } },
                { clientId: 7, user: { id: 'u-bob', name: 'Bob' }, cursor: { x: 42, y: 17 }, activeNodeIds: ['n9'], selectedAt: 123 },
            ]);
        });

        const state = useStore.getState();
        expect(Object.keys(state.presenceByUser)).toEqual(['u-bob']);
        expect(state.remoteCursors['7']).toMatchObject({ userId: 'u-bob', userName: 'Bob', x: 42, y: 17 });
        expect(state.nodeLocks['n9']).toMatchObject({ nodeId: 'n9', userId: 'u-bob' });

        // Peer leaves (snapshot no longer contains them) → all derived state clears.
        act(() => {
            FakeProvider.instances[0].emitAwarenessUpdate([
                { clientId: 1, user: { id: 'u-alice', name: 'Alice' } },
            ]);
        });

        expect(useStore.getState().presenceByUser).toEqual({});
        expect(useStore.getState().remoteCursors).toEqual({});
        expect(useStore.getState().nodeLocks).toEqual({});
    });
});

describe('useCollabSession access control (US4 / SC-006)', () => {
    it('moves to denied on authentication failure and never retries the same token', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        // The server rejects the join (e.g. membership was revoked mid-session).
        act(() => {
            FakeProvider.instances[0].emitAuthenticationFailed();
        });

        await waitFor(() => expect(result.current.status).toBe('denied'));
        // No retry with the same token: the rejected provider is stopped…
        expect(FakeProvider.instances[0].destroyed).toBe(true);
        const tokenCalls = tokenCallCount(options);
        await new Promise((resolve) => setTimeout(resolve, 50));
        // …and no fresh join happens on its own.
        expect(tokenCallCount(options)).toBe(tokenCalls);
        expect(FakeProvider.instances).toHaveLength(1);
        // Remote state is cleared — a denied session owns nothing.
        expect(useStore.getState().collabSessionActive).toBe(false);
    });

    it('recovers with a fresh token when retryWithFreshToken is called after denial', async () => {
        const options = seedOptions();
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        act(() => {
            FakeProvider.instances[0].emitAuthenticationFailed();
        });
        await waitFor(() => expect(result.current.status).toBe('denied'));

        // Membership restored (or token refreshed) — explicitly rejoin.
        act(() => {
            result.current.retryWithFreshToken();
        });

        await waitFor(() => expect(result.current.status).toBe('connected'));
        expect(tokenCallCount(options)).toBe(2);
        expect(FakeProvider.instances).toHaveLength(2);
    });
});

