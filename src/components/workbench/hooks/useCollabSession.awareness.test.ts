import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStore } from '@/store/useStore';
import { useCollabSession } from './useCollabSession';
import { FakeProvider, seedOptions } from './useCollabSession.testUtils';

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

        await waitFor(() => {
            const state = useStore.getState();
            expect(Object.keys(state.presenceByUser)).toEqual(['u-bob']);
            expect(state.remoteCursors['7']).toMatchObject({ userId: 'u-bob', userName: 'Bob', x: 42, y: 17 });
            expect(state.nodeLocks['n9']).toMatchObject({ nodeId: 'n9', userId: 'u-bob' });
        });

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
