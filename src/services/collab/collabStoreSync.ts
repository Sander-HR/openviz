import * as Y from 'yjs';
import type { SceneConnectionJson, SceneDataJson, SceneNodeJson, SceneJsonValue } from '@/types/collab.types';
import { extractSceneFromDoc, getConnectionsMap, getNodesMap, jsonToYValue } from './sceneDocMapping';

/**
 * Bidirectional sync bridge between the workbench store and the shared scene
 * document while a collaboration session is active.
 *
 * Direction doc → store: every document update (local or remote) re-projects
 * the canonical scene into the store under a re-entrancy guard. After each
 * projection the baseline is re-snapshotted from what the STORE actually holds
 * (deep clone) — the store may normalize shapes (connection handles, policy
 * filters), and diffs must always compare like-for-like.
 *
 * Direction store → doc: flushes are PER-ENTITY against that baseline. Only
 * entities that changed since the last known state are written; local
 * deletions delete; entities the local view never represented (not in the
 * baseline) are left untouched, so a lossy or stale projection can never
 * overwrite or delete remote work. While a workbench gesture is active
 * (drag/resize) changes are buffered and flushed exactly once on commit —
 * preserving feature 002's one-gesture-one-action semantics in the shared
 * document.
 */

export interface CollabStoreSyncDeps {
    doc: Y.Doc;
    /** This client's transaction origin (`user:<id>:<clientID>`). */
    origin: string;
    getStoreState(): { nodes: readonly SceneNodeLike[]; connections: readonly SceneConnectionLike[]; gestureActive: boolean };
    /** Node ids of the in-flight workbench gesture, or null when none is active. */
    getActiveGestureNodeIds(): string[] | null;
    applyToStore(scene: SceneDataJson): void;
    subscribeStore(listener: () => void): () => void;
}

/** Minimal structural view of a store node (WorkbenchNode satisfies this). */
export interface SceneNodeLike {
    id: string;
}

/** Minimal structural view of a store connection (Connection satisfies this). */
export interface SceneConnectionLike {
    id: string;
}

export interface CollabStoreSync {
    start(): void;
    stop(): void;
}

