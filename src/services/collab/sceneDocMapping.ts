import * as Y from 'yjs';
import type { SceneConnectionJson, SceneDataJson, SceneJsonValue, SceneNodeJson } from '@/types/collab.types';

/**
 * Recursively converts plain JSON into deep Yjs types (Y.Map/Y.Array) so that
 * concurrent edits to different fields of the same node merge at field level.
 * Plain objects set directly on a Y.Map are stored as embedded values and do
 * NOT get per-field CRDT semantics — always route scene content through this.
 */
export function jsonToYValue(value: SceneJsonValue): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        const array = new Y.Array();
        for (const item of value) {
            array.push([jsonToYValue(item)]);
        }
        return array;
    }
    const map = new Y.Map();
    for (const [key, child] of Object.entries(value)) {
        map.set(key, jsonToYValue(child));
    }
    return map;
}

/** Recursively converts a Yjs value (deep Y.Map/Y.Array structures) to plain JSON. */
export function yValueToJson(value: unknown): SceneJsonValue {
    if (value instanceof Y.Map) {
        const out: Record<string, SceneJsonValue> = {};
        for (const [key, child] of value.entries()) {
            out[key] = yValueToJson(child);
        }
        return out;
    }
    if (value instanceof Y.Array) {
        return Array.from(value, (child) => yValueToJson(child));
    }
    if (value instanceof Y.Text) {
        return value.toString();
    }
    if (value === null || typeof value !== 'object') {
        return value as SceneJsonValue;
    }
    return value as SceneJsonValue;
}

export const SCENE_NODES_MAP = 'nodes';
export const SCENE_CONNECTIONS_MAP = 'connections';
export const SCENE_METADATA_MAP = 'metadata';
const SEED_ORIGIN = 'collab-seed';

type SceneEntityCollection = 'nodes' | 'connections';
type SceneFieldSegment = string | number;

/** Creates a shared document with the scene's keyed collections. */
export function createSceneDoc(): Y.Doc {
    return new Y.Doc();
}

export function getNodesMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(SCENE_NODES_MAP);
}

export function getConnectionsMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(SCENE_CONNECTIONS_MAP);
}

export function getSceneMetadataMap(doc: Y.Doc): Y.Map<unknown> {
    return doc.getMap(SCENE_METADATA_MAP);
}

export function getSceneName(doc: Y.Doc): string | undefined {
    const name = getSceneMetadataMap(doc).get('name');
    return typeof name === 'string' ? name : undefined;
}

export function setSceneName(doc: Y.Doc, name: string, origin?: unknown): void {
    doc.transact(() => getSceneMetadataMap(doc).set('name', name), origin);
}

/**
 * Mutates an existing nested entity field without replacing its node or connection map.
 * Field paths must already exist; create operations belong in sceneDocCommands.
 */
export function updateSceneEntityField(
    doc: Y.Doc,
    collection: SceneEntityCollection,
    entityId: string,
    path: readonly SceneFieldSegment[],
    value: SceneJsonValue,
    origin?: unknown,
): boolean {
    if (path.length === 0) return false;

    const entities = collection === 'nodes' ? getNodesMap(doc) : getConnectionsMap(doc);
    const entity = entities.get(entityId);
    if (!(entity instanceof Y.Map)) return false;

    let updated = false;
    doc.transact(() => {
        let parent: Y.Map<unknown> | Y.Array<unknown> = entity;
        for (const segment of path.slice(0, -1)) {
            if (parent instanceof Y.Map && typeof segment === 'string') {
                const child = parent.get(segment);
                if (!(child instanceof Y.Map) && !(child instanceof Y.Array)) return;
                parent = child;
            } else if (parent instanceof Y.Array && typeof segment === 'number') {
                if (!Number.isInteger(segment) || segment < 0 || segment >= parent.length) return;
                const child: unknown = (parent as Y.Array<unknown>).get(segment);
                if (!(child instanceof Y.Map) && !(child instanceof Y.Array)) return;
                parent = child as Y.Map<unknown> | Y.Array<unknown>;
            } else {
                return;
            }
        }

        const leaf = path[path.length - 1];
        const yValue = jsonToYValue(value);
        if (parent instanceof Y.Map && typeof leaf === 'string') {
            parent.set(leaf, yValue);
            updated = true;
        } else if (parent instanceof Y.Array && typeof leaf === 'number') {
            if (!Number.isInteger(leaf) || leaf < 0 || leaf >= parent.length) return;
            parent.delete(leaf, 1);
            parent.insert(leaf, [yValue]);
            updated = true;
        }
    }, origin);
    return updated;
}

/**
 * Seeds a shared document from saved scene JSON (lazy import on first
 * collaborative open). Replaces any previous content.
 */
export function seedSceneFromJson(doc: Y.Doc, data: SceneDataJson): void {
    const nodes = getNodesMap(doc);
    const connections = getConnectionsMap(doc);
    doc.transact(() => {
        for (const key of Array.from(nodes.keys())) {
            nodes.delete(key);
        }
        for (const key of Array.from(connections.keys())) {
            connections.delete(key);
        }
        for (const node of data.nodes) {
            nodes.set(node.id, jsonToYValue(node as unknown as SceneJsonValue));
        }
        for (const connection of data.connections) {
            connections.set(connection.id, jsonToYValue(connection as unknown as SceneJsonValue));
        }
    }, SEED_ORIGIN);
}

/**
 * Projects the shared document into plain scene JSON. Connections whose
 * endpoints no longer exist are pruned so stale references never reach the
 * canvas or the persisted snapshot.
 *
 * NOTE: Y.Map iteration order does NOT converge for concurrent inserts (each
 * replica may observe a different key order). Projection therefore returns a
 * canonical ID-sorted order so every client, the persisted JSON, and diffing
 * logic see an identical, deterministic scene.
 */
export function extractSceneFromDoc(doc: Y.Doc): SceneDataJson {
    const nodeIds = new Set<string>();
    const nodes: SceneNodeJson[] = [];
    for (const [, value] of getNodesMap(doc).entries()) {
        const json = yValueToJson(value) as SceneNodeJson;
        if (typeof json?.id !== 'string') continue;
        nodeIds.add(json.id);
        nodes.push(json);
    }

    const connections: SceneConnectionJson[] = [];
    for (const [, value] of getConnectionsMap(doc).entries()) {
        const json = yValueToJson(value) as SceneConnectionJson;
        if (typeof json?.id !== 'string') continue;
        // Persisted scenes use from/to; accept source/target variants too.
        const source = typeof json.from === 'string' ? json.from : json.source;
        const target = typeof json.to === 'string' ? json.to : json.target;
        if (typeof source !== 'string' || typeof target !== 'string') continue;
        if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
        connections.push(json);
    }

    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    nodes.sort(byId);
    connections.sort(byId);
    return { nodes, connections };
}
