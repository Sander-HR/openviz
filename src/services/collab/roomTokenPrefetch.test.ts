import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    prefetchRoomToken,
    consumePrefetchedRoomToken,
    __resetRoomTokenPrefetchForTests,
} from './roomTokenPrefetch';

const PROJECT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function tokenResponse(overrides: Partial<{ expiresAt: number }> = {}) {
    return {
        token: 'signed-token',
        sceneId: 'scene-1',
        projectId: PROJECT_ID,
        expiresAt: Date.now() + 5 * 60_000,
        ...overrides,
    };
}

describe('roomTokenPrefetch (T2.4)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        __resetRoomTokenPrefetchForTests();
        fetchMock = vi.fn(async () => new Response(JSON.stringify(tokenResponse()), { status: 200 }));
        vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('caches a successful prefetch for later consumption', async () => {
        prefetchRoomToken(PROJECT_ID);
        // Let the in-flight fetch settle.
        await new Promise((resolve) => setTimeout(resolve, 0));

        const consumed = await consumePrefetchedRoomToken(PROJECT_ID);
        expect(consumed).not.toBeNull();
        expect(consumed?.token).toBe('signed-token');
        // Exactly one token request was made.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain(`/api/projects/${PROJECT_ID}/scenes/collab-token`);
    });

    it('deduplicates concurrent prefetches for the same project', async () => {
        prefetchRoomToken(PROJECT_ID);
        prefetchRoomToken(PROJECT_ID);
        prefetchRoomToken(PROJECT_ID);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null (fall through to normal fetch) when the token is expired', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse({ expiresAt: Date.now() - 1000 })), { status: 200 }));
        prefetchRoomToken(PROJECT_ID);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(await consumePrefetchedRoomToken(PROJECT_ID)).toBeNull();
    });

    it('returns null and never throws when the prefetch request fails', async () => {
        fetchMock.mockRejectedValueOnce(new Error('network down'));
        prefetchRoomToken(PROJECT_ID);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(await consumePrefetchedRoomToken(PROJECT_ID)).toBeNull();
    });

    it('returns null without fetching for unknown projects', async () => {
        expect(await consumePrefetchedRoomToken('never-prefetched')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ignores empty project ids', () => {
        prefetchRoomToken('');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
