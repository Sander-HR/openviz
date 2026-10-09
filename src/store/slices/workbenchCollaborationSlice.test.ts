import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand/vanilla';
import type { StateCreator } from 'zustand';

import { createWorkbenchCollaborationSlice, WorkbenchCollaborationSlice } from './workbenchCollaborationSlice';
import type { CollabRemoteAwarenessEntry } from '@/types/collab.types';

const LOCAL_CLIENT_ID = 1;

function makeStore() {
    return createStore<WorkbenchCollaborationSlice>()(
        createWorkbenchCollaborationSlice as unknown as StateCreator<WorkbenchCollaborationSlice, [], []>
    );
}

function entry(clientId: number, state: CollabRemoteAwarenessEntry['state']): CollabRemoteAwarenessEntry {
    return { clientId, state };
}

describe('workbenchCollaborationSlice.applyRemoteAwareness', () => {
    it('derives the presence list from remote states and excludes the local client', () => {
        const store = makeStore();
        store.getState().applyRemoteAwareness(
            [
                entry(LOCAL_CLIENT_ID, { user: { id: 'u-1', name: 'Me' }, activeNodeIds: ['n1'] }),
                entry(2, { user: { id: 'u-2', name: 'Grace' } }),
                entry(3, { user: { id: 'u-3', name: 'Ravi' } }),
            ],
            LOCAL_CLIENT_ID
        );

        const { presenceByUser, nodeLocks } = store.getState();
        expect(Object.keys(presenceByUser).sort()).toEqual(['u-2', 'u-3']);
        expect(presenceByUser['u-2'].userName).toBe('Grace');
        // The local client's own activeNodeIds never create locks for itself.
        expect(nodeLocks).toEqual({});
    });

    it('keys remote cursors by client id (two tabs of one user = two cursors) and skips null cursors', () => {
        const store = makeStore();
        store.getState().applyRemoteAwareness(
            [
                entry(2, { user: { id: 'u-2', name: 'Grace' }, cursor: { x: 10, y: 20 } }),
                entry(3, { user: { id: 'u-2', name: 'Grace' }, cursor: { x: 99, y: 98 } }),
                entry(4, { user: { id: 'u-4', name: 'Ravi' }, cursor: null }),
            ],
            LOCAL_CLIENT_ID
        );

        const { remoteCursors } = store.getState();
        expect(Object.keys(remoteCursors).sort()).toEqual(['2', '3']);
        expect(remoteCursors['2']).toMatchObject({ userId: 'u-2', x: 10, y: 20 });
        expect(remoteCursors['3']).toMatchObject({ userId: 'u-2', x: 99, y: 98 });
    });

    it('derives node locks: earliest selectedAt wins per node', () => {
        const store = makeStore();
        store.getState().applyRemoteAwareness(
            [
                entry(2, { user: { id: 'u-2', name: 'Grace' }, activeNodeIds: ['n1'], selectedAt: 100 }),
                entry(3, { user: { id: 'u-3', name: 'Ravi' }, activeNodeIds: ['n1', 'n2'], selectedAt: 200 }),
            ],
            LOCAL_CLIENT_ID
        );

        const { nodeLocks } = store.getState();
        expect(nodeLocks['n1']).toMatchObject({ nodeId: 'n1', userId: 'u-2', userName: 'Grace' });
        expect(nodeLocks['n2']).toMatchObject({ nodeId: 'n2', userId: 'u-3' });
    });

    it('breaks selectedAt ties to the lower client id (deterministic across replicas)', () => {
        const store = makeStore();
        store.getState().applyRemoteAwareness(
            [
                entry(9, { user: { id: 'u-9', name: 'Later' }, activeNodeIds: ['n1'], selectedAt: 500 }),
                entry(5, { user: { id: 'u-5', name: 'Earlier' }, activeNodeIds: ['n1'], selectedAt: 500 }),
            ],
            LOCAL_CLIENT_ID
        );

        expect(store.getState().nodeLocks['n1']).toMatchObject({ userId: 'u-5' });
    });

    it('clears presence, cursors, and locks of departed peers on the next snapshot', () => {
        const store = makeStore();
        store.getState().applyRemoteAwareness(
            [entry(2, { user: { id: 'u-2', name: 'Grace' }, activeNodeIds: ['n1'], selectedAt: 100 })],
            LOCAL_CLIENT_ID
        );
        expect(Object.keys(store.getState().presenceByUser)).toEqual(['u-2']);

        // Grace leaves; only Ravi remains.
        store.getState().applyRemoteAwareness(
            [entry(3, { user: { id: 'u-3', name: 'Ravi' } })],
            LOCAL_CLIENT_ID
        );

        const state = store.getState();
        expect(Object.keys(state.presenceByUser)).toEqual(['u-3']);
        expect(state.nodeLocks).toEqual({});
        expect(state.remoteCursors).toEqual({});
    });

    it('clearCollaborationState also clears remote cursors', () => {
        const store = makeStore();
        store.getState().applyRemoteAwareness(
            [entry(2, { user: { id: 'u-2', name: 'Grace' }, cursor: { x: 1, y: 2 } })],
            LOCAL_CLIENT_ID
        );
        store.getState().clearCollaborationState();

        const state = store.getState();
        expect(state.presenceByUser).toEqual({});
        expect(state.remoteCursors).toEqual({});
        expect(state.nodeLocks).toEqual({});
    });
});
