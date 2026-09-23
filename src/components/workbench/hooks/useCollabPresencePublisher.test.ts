import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useStore } from '@/store/useStore';
import type { CollabRemoteAwarenessEntry } from '@/types/collab.types';
import { useCollabPresencePublisher } from './useCollabPresencePublisher';

const USER_ID = 'u-1';
const LOCAL_CLIENT_ID = 7;

/** Records awareness field writes — stands in for the Hocuspocus provider. */
class FakePresenceProvider {
    fields: Record<string, unknown> = {};
    calls: Array<{ key: string; value: unknown }> = [];

    setAwarenessField(key: string, value: unknown): void {
        this.fields[key] = value;
        this.calls.push({ key, value });
    }
}

type RafCallback = (time: number) => void;
let rafQueue: RafCallback[] = [];

/** Manual rAF queue — deterministic frame flushing in jsdom. */
function flushFrame(): void {
    const queue = rafQueue;
    rafQueue = [];
    for (const callback of queue) callback(16);
}

function makeContainer(): HTMLDivElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return el;
}

function pointerMove(container: HTMLElement, x: number, y: number): void {
    container.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
}

function optionsFor(provider: FakePresenceProvider, container: HTMLElement) {
    return {
        provider,
        userId: USER_ID,
        userName: 'Me',
        localClientId: LOCAL_CLIENT_ID,
        containerRef: { current: container },
        // Simulate a zoom=2 viewport so published cursors must be world coords.
        toWorld: (screen: { x: number; y: number }) => ({ x: screen.x * 2, y: screen.y * 2 }),
    };
}

describe('useCollabPresencePublisher', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', (callback: RafCallback) => {
            rafQueue.push(callback);
            return rafQueue.length;
        });
        vi.setSystemTime(1_000_000);
        container = makeContainer();
        useStore.setState({
            workbenchNodes: [],
            connections: [],
            selectedNodeIds: [],
            activeWorkbenchGesture: null,
            nodeLocks: {},
            presenceByUser: {},
            remoteCursors: {},
            collabSessionActive: true,
        });
    });

    afterEach(() => {
        container.remove();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('publishes the user identity on mount', () => {
        const provider = new FakePresenceProvider();
        renderHook(() => useCollabPresencePublisher(optionsFor(provider, container)));

        expect(provider.fields['user']).toEqual({ id: USER_ID, name: 'Me' });
    });

    it('publishes activeNodeIds + selectedAt when the selection SET changes, not on transient churn', () => {
        const provider = new FakePresenceProvider();
        renderHook(() => useCollabPresencePublisher(optionsFor(provider, container)));
        const lockCalls = () => provider.calls.filter((call) => call.key === 'activeNodeIds');

        // Joining declares the current (empty) lock set.
        expect(lockCalls()).toHaveLength(1);
        expect(lockCalls()[0].value).toEqual([]);

        act(() => {
            useStore.getState().setSelectedNodeIds(['n1']);
        });
        expect(lockCalls()).toHaveLength(2);
        expect(lockCalls()[1].value).toEqual(['n1']);
        expect(typeof provider.fields['selectedAt']).toBe('number');

        // Transient position churn with the same selection must NOT re-publish.
        act(() => {
            useStore.setState({ workbenchNodes: [{ id: 'n1', type: 'text', x: 5, y: 6, data: { text: 'a', fontSize: 14, color: '#fff' } }] });
        });
        expect(lockCalls()).toHaveLength(2);

        // A different set publishes again with a fresh epoch.
        vi.setSystemTime(2_000_000);
        act(() => {
            useStore.getState().setSelectedNodeIds(['n1', 'n2']);
        });
        expect(lockCalls()).toHaveLength(3);
        expect(lockCalls()[2].value).toEqual(['n1', 'n2']);
        expect(provider.fields['selectedAt']).toBe(2_000_000);
    });

    it('unions the in-flight gesture nodes into activeNodeIds', () => {
        const provider = new FakePresenceProvider();
        renderHook(() => useCollabPresencePublisher(optionsFor(provider, container)));

        act(() => {
            useStore.getState().setSelectedNodeIds(['n1']);
        });
        act(() => {
            useStore.setState({
                activeWorkbenchGesture: {
                    kind: 'move',
                    projectId: null,
                    startedAt: 2_000_000,
                    startSnapshot: { workbenchNodes: [], connections: [], selectedNodeIds: [], activeNodeId: null },
                    affectedNodeIds: ['n3'],
                },
            });
        });

        expect(provider.fields['activeNodeIds']).toEqual(['n1', 'n3']);
    });

    it('clears activeNodeIds when the selection and gesture end', () => {
        const provider = new FakePresenceProvider();
        renderHook(() => useCollabPresencePublisher(optionsFor(provider, container)));

        act(() => {
            useStore.getState().setSelectedNodeIds(['n1']);
        });
        act(() => {
            useStore.getState().setSelectedNodeIds([]);
        });

        expect(provider.fields['activeNodeIds']).toEqual([]);
    });

    it('publishes rAF-throttled world-coordinate cursors and null on pointer leave', () => {
        const provider = new FakePresenceProvider();
        renderHook(() => useCollabPresencePublisher(optionsFor(provider, container)));

        // Three moves within one frame → at most one cursor publish.
        act(() => {
            pointerMove(container, 10, 20);
            pointerMove(container, 11, 21);
            pointerMove(container, 12, 22);
            flushFrame();
        });
        const cursorCalls = provider.calls.filter((call) => call.key === 'cursor');
        expect(cursorCalls).toHaveLength(1);
        // World coordinates (zoom=2), last move wins within the frame.
        expect(cursorCalls[0].value).toEqual({ x: 24, y: 44 });

        act(() => {
            container.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
        });
        expect(provider.fields['cursor']).toBeNull();
    });

    it('releases the local selection of a node another client locks (lost conflict)', () => {
        const provider = new FakePresenceProvider();
        renderHook(() => useCollabPresencePublisher(optionsFor(provider, container)));

        act(() => {
            useStore.getState().setSelectedNodeIds(['n1', 'n2']);
        });

        // Grace (client 3) locked n1 earlier than us.
        const entries: CollabRemoteAwarenessEntry[] = [
            { clientId: LOCAL_CLIENT_ID, state: { user: { id: USER_ID }, activeNodeIds: ['n1', 'n2'], selectedAt: 5_000 } },
            { clientId: 3, state: { user: { id: 'u-2', name: 'Grace' }, activeNodeIds: ['n1'], selectedAt: 4_000 } },
        ];
        act(() => {
            useStore.getState().applyRemoteAwareness(entries, LOCAL_CLIENT_ID);
        });

        expect(useStore.getState().selectedNodeIds).toEqual(['n2']);
    });
});
