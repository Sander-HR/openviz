import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { SceneDataJson } from '@/types/collab.types';
import { createSceneDoc, seedSceneFromJson, extractSceneFromDoc, getNodesMap, getConnectionsMap } from './sceneDocMapping';

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
});
