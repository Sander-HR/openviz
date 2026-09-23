import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useStore } from '@/store/useStore';

/** The subset of the Hocuspocus provider used for awareness publishing. */
export interface CollabAwarenessPublisherProvider {
    setAwarenessField(key: string, value: unknown): void;
}

export interface UseCollabPresencePublisherOptions {
    provider: CollabAwarenessPublisherProvider | null;
    userId: string;
    userName?: string;
    /** This client's awareness client id (reserved for future self-identification). */
    localClientId?: number;
    containerRef: RefObject<HTMLElement | null>;
    /** Screen → canvas (world) coordinate transform for cursor publishing. */
    toWorld: (screen: { x: number; y: number }) => { x: number; y: number };
}

/**
 * Publishes this client's awareness state while a collaboration session is
 * active (contracts/presence-awareness.md):
 * - `user` identity on join;
 * - `activeNodeIds`/`selectedAt`: the soft-lock set (selected ∪ in-gesture
 *   nodes). The epoch only changes when the id SET changes, never on
 *   transient position churn — first-come-first-served conflicts need a
 *   stable acquisition time (spec FR-016);
 * - `cursor`: pointer position in world coordinates, rAF-throttled to at most
 *   one publish per frame while moving, `null` when the pointer leaves.
 *
 * It also enforces the lost-conflict rule: if another client's lock lands on a
 * node this client has selected, the local selection of that node is released
 * (the slice's nodeLocks map only ever contains REMOTE locks).
 */
export function useCollabPresencePublisher(options: UseCollabPresencePublisherOptions): void {
    const { provider, userId, userName, containerRef } = options;
    const toWorldRef = useRef(options.toWorld);
    toWorldRef.current = options.toWorld;

    // Identity + soft-lock set.
    useEffect(() => {
        if (!provider) return;

        provider.setAwarenessField('user', { id: userId, name: userName ?? null });

        let lastSetKey: string | null = null;
        const publishLockSet = (): void => {
            const state = useStore.getState();
            const gestureIds = state.activeWorkbenchGesture?.affectedNodeIds ?? [];
            const ids = [...new Set([...state.selectedNodeIds, ...gestureIds])].sort();
            const key = ids.join('|');
            if (key === lastSetKey) return;
            lastSetKey = key;
            provider.setAwarenessField('activeNodeIds', ids);
            provider.setAwarenessField('selectedAt', Date.now());
        };
        publishLockSet();

        const unsubscribe = useStore.subscribe(publishLockSet);
        return () => {
            unsubscribe();
        };
    }, [provider, userId, userName]);

    // Cursor (rAF-throttled world coordinates; null when the pointer leaves).
    useEffect(() => {
        if (!provider) return;
        const container = containerRef.current;
        if (!container) return;

        let pending: { x: number; y: number } | null = null;
        let rafId = 0;
        let lastPublished: { x: number; y: number } | null = null;

        const flush = (): void => {
            rafId = 0;
            if (!pending) return;
            const world = toWorldRef.current(pending);
            pending = null;
            if (lastPublished && lastPublished.x === world.x && lastPublished.y === world.y) return;
            lastPublished = world;
            provider.setAwarenessField('cursor', world);
        };

        const onPointerMove = (event: MouseEvent): void => {
            pending = { x: event.clientX, y: event.clientY };
            if (!rafId) rafId = requestAnimationFrame(flush);
        };
        const onPointerLeave = (): void => {
            pending = null;
            lastPublished = null;
            provider.setAwarenessField('cursor', null);
        };

        container.addEventListener('pointermove', onPointerMove as EventListener);
        container.addEventListener('pointerleave', onPointerLeave);
        return () => {
            container.removeEventListener('pointermove', onPointerMove as EventListener);
            container.removeEventListener('pointerleave', onPointerLeave);
            if (rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
            // Never leave a stale cursor behind when the session ends.
            provider.setAwarenessField('cursor', null);
        };
    }, [provider, containerRef]);

    // Lost-conflict yield: release local selection of remotely locked nodes.
    useEffect(() => {
        const check = (): void => {
            const state = useStore.getState();
            if (!state.collabSessionActive) return;
            const contested = state.selectedNodeIds.filter((id) => state.nodeLocks[id]);
            if (contested.length === 0) return;
            state.setSelectedNodeIds(state.selectedNodeIds.filter((id) => !state.nodeLocks[id]));
        };
        check();
        const unsubscribe = useStore.subscribe(check);
        return () => {
            unsubscribe();
        };
    }, []);
}
