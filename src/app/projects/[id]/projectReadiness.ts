export interface CachePaintState {
    /** Last project whose nodes are persisted in workbenchNodes (never cleared on unmount). */
    lastOpenedProjectId: string | null;
    /** True once the store finished rehydrating from IndexedDB. */
    persistHydrated: boolean;
    /** Persisted workbenchNodes.length — the helper only cares about emptiness. */
    workbenchNodeCount: number;
    collabSessionActive: boolean;
}

/**
 * Stale-while-revalidate: if the persisted store already holds this project's
 * nodes, paint immediately instead of waiting for /api/projects/:id.
 *
 * Refuses to paint from cache when a collaboration session owns the scene —
 * the live shared document is the source of truth and the cached snapshot
 * would flash stale content (same guard as the persist merge in useStore.ts).
 */
export function shouldPaintFromCache(state: CachePaintState, projectId: string): boolean {
    if (!state.persistHydrated) return false;
    if (state.collabSessionActive) return false;
    // workbenchNodes is a single global array — it only belongs to this
    // project when the persisted lastOpenedProjectId matches.
    if (state.lastOpenedProjectId !== projectId) return false;
    return state.workbenchNodeCount > 0;
}

export interface ReconcileState {
    /** We painted from cache before the server response arrived. */
    paintedFromCache: boolean;
    collabOwnsScene: boolean;
    localVersion: number | null;
    serverVersion: number | null;
}

/**
 * Decide whether the arriving server scene replaces store contents:
 * - collab owns the scene → never hydrate from the DB snapshot.
 * - fresh load (no cache paint) → always hydrate.
 * - cache paint → hydrate unless the local version is strictly newer
 *   (unsaved/pending work must not be clobbered or downgraded).
 */
export function shouldHydrateFromServer(state: ReconcileState): boolean {
    if (state.collabOwnsScene) return false;
    if (!state.paintedFromCache) return true;
    const { localVersion, serverVersion } = state;
    if (localVersion === null || serverVersion === null) return true;
    return serverVersion >= localVersion;
}

/** How the readiness fetch was made: `lite` (KB-sized, no inline data) or `full`. */
export type ScenePayloadKind = 'lite' | 'full';

/** Settled outcome of the collab join attempt for this scene. */
export type CollabOutcome = 'pending' | 'active' | 'unavailable';

export interface HydrationDecisionInput {
    payloadKind: ScenePayloadKind;
    collabOutcome: CollabOutcome;
    paintedFromCache: boolean;
}

/** What the workspace should do when a scene payload arrives / collab settles. */
export type HydrationAction = 'hydrate' | 'skip' | 'fallback-fetch';

/**
 * Sprint 2 readiness matrix. A `lite` payload never hydrates — it only flips
 * readiness so the workbench mounts and the collab join starts in parallel.
 * When the join is terminally unavailable and nothing was painted from cache,
 * fetch the full scene once (single-user fallback). A `full` payload hydrates
 * unless the live document owns the scene (cache-paint version reconciliation
 * stays in {@link shouldHydrateFromServer}).
 */
export function resolveSceneHydration(input: HydrationDecisionInput): HydrationAction {
    if (input.payloadKind === 'lite') {
        return input.collabOutcome === 'unavailable' && !input.paintedFromCache ? 'fallback-fetch' : 'skip';
    }
    if (input.collabOutcome === 'active') return 'skip';
    return 'hydrate';
}

/**
 * Settles the live collab status into a fallback decision. The provider's own
 * retry budget can take minutes to exhaust, so a join that is still `pending`
 * after {@link COLLAB_FALLBACK_WAIT_MS} is treated as unavailable: the
 * single-user fallback fetches the full scene while the join keeps retrying in
 * the background (if it syncs later, the live document takes over).
 */
export const COLLAB_FALLBACK_WAIT_MS = 5000;

export function settleCollabOutcome(status: CollabOutcome, fallbackWaitElapsed: boolean): CollabOutcome {
    if (status === 'pending' && fallbackWaitElapsed) return 'unavailable';
    return status;
}