/** Stable JSON for deep comparison — key order must not create false diffs. */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function canonicalScene<T extends { id: string }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function createCollabStoreSync(deps: CollabStoreSyncDeps): CollabStoreSync {
    const { doc, origin } = deps;
    let projecting = false;
    let flushing = false;
    /** Deep snapshot of the store after the last projection — the diff baseline. */
    let lastScene: SceneDataJson | null = null;
    let lastSceneKey: string | null = null;
    let lastNodeKeys = new Map<string, string>();
    let lastConnectionKeys = new Map<string, string>();
    /** Gesture node ids seen while a gesture was active; flushed on commit. */
    let bufferedGestureIds: Set<string> | null = null;
    let unsubscribeStore: (() => void) | null = null;

    /** Read back what the store actually holds and deep-snapshot it. */
    const snapshotStore = (): SceneDataJson => {
        const { nodes, connections } = deps.getStoreState();
        return structuredClone({
            nodes: canonicalScene(nodes),
            connections: canonicalScene(connections),
        }) as unknown as SceneDataJson;
    };

    const updateBaseline = (scene: SceneDataJson): void => {
        lastScene = scene;
        lastSceneKey = stableStringify(scene);
        lastNodeKeys = new Map(scene.nodes.map((node) => [node.id, stableStringify(node)]));
        lastConnectionKeys = new Map(scene.connections.map((connection) => [connection.id, stableStringify(connection)]));
    };

    const handleDocUpdate = (_bytes: Uint8Array, _updateOrigin: unknown): void => {
        if (projecting || flushing) return;
        projecting = true;
        try {
            deps.applyToStore(extractSceneFromDoc(doc));
        } finally {
            projecting = false;
        }
        // Baseline is the store's own (possibly normalized) view, never the
        // raw doc shape — otherwise every projection would look like a diff.
        updateBaseline(snapshotStore());
    };

    const flushToDoc = (forcedNodeIds?: ReadonlySet<string>, snapshot?: SceneDataJson): void => {
        if (!lastScene) return;
        const current = snapshot ?? snapshotStore();
        const docNodesById = forcedNodeIds
            ? new Map(extractSceneFromDoc(doc).nodes.map((node) => [node.id, node]))
            : null;

        // Per-entity plan against the baseline. Entities absent from the
        // baseline were never represented locally — leave them alone.
        // Forced ids (a gesture that just committed) are compared against the
        // DOC's current value instead: the baseline may hold the transient
        // position we preserved mid-gesture, which would hide a real change.
        const nodeSets: SceneNodeJson[] = [];
        const currentNodeIds = new Set<string>();
        for (const node of current.nodes) {
            currentNodeIds.add(node.id);
            const nodeKey = stableStringify(node);
            if (forcedNodeIds?.has(node.id)) {
                const docNode = docNodesById?.get(node.id);
                if (!docNode || stableStringify(docNode) !== nodeKey) nodeSets.push(node);
                continue;
            }
            if (lastNodeKeys.get(node.id) !== nodeKey) nodeSets.push(node);
        }
        const nodeDeletes = lastScene.nodes
            .filter((node) => !currentNodeIds.has(node.id))
            .map((node) => node.id);

        const connectionSets: SceneConnectionJson[] = [];
        const currentConnectionIds = new Set<string>();
        for (const connection of current.connections) {
            currentConnectionIds.add(connection.id);
            if (lastConnectionKeys.get(connection.id) !== stableStringify(connection)) {
                connectionSets.push(connection);
            }
        }
        const connectionDeletes = lastScene.connections
            .filter((connection) => !currentConnectionIds.has(connection.id))
            .map((connection) => connection.id);

        if (nodeSets.length === 0 && nodeDeletes.length === 0 && connectionSets.length === 0 && connectionDeletes.length === 0) {
            updateBaseline(current);
            return;
        }

        flushing = true;
        try {
            doc.transact(() => {
                const nodesMap = getNodesMap(doc);
                for (const node of nodeSets) {
                    nodesMap.set(node.id, jsonToYValue(node as unknown as SceneJsonValue));
                }
                for (const id of nodeDeletes) nodesMap.delete(id);

                const connectionsMap = getConnectionsMap(doc);
                for (const connection of connectionSets) {
                    connectionsMap.set(connection.id, jsonToYValue(connection as unknown as SceneJsonValue));
                }
                for (const id of connectionDeletes) connectionsMap.delete(id);
            }, origin);
        } finally {
            flushing = false;
        }

        // `current` is already a deep snapshot and the transaction cannot
        // synchronously normalize the store, so avoid cloning the whole scene
        // a second time on every gesture commit.
        updateBaseline(current);
    };

    const handleStoreChange = (): void => {
        if (projecting || flushing) return;

        const gestureIds = deps.getActiveGestureNodeIds();
        if (gestureIds) {
            // Buffer: the whole gesture flushes as ONE origin-tagged transaction
            // on the next store change after the gesture commits.
            bufferedGestureIds = new Set(gestureIds);
            return;
        }

        if (!lastScene) return;

        if (bufferedGestureIds && bufferedGestureIds.size > 0) {
            // The gesture just committed: flush its nodes against the doc's
            // current value, even if the final position equals the last
            // transient one (which the baseline already holds).
            void flushToDoc(bufferedGestureIds);
            bufferedGestureIds = null;
            return;
        }

        const current = snapshotStore();
        if (stableStringify(current) === lastSceneKey) return;
        void flushToDoc(undefined, current);
    };

    return {
        start(): void {
            // Project the current document state (initial sync), then baseline
            // from what the store actually holds.
            projecting = true;
            try {
                deps.applyToStore(extractSceneFromDoc(doc));
            } finally {
                projecting = false;
            }
            updateBaseline(snapshotStore());
            doc.on('update', handleDocUpdate);
            unsubscribeStore = deps.subscribeStore(handleStoreChange);
        },
        stop(): void {
            doc.off('update', handleDocUpdate);
            unsubscribeStore?.();
            unsubscribeStore = null;
            lastScene = null;
            lastSceneKey = null;
            lastNodeKeys = new Map();
            lastConnectionKeys = new Map();
            bufferedGestureIds = null;
        },
    };
}
