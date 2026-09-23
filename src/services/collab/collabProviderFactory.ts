import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { HocuspocusProvider, type HocuspocusProviderConfiguration } from '@hocuspocus/provider';
import type { CollabPresenceState } from '@/types/collab.types';
import { createSceneDoc } from './sceneDocMapping';

/** Per-user transaction origin: `user:<userId>` (server parses it for `updatedBy`). */
/**
 * Transaction origin for this client. The optional clientID suffix isolates
 * concurrent tabs of the SAME user (separate undo stacks, separate attribution)
 * while the server still resolves the userId from the second segment.
 */
export function collabOriginFor(userId: string, clientID?: number | string): string {
    return clientID === undefined ? `user:${userId}` : `user:${userId}:${clientID}`;
}

export interface CollabSessionConfig {
    /** Collaboration server WebSocket URL, e.g. ws://localhost:1234 (env-driven). */
    url: string;
    /** Signed room token from the collab-token API. */
    token: string;
    /** Room name — the project's main scene ID. */
    sceneId: string;
    userId: string;
    userName: string;
}

export interface CollabProviderHandle {
    provider: HocuspocusProvider;
    doc: Y.Doc;
    origin: string;
    /** Per-scene offline queue (y-indexeddb) — survives disconnects and browser close. */
    offlineStore: IndexeddbPersistence;
    destroy(): void;
}

export interface CreateCollabProviderOptions {
    /** Injectable provider class for tests (no network). */
    ProviderClass?: typeof HocuspocusProvider;
}

/**
 * Creates the client-side collaboration stack: shared scene document,
 * Hocuspocus provider bound to the scene room, and the local awareness state.
 */
export function createCollabProvider(
    config: CollabSessionConfig,
    options: CreateCollabProviderOptions = {},
): CollabProviderHandle {
    const ProviderClass = options.ProviderClass ?? HocuspocusProvider;
    const doc = createSceneDoc();

    const providerConfiguration: HocuspocusProviderConfiguration = {
        url: config.url,
        token: config.token,
        name: config.sceneId,
        document: doc,
    };
    const provider = new ProviderClass(providerConfiguration);

    // Offline queue (US3): mirror the document into a per-scene IndexedDB store
    // so edits made while disconnected — or before the browser closed cleanly —
    // merge back in on reconnect.
    const offlineStore = bindSceneOfflineStore(doc, config.sceneId);

    // Per-client origin (multi-tab isolation): two tabs of the same user must
    // not share an undo stack or overwrite each other's attribution.
    const origin = collabOriginFor(config.userId, provider.awareness?.clientID);

    // Announce ourselves on the awareness channel (presence + cursor host).
    const presence: CollabPresenceState = {
        user: { id: config.userId, name: config.userName },
        cursor: null,
    };
    provider.setAwarenessField('user', presence.user);
    provider.setAwarenessField('cursor', presence.cursor);

    return {
        provider,
        doc,
        origin,
        offlineStore,
        destroy: () => {
            void offlineStore.destroy();
            provider.destroy();
        },
    };
}

/** IndexedDB store name for a scene's offline queue (US3). */
export function sceneOfflineStoreName(sceneId: string): string {
    return `openviz-collab-${sceneId}`;
}

/**
 * Binds the shared document to a per-scene y-indexeddb store so local edits
 * survive disconnects AND browser close (US3 / SC-004). After reconnect the
 * provider's state-vector sync merges both directions; the binding keeps
 * mirroring the converged document locally.
 */
export function bindSceneOfflineStore(doc: Y.Doc, sceneId: string): IndexeddbPersistence {
    return new IndexeddbPersistence(sceneOfflineStoreName(sceneId), doc);
}

/** Runs a local mutation as a single transaction tagged with this user's origin. */
export function applyLocalTransaction(handle: CollabProviderHandle, fn: () => void): void {
    handle.doc.transact(fn, handle.origin);
}

export interface RemoteAwarenessEntry {
    clientId: number;
    state: Record<string, unknown>;
}

/** Awareness states of everyone except the local client. */
export function getRemoteAwarenessStates(provider: HocuspocusProvider): RemoteAwarenessEntry[] {
    const awareness = provider.awareness;
    if (!awareness) return [];
    const localClientId = awareness.clientID;
    const entries: RemoteAwarenessEntry[] = [];
    for (const [clientId, state] of awareness.getStates()) {
        if (clientId === localClientId) continue;
        entries.push({ clientId, state });
    }
    return entries;
}
