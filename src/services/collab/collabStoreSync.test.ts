import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

import type { SceneDataJson } from '@/types/collab.types';
import { createSceneDoc, getConnectionsMap, getNodesMap, jsonToYValue, seedSceneFromJson, yValueToJson } from './sceneDocMapping';
import { createCollabStoreSync } from './collabStoreSync';

const ORIGIN = 'user:u1:client-1';

/**
 * Harness with a fake store that mimics the real workbench store's behavior:
 * `setConnections` normalizes (adds handle fields) and drops connections that
 * violate the connection policy. That shape asymmetry between doc and store is
 * exactly what must never turn into echo writes or deletions of entries the
 * local view cannot represent.
 */
function makeHarness(scene: SceneDataJson) {
    const doc = createSceneDoc();
    seedSceneFromJson(doc, scene);

    const store: {
        nodes: SceneDataJson['nodes'];
        connections: SceneDataJson['connections'];
        gestureNodeIds: string[] | null;
    } = {
        nodes: [],
        connections: [],
        gestureNodeIds: null,
    };
    let listeners: Array<() => void> = [];
    let localTransactions = 0;

    const sync = createCollabStoreSync({
        doc,
        origin: ORIGIN,
        getStoreState: () => ({
            nodes: store.nodes,
            connections: store.connections,
            gestureActive: store.gestureNodeIds !== null,
        }),
        getActiveGestureNodeIds: () => store.gestureNodeIds,
        applyToStore: (projected) => {
            // Simulates zustand setWorkbenchNodes (pass-through, but a mid-gesture
            // node keeps its transient position — same as useCollabSession's
            // protected projection) + setConnections (normalizeConnections: policy
            // filter + handle fields).
            const protectedIds = store.gestureNodeIds ?? [];
            store.nodes = projected.nodes.map((node) => {
                if (!protectedIds.includes(node.id)) return node;
                const live = store.nodes.find((candidate) => candidate.id === node.id);
                return live
                    ? { ...node, x: (live as { x: number }).x, y: (live as { y: number }).y }
                    : node;
            });
            store.connections = projected.connections
                .filter((connection) => connection.from !== 'bad')
                .map((connection) => ({ ...connection, sourceHandle: null, targetHandle: null }));
        },
        subscribeStore: (listener) => {
            listeners.push(listener);
            return () => {
                listeners = listeners.filter((l) => l !== listener);
            };
        },
    });

    doc.on('update', (_bytes, updateOrigin) => {
        if (updateOrigin === ORIGIN) localTransactions += 1;
    });

    const emitStoreChange = (): void => {
        for (const listener of [...listeners]) listener();
    };

    return {
        doc,
        store,
        sync,
        emitStoreChange,
        get localTransactions() {
            return localTransactions;
        },
    };
}

function nodeJson(id: string, x = 0, y = 0) {
    return { id, type: 'image', x, y, data: {} };
}

describe('createCollabStoreSync — flush safety (two-tab overwrite protection)', () => {
    it('a remote update never triggers an echo flush even when the store normalizes shapes', () => {
        const harness = makeHarness({
            nodes: [nodeJson('n1'), nodeJson('n2')],
            connections: [{ id: 'c1', from: 'n1', to: 'n2' }],
        });
        harness.sync.start();

        // A remote client moves n2.
        harness.doc.transact(() => {
            const node = getNodesMap(harness.doc).get('n2') as Y.Map<unknown>;
            node.set('x', 42);
        }, 'remote');

        // The projection normalized connection shapes (added handles). An
        // unrelated store notification must NOT flush those back to the doc.
        harness.emitStoreChange();

        expect(harness.localTransactions).toBe(0);
    });

    it('a local edit never deletes doc entries the local view cannot represent', () => {
        const harness = makeHarness({
            nodes: [nodeJson('n1'), nodeJson('bad')],
            connections: [{ id: 'c-bad', from: 'bad', to: 'n1' }], // policy-filtered locally
        });
        harness.sync.start();

        // Local user moves n1.
        const n1 = harness.store.nodes.find((node) => node.id === 'n1');
        (n1 as { x?: number }).x = 7;
        harness.emitStoreChange();

        expect(harness.localTransactions).toBe(1);
        // The policy-filtered connection must survive — the local view simply
        // does not represent it, which is not a deletion.
        expect(getConnectionsMap(harness.doc).get('c-bad')).toBeDefined();
        const flushedN1 = yValueToJson(getNodesMap(harness.doc).get('n1'));
        expect((flushedN1 as { x: number }).x).toBe(7);
    });

    it('a local deletion removes only the deleted entity', () => {
        const harness = makeHarness({
            nodes: [nodeJson('n1'), nodeJson('n2')],
            connections: [],
        });
        harness.sync.start();

        harness.store.nodes = harness.store.nodes.filter((node) => node.id !== 'n1');
        harness.emitStoreChange();

        expect(harness.localTransactions).toBe(1);
        expect(getNodesMap(harness.doc).get('n1')).toBeUndefined();
        expect(yValueToJson(getNodesMap(harness.doc).get('n2'))).toEqual(nodeJson('n2'));
    });

    it('a remote addition followed by a local edit keeps both in the doc', () => {
        const harness = makeHarness({ nodes: [nodeJson('n1')], connections: [] });
        harness.sync.start();

        // Remote adds n2 while this client is idle.
        harness.doc.transact(() => {
            getNodesMap(harness.doc).set('n2', jsonToYValue(nodeJson('n2', 9, 9)));
        }, 'remote');

        // Local user then moves n1.
        const n1 = harness.store.nodes.find((node) => node.id === 'n1');
        (n1 as { x?: number }).x = 3;
        harness.emitStoreChange();

        expect(harness.localTransactions).toBe(1);
        expect(getNodesMap(harness.doc).get('n2')).toBeDefined();
        expect((yValueToJson(getNodesMap(harness.doc).get('n1')) as { x: number }).x).toBe(3);
    });

    it('no-op store changes never open a transaction', () => {
        const harness = makeHarness({ nodes: [nodeJson('n1')], connections: [] });
        harness.sync.start();

        harness.emitStoreChange(); // nothing changed since the projection
        expect(harness.localTransactions).toBe(0);
    });

    it('flushes a gesture commit even when the final position equals the preserved transient one', () => {
        const harness = makeHarness({ nodes: [nodeJson('n1'), nodeJson('n2')], connections: [] });
        harness.sync.start();

        // User starts dragging n1; the transient position lands in the store.
        harness.store.gestureNodeIds = ['n1'];
        (harness.store.nodes.find((node) => node.id === 'n1') as { x: number }).x = 50;
        harness.emitStoreChange(); // buffered while the gesture is active

        // A peer moves n2 mid-gesture; the projection keeps n1 at its transient spot.
        harness.doc.transact(() => {
            (getNodesMap(harness.doc).get('n2') as Y.Map<unknown>).set('x', 9);
        }, 'remote');

        // User releases exactly at the transient position and the gesture commits.
        harness.store.gestureNodeIds = null;
        harness.emitStoreChange();

        expect(harness.localTransactions).toBe(1);
        expect((yValueToJson(getNodesMap(harness.doc).get('n1')) as { x: number }).x).toBe(50);
        expect((yValueToJson(getNodesMap(harness.doc).get('n2')) as { x: number }).x).toBe(9);
    });
});
