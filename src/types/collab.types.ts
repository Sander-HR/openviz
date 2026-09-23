/**
 * Collaboration domain types (shared by client services and the standalone
 * Hocuspocus server — keep this module dependency-free).
 */

/** Opaque JSON value used for scene document payloads. */
export type SceneJsonValue = string | number | boolean | null | SceneJsonValue[] | { [key: string]: SceneJsonValue };

export interface SceneNodeJson {
    id: string;
    x?: number;
    y?: number;
    [key: string]: SceneJsonValue | undefined;
}

/** Connection entry in the shared document. The persisted scene format uses
 * `from`/`to`; both key pairs are accepted so any variant prunes correctly. */
export interface SceneConnectionJson {
    id: string;
    from?: string;
    to?: string;
    source?: string;
    target?: string;
    [key: string]: SceneJsonValue | undefined;
}

/** Shape of `scenes.data` — the saved workbench graph. */
export interface SceneDataJson {
    nodes: SceneNodeJson[];
    connections: SceneConnectionJson[];
}

/** Awareness payload published by each client (contracts/presence-awareness.md). */
export interface CollabPresenceState {
    user?: { id: string; name?: string };
    cursor?: { x: number; y: number } | null;
    /** Node ids this client holds a soft lock on (selected or mid-gesture). */
    activeNodeIds?: string[];
    /** Epoch ms when the current activeNodeIds set was acquired (lock conflicts). */
    selectedAt?: number;
}

/** One awareness state keyed by its y-protocols client id. */
export interface CollabRemoteAwarenessEntry {
    clientId: number;
    state: CollabPresenceState;
}

/** A remote cursor marker (keyed by client id — two tabs of one user = two). */
export interface CollabRemoteCursorState {
    userId: string;
    userName?: string;
    color?: string;
    x: number;
    y: number;
}

/** A remote peer for UI display, derived from awareness (keyed by user id). */
export interface CollabPresencePeer {
    userId: string;
    userName?: string;
    color?: string;
}

/** Session lifecycle states surfaced to the workbench UI. */
export type CollabSessionStatus = 'idle' | 'connecting' | 'connected' | 'failed' | 'offline-queued' | 'denied';

/** Response of POST /api/projects/:id/scenes/collab-token (contracts/room-token-api.md). */
export interface CollabTokenResponse {
    token: string;
    sceneId: string;
    projectId: string;
    expiresAt: number;
}
