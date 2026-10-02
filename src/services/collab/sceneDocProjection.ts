import * as Y from 'yjs';
import type { SceneConnectionJson, SceneDataJson, SceneNodeJson } from '@/types/collab.types';
import { extractSceneFromDoc, getConnectionsMap, getNodesMap, getSceneName, yValueToJson } from './sceneDocMapping';

export interface SceneDocProjectionSnapshot {
    scene: SceneDataJson;
    sceneName: string | undefined;
}

export interface SceneDocProjection {
    snapshot(): SceneDocProjectionSnapshot;
    subscribe(listener: () => void): () => void;
    destroy(): void;
}

function toNode(value: unknown): SceneNodeJson | undefined {
    const node = yValueToJson(value) as SceneNodeJson;
    return typeof node?.id === 'string' ? node : undefined;
}

function toConnection(value: unknown): SceneConnectionJson | undefined {
    const connection = yValueToJson(value) as SceneConnectionJson;
    if (typeof connection?.id !== 'string') return undefined;
    const source = typeof connection.from === 'string' ? connection.from : connection.source;
    const target = typeof connection.to === 'string' ? connection.to : connection.target;
    return typeof source === 'string' && typeof target === 'string' ? connection : undefined;
}

function changedIds(root: Y.Map<unknown>, events: Y.YEvent<Y.AbstractType<unknown>>[]): Set<string> {
    const ids = new Set<string>();
    for (const event of events) {
        if (event.target === root) {
            if (event instanceof Y.YMapEvent) {
                for (const id of event.changes.keys.keys()) ids.add(id);
            }
        } else if (typeof event.path[0] === 'string') {
            ids.add(event.path[0]);
        }
    }
    return ids;
}

export function createSceneDocProjection(doc: Y.Doc): SceneDocProjection {
    const nodes = getNodesMap(doc);
    const connections = getConnectionsMap(doc);
    const initialScene = extractSceneFromDoc(doc);
    const nodeById = new Map(initialScene.nodes.map((node) => [node.id, node]));
    const connectionById = new Map(initialScene.connections.map((connection) => [connection.id, connection]));
    let sceneName = getSceneName(doc);
    const listeners = new Set<() => void>();
    const dirtyNodeIds = new Set<string>();
    const dirtyConnectionIds = new Set<string>();
    let metadataDirty = false;
    let scheduled = false;
    let destroyed = false;

    const flush = (): void => {
        scheduled = false;
        if (destroyed) return;
        for (const id of dirtyNodeIds) {
            const node = nodes.has(id) ? toNode(nodes.get(id)) : undefined;
            if (node) nodeById.set(node.id, node);
            else nodeById.delete(id);
        }
        for (const id of dirtyConnectionIds) {
            const connection = connections.has(id) ? toConnection(connections.get(id)) : undefined;
            if (connection) connectionById.set(connection.id, connection);
            else connectionById.delete(id);
        }
        dirtyNodeIds.clear();
        dirtyConnectionIds.clear();
        if (metadataDirty) sceneName = getSceneName(doc);
        metadataDirty = false;
        for (const listener of listeners) listener();
    };

    const scheduleFlush = (): void => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(flush);
    };
    const onNodes = (events: Y.YEvent<Y.AbstractType<unknown>>[]): void => {
        for (const id of changedIds(nodes, events)) dirtyNodeIds.add(id);
        scheduleFlush();
    };
    const onConnections = (events: Y.YEvent<Y.AbstractType<unknown>>[]): void => {
        for (const id of changedIds(connections, events)) dirtyConnectionIds.add(id);
        scheduleFlush();
    };
    const onMetadata = (): void => {
        metadataDirty = true;
        scheduleFlush();
    };

    nodes.observeDeep(onNodes);
    connections.observeDeep(onConnections);
    doc.getMap('metadata').observe(onMetadata);

    return {
        snapshot() {
            const liveNodeIds = new Set(nodeById.keys());
            const sceneNodes = Array.from(nodeById.values()).sort((a, b) => a.id.localeCompare(b.id));
            const sceneConnections = Array.from(connectionById.values())
                .filter((connection) => {
                    const source = typeof connection.from === 'string' ? connection.from : connection.source;
                    const target = typeof connection.to === 'string' ? connection.to : connection.target;
                    return typeof source === 'string' && typeof target === 'string'
                        && liveNodeIds.has(source) && liveNodeIds.has(target);
                })
                .sort((a, b) => a.id.localeCompare(b.id));
            return { scene: { nodes: sceneNodes, connections: sceneConnections }, sceneName };
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        destroy() {
            destroyed = true;
            nodes.unobserveDeep(onNodes);
            connections.unobserveDeep(onConnections);
            doc.getMap('metadata').unobserve(onMetadata);
            listeners.clear();
            dirtyNodeIds.clear();
            dirtyConnectionIds.clear();
        },
    };
}
