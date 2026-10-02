import * as Y from 'yjs';
import type { SceneConnectionJson, SceneJsonValue, SceneNodeJson } from '@/types/collab.types';
import { getConnectionsMap, getNodesMap, jsonToYValue, setSceneName, updateSceneEntityField } from './sceneDocMapping';

export interface SceneFieldUpdate {
    path: readonly (string | number)[];
    value: SceneJsonValue;
}

export function isSceneJsonValue(value: unknown): value is SceneJsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.every(isSceneJsonValue);
    if (typeof value !== 'object') return false;
    return Object.values(value).every(isSceneJsonValue);
}

export function sceneFieldUpdatesFromObject(updates: object): SceneFieldUpdate[] {
    const fields: SceneFieldUpdate[] = [];
    const visit = (value: unknown, path: (string | number)[]): void => {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            const entries = Object.entries(value).filter(([, child]) => child !== undefined);
            if (entries.length === 0) {
                if (isSceneJsonValue(value)) fields.push({ path, value });
                return;
            }
            for (const [key, child] of entries) visit(child, [...path, key]);
            return;
        }
        if (isSceneJsonValue(value)) fields.push({ path, value });
    };
    for (const [key, value] of Object.entries(updates)) if (value !== undefined) visit(value, [key]);
    return fields;
}

export interface NodeMove {
    id: string;
    x: number;
    y: number;
}

export interface SceneDocCommands {
    createNode(node: SceneNodeJson): boolean;
    createGraph(nodes: readonly SceneNodeJson[], connections: readonly SceneConnectionJson[]): boolean;
    updateNodeField(nodeId: string, path: readonly (string | number)[], value: SceneJsonValue): boolean;
    updateNodeFields(nodeId: string, fields: readonly SceneFieldUpdate[]): boolean;
    moveNodes(moves: readonly NodeMove[]): boolean;
    deleteNode(nodeId: string): boolean;
    deleteNodes(nodeIds: readonly string[]): boolean;
    createConnection(connection: SceneConnectionJson): boolean;
    updateConnectionField(connectionId: string, path: readonly (string | number)[], value: SceneJsonValue): boolean;
    deleteConnection(connectionId: string): boolean;
    applyConnectionChanges(upsert: SceneConnectionJson | null, deleteIds: readonly string[]): boolean;
    setSceneName(name: string): boolean;
}

function connectionEndpoints(connection: Y.Map<unknown>): { source: string; target: string } | null {
    const source = connection.get('from') ?? connection.get('source');
    const target = connection.get('to') ?? connection.get('target');
    return typeof source === 'string' && typeof target === 'string' ? { source, target } : null;
}

