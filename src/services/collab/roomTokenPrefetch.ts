import type { CollabTokenResponse } from '@/types/collab.types';

/**
 * Room-token prefetch (T2.4).
 *
 * The collab room token is a ~5-minute signed credential minted by
 * `POST /api/projects/:id/scenes/collab-token`. Today it is fetched only when
 * the Workbench mounts — which happens AFTER the project scene fetch resolves,
 * so the token round-trip sits serially on the project-open critical path.
 *
 * ProjectWorkspace calls {@link prefetchRoomToken} at mount, in parallel with
 * the scene fetch. When the collab join later asks for a token,
 * {@link consumePrefetchedRoomToken} returns the cached credential (if still
 * valid) and the join skips its own round-trip. A miss simply falls back to
 * the original fetch — the prefetch never blocks or changes join semantics.
 */

interface PrefetchedRoomToken {
    response: CollabTokenResponse;
    fetchedAt: number;
}

const cache = new Map<string, PrefetchedRoomToken>();
const inflight = new Map<string, Promise<PrefetchedRoomToken | null>>();

/** Fire-and-forget token prefetch. Safe to call repeatedly for one project. */
export function prefetchRoomToken(projectId: string): void {
    if (!projectId) return;
    if (cache.has(projectId)) return;
    if (inflight.has(projectId)) return;

    const task = (async (): Promise<PrefetchedRoomToken | null> => {
        try {
            const response = await fetch(`/api/projects/${projectId}/scenes/collab-token`, { method: 'POST' });
            if (!response.ok) return null;
            const json = (await response.json()) as CollabTokenResponse;
            const entry: PrefetchedRoomToken = { response: json, fetchedAt: Date.now() };
            cache.set(projectId, entry);
            return entry;
        } catch {
            // Network/auth failure — the join path retries with its own fetch.
            return null;
        } finally {
            inflight.delete(projectId);
        }
    })();

    inflight.set(projectId, task);
}

/**
 * Returns a still-valid prefetched token, or `null` to signal "fetch normally".
 * Never throws and never waits on an in-flight prefetch.
 */
export async function consumePrefetchedRoomToken(projectId: string): Promise<CollabTokenResponse | null> {
    const hit = cache.get(projectId);
    if (!hit) return null;
    // Trust the server-stamped expiry, with a 10s safety margin.
    if (Date.now() + 10_000 >= hit.response.expiresAt) {
        cache.delete(projectId);
        return null;
    }
    return hit.response;
}

/** Test helper — clears all cached/in-flight state. */
export function __resetRoomTokenPrefetchForTests(): void {
    cache.clear();
    inflight.clear();
}
