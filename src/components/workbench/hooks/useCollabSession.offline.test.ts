import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import * as Y from 'yjs';
import { useStore } from '@/store/useStore';
import { createSceneDoc, seedSceneFromJson, jsonToYValue } from '@/services/collab/sceneDocMapping';
import { useCollabSession } from './useCollabSession';
import { FakeProvider, seedOptions } from './useCollabSession.testUtils';

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

        act(() => {
            doc.transact(() => {
                doc.getMap('nodes').set('offline-node', jsonToYValue({ id: 'offline-node', type: 'note', x: 9, y: 9 }));
            }, result.current.origin);
        });

        expect(doc.getMap('nodes').size).toBe(2);
    });

    it('converges on reconnect: local queued edits + remote edits both survive', async () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'n1', x: 0, y: 0 }], connections: [] });
        const options = seedOptions({}, doc);
        const { result } = renderHook(() => useCollabSession(options));
        await waitFor(() => expect(result.current.status).toBe('connected'));

        // Go offline and queue a local document edit (adds n2).
        act(() => {
            FakeProvider.instances[0].emitStatus('disconnected');
        });
        await waitFor(() => expect(result.current.status).toBe('offline-queued'));
        act(() => {
            doc.transact(() => {
                doc.getMap('nodes').set('n2', jsonToYValue({ id: 'n2', type: 'note', x: 9, y: 9 }));
            }, result.current.origin);
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

        await waitFor(() => {
            expect(useStore.getState().workbenchNodes.map((node) => node.id).sort()).toEqual(['n1', 'n2', 'n3']);
        });
    });
});