export function createSceneDocCommands(doc: Y.Doc, origin: string): SceneDocCommands {
    return {
        createNode(node) {
            if (!node.id || getNodesMap(doc).has(node.id)) return false;
            doc.transact(() => getNodesMap(doc).set(node.id, jsonToYValue(node as unknown as SceneJsonValue)), origin);
            return true;
        },
        createGraph(nodesToCreate, connectionsToCreate) {
            const nodes = getNodesMap(doc);
            const connections = getConnectionsMap(doc);
            const newNodeIds = new Set<string>();
            const newConnectionIds = new Set<string>();
            for (const node of nodesToCreate) {
                if (!node.id || nodes.has(node.id) || newNodeIds.has(node.id)) return false;
                newNodeIds.add(node.id);
            }
            for (const connection of connectionsToCreate) {
                const source = connection.from ?? connection.source;
                const target = connection.to ?? connection.target;
                if (!connection.id || connections.has(connection.id) || newConnectionIds.has(connection.id)) return false;
                if (typeof source !== 'string' || typeof target !== 'string') return false;
                if ((!nodes.has(source) && !newNodeIds.has(source)) || (!nodes.has(target) && !newNodeIds.has(target))) return false;
                newConnectionIds.add(connection.id);
            }
            if (nodesToCreate.length === 0 && connectionsToCreate.length === 0) return false;
            doc.transact(() => {
                for (const node of nodesToCreate) nodes.set(node.id, jsonToYValue(node as unknown as SceneJsonValue));
                for (const connection of connectionsToCreate) {
                    connections.set(connection.id, jsonToYValue(connection as unknown as SceneJsonValue));
                }
            }, origin);
            return true;
        },
        updateNodeField(nodeId, path, value) {
            return updateSceneEntityField(doc, 'nodes', nodeId, path, value, origin);
        },
        updateNodeFields(nodeId, fields) {
            if (fields.length === 0 || !getNodesMap(doc).has(nodeId)) return false;
            let updated = false;
            doc.transact(() => {
                for (const field of fields) {
                    updated = updateSceneEntityField(doc, 'nodes', nodeId, field.path, field.value, origin) || updated;
                }
            }, origin);
            return updated;
        },
        moveNodes(moves) {
            if (moves.length === 0 || moves.some(({ id }) => !getNodesMap(doc).has(id))) return false;
            doc.transact(() => {
                for (const move of moves) {
                    updateSceneEntityField(doc, 'nodes', move.id, ['x'], move.x, origin);
                    updateSceneEntityField(doc, 'nodes', move.id, ['y'], move.y, origin);
                }
            }, origin);
            return true;
        },
        deleteNode(nodeId) {
            return this.deleteNodes([nodeId]);
        },
        deleteNodes(nodeIds) {
            const nodes = getNodesMap(doc);
            const deletions = new Set(nodeIds.filter((nodeId) => nodes.has(nodeId)));
            if (deletions.size === 0) return false;
            doc.transact(() => {
                for (const nodeId of deletions) nodes.delete(nodeId);
                const connections = getConnectionsMap(doc);
                for (const [connectionId, value] of connections.entries()) {
                    if (!(value instanceof Y.Map)) continue;
                    const endpoints = connectionEndpoints(value);
                    if (endpoints && (deletions.has(endpoints.source) || deletions.has(endpoints.target))) {
                        connections.delete(connectionId);
                    }
                }
            }, origin);
            return true;
        },
        createConnection(connection) {
            const connections = getConnectionsMap(doc);
            if (!connection.id || connections.has(connection.id)) return false;
            const source = connection.from ?? connection.source;
            const target = connection.to ?? connection.target;
            if (typeof source !== 'string' || typeof target !== 'string') return false;
            if (!getNodesMap(doc).has(source) || !getNodesMap(doc).has(target)) return false;
            doc.transact(
                () => connections.set(connection.id, jsonToYValue(connection as unknown as SceneJsonValue)),
                origin,
            );
            return true;
        },
        updateConnectionField(connectionId, path, value) {
            return updateSceneEntityField(doc, 'connections', connectionId, path, value, origin);
        },
        deleteConnection(connectionId) {
            const connections = getConnectionsMap(doc);
            if (!connections.has(connectionId)) return false;
            doc.transact(() => connections.delete(connectionId), origin);
            return true;
        },
        applyConnectionChanges(upsert, deleteIds) {
            const connections = getConnectionsMap(doc);
            const deletions = deleteIds.filter((id) => connections.has(id));
            if (upsert) {
                const source = upsert.from ?? upsert.source;
                const target = upsert.to ?? upsert.target;
                if (!upsert.id || typeof source !== 'string' || typeof target !== 'string') return false;
                if (!getNodesMap(doc).has(source) || !getNodesMap(doc).has(target)) return false;
                if (connections.has(upsert.id) && !deletions.includes(upsert.id)) return false;
            }
            if (!upsert && deletions.length === 0) return false;
            doc.transact(() => {
                for (const id of deletions) connections.delete(id);
                if (upsert) connections.set(upsert.id, jsonToYValue(upsert as unknown as SceneJsonValue));
            }, origin);
            return true;
        },
        setSceneName(name) {
            const trimmed = name.trim();
            if (!trimmed) return false;
            setSceneName(doc, trimmed, origin);
            return true;
        },
    };
}
