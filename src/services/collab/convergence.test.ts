import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { SceneDataJson } from '@/types/collab.types';
import { createSceneDoc, seedSceneFromJson, extractSceneFromDoc, getNodesMap, getConnectionsMap, jsonToYValue } from './sceneDocMapping';

/**
 * Convergence harness: N documents exchange updates over a broadcast bus in
 * rounds (simulating the Hocuspocus relay). Every client performs concurrent
 * local edits; after convergence all final states must be identical and every
 * completed edit must be present (SC-001, SC-002).
 */

interface Client {
    doc: Y.Doc;
    origin: string;
}

function makeClients(count: number): Client[] {
    return Array.from({ length: count }, (_, i) => ({
        doc: createSceneDoc(),
        origin: `user:u-${i + 1}`,
    }));
}

function broadcast(clients: Client[]): void {
    // Each client encodes its state and applies it to every other client.
    for (const sender of clients) {
        const update = Y.encodeStateAsUpdate(sender.doc);
        for (const receiver of clients) {
            if (receiver !== sender) {
                Y.applyUpdate(receiver.doc, update);
            }
        }
    }
}

function converge(clients: Client[], rounds = 4): void {
    for (let round = 0; round < rounds; round += 1) {
        broadcast(clients);
    }
}

// Node payloads use the real persisted store shape (flat x/y — see BaseNode).
function addNode(client: Client, id: string, x: number, y: number): void {
    client.doc.transact(() => {
        getNodesMap(client.doc).set(id, jsonToYValue({ id, type: 'image', x, y, data: { alt: id } }));
    }, client.origin);
}

function moveNode(client: Client, id: string, x: number, y: number): void {
    client.doc.transact(() => {
        const node = getNodesMap(client.doc).get(id) as Y.Map<unknown> | undefined;
        if (!node) return;
        node.set('x', x);
        node.set('y', y);
    }, client.origin);
}

function deleteNode(client: Client, id: string): void {
    client.doc.transact(() => {
        getNodesMap(client.doc).delete(id);
    }, client.origin);
}

function addConnection(client: Client, id: string, from: string, to: string): void {
    client.doc.transact(() => {
        getConnectionsMap(client.doc).set(id, jsonToYValue({ id, from, to }));
    }, client.origin);
}

describe('convergence (SC-001, SC-002)', () => {
    it('two clients editing disjoint nodes keep every edit', () => {
        const [a, b] = makeClients(2);
        addNode(a, 'n1', 0, 0);
        broadcast([a, b]);

        addNode(b, 'n2', 50, 50); // concurrent: a adds n3 while b adds n2
        addNode(a, 'n3', -10, 10);
        converge([a, b]);

        const sceneA = extractSceneFromDoc(a.doc);
        const sceneB = extractSceneFromDoc(b.doc);
        expect(sceneA).toEqual(sceneB);
        expect(sceneA.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2', 'n3']);
    });

    it('five clients with overlapping edits converge to an identical scene', () => {
        const clients = makeClients(5);
        addNode(clients[0], 'shared', 0, 0);
        broadcast(clients);

        // Everyone concurrently: moves the shared node differently and adds a private node.
        clients.forEach((client, i) => {
            moveNode(client, 'shared', i * 10, i * -5);
            addNode(client, `private-${i}`, i, i * 2);
        });
        converge(clients);

        const scenes = clients.map((client) => extractSceneFromDoc(client.doc));
        for (const scene of scenes.slice(1)) {
            expect(scene).toEqual(scenes[0]);
        }
        // All private nodes present in every state.
        expect(scenes[0].nodes.map((n) => n.id).sort()).toEqual([
            'private-0',
            'private-1',
            'private-2',
            'private-3',
            'private-4',
            'shared',
        ]);
    });

    it('concurrent connection add + node delete prunes the dangling connection on every client', () => {
        const [a, b] = makeClients(2);
        addNode(a, 'n1', 0, 0);
        addNode(a, 'n2', 10, 10);
        broadcast([a, b]);

        addConnection(b, 'c1', 'n1', 'n2'); // b connects (persisted from/to format)
        deleteNode(a, 'n2'); // a deletes the target concurrently
        converge([a, b]);

        const sceneA = extractSceneFromDoc(a.doc);
        const sceneB = extractSceneFromDoc(b.doc);
        expect(sceneA).toEqual(sceneB);
        expect(sceneA.nodes.map((n) => n.id)).toEqual(['n1']);
        expect(sceneA.connections).toEqual([]); // dangling connection never surfaces
    });

    it('edits made before an earlier client joined are delivered on sync', () => {
        const [a, b] = makeClients(2);
        addNode(a, 'early', 1, 2);
        moveNode(a, 'early', 3, 4);
        // b joins late: full state-vector sync must carry both edits.
        broadcast([a, b]);

        const sceneB = extractSceneFromDoc(b.doc);
        expect(sceneB.nodes).toEqual([{ id: 'early', type: 'image', x: 3, y: 4, data: { alt: 'early' } }]);
    });

    it('a lazy-imported seeded scene converges identically with a fresh client', () => {
        const saved: SceneDataJson = {
            nodes: [
                { id: 's1', type: 'text', x: 7, y: 8, data: { text: 'hello' } },
                { id: 's2', type: 'image', x: 0, y: 0, data: { alt: 'x' } },
            ],
            connections: [{ id: 'sc1', source: 's1', target: 's2' }],
        };
        const [serverDoc] = makeClients(1);
        seedSceneFromJson(serverDoc.doc, saved);

        const lateClient = makeClients(1)[0];
        broadcast([serverDoc, lateClient]);

        expect(extractSceneFromDoc(lateClient.doc)).toEqual(saved);
    });
});
