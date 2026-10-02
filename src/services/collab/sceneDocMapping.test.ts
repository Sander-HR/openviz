import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { SceneDataJson } from '@/types/collab.types';
import {
    createSceneDoc,
    seedSceneFromJson,
    extractSceneFromDoc,
    getNodesMap,
    getConnectionsMap,
    jsonToYValue,
    getSceneName,
    setSceneName,
    updateSceneEntityField,
} from './sceneDocMapping';

// Fixtures use the REAL persisted store shape (flat x/y — see BaseNode), not
// React Flow's `position` wrapper.
const sampleScene: SceneDataJson = {
    nodes: [
        { id: 'n1', type: 'image', x: 10, y: 20, data: { alt: 'hero', src: 'https://x/a.png' } },
        { id: 'n2', type: 'text', x: 300, y: 40, data: { text: 'caption', strokes: [] } },
        { id: 'n3', type: 'note', x: -5, y: 60.5, data: { note: 'wip' } },
    ],
    connections: [
        { id: 'c1', source: 'n1', target: 'n2', sourceHandle: null, targetHandle: null },
        { id: 'c2', source: 'n2', target: 'n3' },
    ],
};

describe('seedSceneFromJson', () => {
    it('preserves 100% of nodes and connections from saved scene JSON', () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, sampleScene);
        expect(extractSceneFromDoc(doc)).toEqual(sampleScene);
    });

    it('stores nodes and connections in keyed collections by ID', () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, sampleScene);
        const nodesMap = getNodesMap(doc);
        const connectionsMap = getConnectionsMap(doc);
        expect(Array.from(nodesMap.keys()).sort()).toEqual(['n1', 'n2', 'n3']);
        expect(Array.from(connectionsMap.keys()).sort()).toEqual(['c1', 'c2']);
    });

    it('re-seeding replaces the previous document content', () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, sampleScene);
        seedSceneFromJson(doc, { nodes: [{ id: 'only', x: 0, y: 0 }], connections: [] });
        expect(extractSceneFromDoc(doc)).toEqual({ nodes: [{ id: 'only', x: 0, y: 0 }], connections: [] });
    });

    it('round-trips through a second document without loss', () => {
        const docA = createSceneDoc();
        seedSceneFromJson(docA, sampleScene);
        const docB = createSceneDoc();
        Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
        expect(extractSceneFromDoc(docB)).toEqual(sampleScene);
    });
});

describe('extractSceneFromDoc', () => {
    it('prunes connections referencing absent node IDs during projection', () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, sampleScene);
        getNodesMap(doc).delete('n2'); // n2 disappears; c1 and c2 dangle
        const extracted = extractSceneFromDoc(doc);
        expect(extracted.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
        expect(extracted.connections).toEqual([]);
    });

    it('round-trips the persisted from/to connection format and prunes its orphans', () => {
        const persisted: SceneDataJson = {
            nodes: [
                { id: 'a1', x: 0, y: 0 },
                { id: 'a2', x: 9, y: 9 },
            ],
            connections: [{ id: 'ac1', from: 'a1', to: 'a2' }],
        };
        const doc = createSceneDoc();
        seedSceneFromJson(doc, persisted);
        expect(extractSceneFromDoc(doc)).toEqual(persisted);

        getNodesMap(doc).delete('a2'); // from/to orphan must prune too
        expect(extractSceneFromDoc(doc).connections).toEqual([]);
    });

    it('returns an empty scene for a fresh document', () => {
        const doc = createSceneDoc();
        expect(extractSceneFromDoc(doc)).toEqual({ nodes: [], connections: [] });
    });

    it('returns nodes and connections in deterministic ID order and skips malformed entries', () => {
        const doc = createSceneDoc();
        const nodes = getNodesMap(doc);
        const connections = getConnectionsMap(doc);
        nodes.set('z', jsonToYValue({ id: 'z', x: 0, y: 0 }));
        nodes.set('a', jsonToYValue({ id: 'a', x: 0, y: 0 }));
        nodes.set('invalid', jsonToYValue({ x: 1, y: 1 }));
        connections.set('z-edge', jsonToYValue({ id: 'z-edge', from: 'a', to: 'z' }));
        connections.set('invalid-edge', jsonToYValue({ id: 'invalid-edge', from: 'missing', to: 'z' }));

        expect(extractSceneFromDoc(doc)).toEqual({
            nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'z', x: 0, y: 0 }],
            connections: [{ id: 'z-edge', from: 'a', to: 'z' }],
        });
    });
});

describe('collaborative scene fields', () => {
    it('updates a nested field without replacing its containing node map', () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, sampleScene);
        const node = getNodesMap(doc).get('n1');

        expect(updateSceneEntityField(doc, 'nodes', 'n1', ['data', 'alt'], 'updated', 'user:a:1')).toBe(true);

        expect(getNodesMap(doc).get('n1')).toBe(node);
        expect(extractSceneFromDoc(doc).nodes[0]).toEqual({
            id: 'n1',
            type: 'image',
            x: 10,
            y: 20,
            data: { alt: 'updated', src: 'https://x/a.png' },
        });
    });

    it('merges concurrent edits to different nested fields of one node', () => {
        const first = createSceneDoc();
        const second = createSceneDoc();
        seedSceneFromJson(first, sampleScene);
        Y.applyUpdate(second, Y.encodeStateAsUpdate(first));

        updateSceneEntityField(first, 'nodes', 'n1', ['data', 'alt'], 'updated', 'user:a:1');
        updateSceneEntityField(second, 'nodes', 'n1', ['data', 'src'], 'https://x/new.png', 'user:b:2');
        Y.applyUpdate(first, Y.encodeStateAsUpdate(second));
        Y.applyUpdate(second, Y.encodeStateAsUpdate(first));

        expect(extractSceneFromDoc(first).nodes[0]).toEqual(extractSceneFromDoc(second).nodes[0]);
        expect(extractSceneFromDoc(first).nodes[0].data).toEqual({ alt: 'updated', src: 'https://x/new.png' });
    });

    it('round-trips a scene name in metadata without adding it to graph JSON', () => {
        const doc = createSceneDoc();
        expect(getSceneName(doc)).toBeUndefined();

        setSceneName(doc, 'Storyboard', 'user:a:1');

        expect(getSceneName(doc)).toBe('Storyboard');
        expect(extractSceneFromDoc(doc)).toEqual({ nodes: [], connections: [] });
    });

    it('returns false when a field path or entity does not exist', () => {
        const doc = createSceneDoc();
        seedSceneFromJson(doc, sampleScene);

        expect(updateSceneEntityField(doc, 'nodes', 'missing', ['x'], 10)).toBe(false);
        expect(updateSceneEntityField(doc, 'nodes', 'n1', ['data', 'unknown', 'leaf'], 'x')).toBe(false);
    });
});
