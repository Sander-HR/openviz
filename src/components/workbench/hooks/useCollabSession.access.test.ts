import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStore } from '@/store/useStore';
import { useCollabSession } from './useCollabSession';
import { FakeProvider, seedOptions, tokenCallCount } from './useCollabSession.testUtils';

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
