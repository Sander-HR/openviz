import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { SceneConnectionJson, SceneNodeJson } from '@/types/collab.types';
import { createSceneDoc, extractSceneFromDoc, getConnectionsMap, getNodesMap, yValueToJson } from './sceneDocMapping';
import { createSceneDocCommands } from './sceneDocCommands';

const docs: Y.Doc[] = [];
const ORIGIN = 'user:alice:17';

function makeCommands() {
    const doc = createSceneDoc();
    docs.push(doc);
    return { doc, commands: createSceneDocCommands(doc, ORIGIN) };
}

afterEach(() => {
    for (const doc of docs.splice(0)) doc.destroy();
});

describe('createSceneDocCommands', () => {
    it('creates a grouped set of nodes and connections in one origin-tagged transaction', () => {
        const { doc, commands } = makeCommands();
        const origins: unknown[] = [];
        doc.on('afterTransaction', (transaction) => origins.push(transaction.origin));

        expect(commands.createGraph(
            [{ id: 'source', type: 'image', x: 0, y: 0 }, { id: 'target', type: 'render', x: 1, y: 1 }],
            [{ id: 'edge', from: 'source', to: 'target' }],
        )).toBe(true);

        expect(origins).toEqual([ORIGIN]);
        expect(extractSceneFromDoc(doc).nodes.map(({ id }) => id)).toEqual(['source', 'target']);
        expect(extractSceneFromDoc(doc).connections).toEqual([{ id: 'edge', from: 'source', to: 'target' }]);
    });

    it('creates nodes as deep Yjs maps and rejects duplicate IDs', () => {
        const { doc, commands } = makeCommands();
        const node: SceneNodeJson = { id: 'node-1', type: 'image', x: 5, y: 7, data: { alt: 'photo' } };

        expect(commands.createNode(node)).toBe(true);
        expect(commands.createNode(node)).toBe(false);
        expect(getNodesMap(doc).get('node-1')).toBeInstanceOf(Y.Map);
        expect(extractSceneFromDoc(doc).nodes).toEqual([node]);
    });

    it('updates a single nested field without replacing the node map', () => {
        const { doc, commands } = makeCommands();
        commands.createNode({ id: 'node-1', x: 0, y: 0, data: { alt: 'before', src: 'a.png' } });
        const original = getNodesMap(doc).get('node-1');

        expect(commands.updateNodeField('node-1', ['data', 'alt'], 'after')).toBe(true);
        expect(getNodesMap(doc).get('node-1')).toBe(original);
        expect(extractSceneFromDoc(doc).nodes[0].data).toEqual({ alt: 'after', src: 'a.png' });
    });

    it('commits a multi-node move in one transaction tagged with the local origin', () => {
        const { doc, commands } = makeCommands();
        commands.createNode({ id: 'a', x: 0, y: 0 });
        commands.createNode({ id: 'b', x: 1, y: 1 });
        const transactions: unknown[] = [];
        doc.on('afterTransaction', (transaction) => transactions.push(transaction.origin));

        expect(commands.moveNodes([{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 30, y: 40 }])).toBe(true);

        expect(transactions).toEqual([ORIGIN]);
        expect(extractSceneFromDoc(doc).nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
            { id: 'a', x: 10, y: 20 },
            { id: 'b', x: 30, y: 40 },
        ]);
    });

    it('creates, updates, and deletes connections using the persisted connections map', () => {
        const { doc, commands } = makeCommands();
        commands.createNode({ id: 'source', x: 0, y: 0 });
        commands.createNode({ id: 'target', x: 1, y: 1 });
        const connection: SceneConnectionJson = { id: 'edge-1', source: 'source', target: 'target', data: { label: 'a' } };

        expect(commands.createConnection(connection)).toBe(true);
        expect(commands.createConnection(connection)).toBe(false);
        expect(getConnectionsMap(doc).get('edge-1')).toBeInstanceOf(Y.Map);
        expect(commands.updateConnectionField('edge-1', ['data', 'label'], 'b')).toBe(true);
        expect(commands.deleteConnection('edge-1')).toBe(true);
        expect(commands.deleteConnection('edge-1')).toBe(false);
        expect(extractSceneFromDoc(doc).connections).toEqual([]);
    });

    it('applies an edge-policy replacement atomically in one local transaction', () => {
        const { doc, commands } = makeCommands();
        commands.createNode({ id: 'source', x: 0, y: 0 });
        commands.createNode({ id: 'target', x: 0, y: 0 });
        commands.createConnection({ id: 'old-edge', from: 'source', to: 'target' });
        const origins: unknown[] = [];
        doc.on('afterTransaction', (transaction) => origins.push(transaction.origin));

        expect(commands.applyConnectionChanges({ id: 'new-edge', from: 'source', to: 'target' }, ['old-edge'])).toBe(true);

        expect(origins).toEqual([ORIGIN]);
        expect(getConnectionsMap(doc).has('old-edge')).toBe(false);
        expect(getConnectionsMap(doc).has('new-edge')).toBe(true);
    });

    it('deletes incident connections with a node in one graph command', () => {
        const { doc, commands } = makeCommands();
        commands.createNode({ id: 'source', x: 0, y: 0 });
        commands.createNode({ id: 'target', x: 1, y: 1 });
        commands.createConnection({ id: 'edge-1', from: 'source', to: 'target' });

        expect(commands.deleteNode('source')).toBe(true);
        expect(getNodesMap(doc).has('source')).toBe(false);
        expect(getConnectionsMap(doc).has('edge-1')).toBe(false);
    });

    it('sets the scene name as a typed local-origin command', () => {
        const { doc, commands } = makeCommands();
        const origins: unknown[] = [];
        doc.on('afterTransaction', (transaction) => origins.push(transaction.origin));

        expect(commands.setSceneName('Shared board')).toBe(true);
        expect(origins).toEqual([ORIGIN]);
        expect(yValueToJson(doc.getMap('metadata').get('name'))).toBe('Shared board');
    });

    it('rejects updates and connections with missing entity IDs or endpoints', () => {
        const { commands } = makeCommands();
        expect(commands.updateNodeField('missing', ['x'], 3)).toBe(false);
        expect(commands.updateConnectionField('missing', ['type'], 'smooth')).toBe(false);
        expect(commands.createConnection({ id: 'bad-edge', from: 'missing-a', to: 'missing-b' })).toBe(false);
        expect(commands.deleteNode('missing')).toBe(false);
    });
});
