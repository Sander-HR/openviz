import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { SceneDataJson } from '@/types/collab.types';
import { createSceneDoc, getNodesMap, jsonToYValue, extractSceneFromDoc } from './sceneDocMapping';
import { createCollabUndoManager } from './undoOrigin';

const ORIGIN_A = 'user:alice';
const ORIGIN_B = 'user:bob';

// Node payloads use the real persisted store shape (flat x/y — see BaseNode).
function setNode(doc: Y.Doc, id: string, x: number, y: number, origin: string): void {
    doc.transact(() => {
        getNodesMap(doc).set(id, jsonToYValue({ id, x, y }));
    }, origin);
}

function moveNode(doc: Y.Doc, id: string, x: number, y: number, origin: string): void {
    doc.transact(() => {
        const node = getNodesMap(doc).get(id) as Y.Map<unknown>;
        node.set('x', x);
        node.set('y', y);
    }, origin);
}

function nodeXY(doc: Y.Doc, id: string): { x: number; y: number } {
    const scene = extractSceneFromDoc(doc) as SceneDataJson;
    const node = scene.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`missing node ${id}`);
    return { x: Number(node.x), y: Number(node.y) };
}

describe('createCollabUndoManager (SC-005, FR-008)', () => {
    it('tracks only the local origin — remote changes are not undoable', () => {
        const doc = createSceneDoc();
        const undo = createCollabUndoManager(doc, ORIGIN_A);

        setNode(doc, 'theirs', 1, 2, ORIGIN_B); // remote-only change

        expect(undo.canUndo()).toBe(false);
    });

    it('one completed gesture (a single transaction) is exactly one undo step', () => {
        const doc = createSceneDoc();
        // Pre-existing content: created before the session joined, not undoable.
        setNode(doc, 'n1', 0, 0, ORIGIN_A);
        const undo = createCollabUndoManager(doc, ORIGIN_A);

        // One gesture: several field changes inside ONE origin-tagged transaction.
        doc.transact(() => {
            const node = getNodesMap(doc).get('n1') as Y.Map<unknown>;
            node.set('x', 50);
            node.set('y', -20);
        }, ORIGIN_A);

        expect(undo.canUndo()).toBe(true);
        undo.undo();
        expect(nodeXY(doc, 'n1')).toEqual({ x: 0, y: 0 });
        // Exactly one step was consumed — the pre-join node is not on the stack.
        expect(undo.canUndo()).toBe(false);
    });

    it('undoing own actions leaves all remote changes intact', () => {
        const doc = createSceneDoc();
        const undo = createCollabUndoManager(doc, ORIGIN_A);

        setNode(doc, 'mine', 0, 0, ORIGIN_A);
        setNode(doc, 'theirs', 9, 9, ORIGIN_B);
        moveNode(doc, 'mine', 5, 5, ORIGIN_A);

        undo.undo();

        expect(nodeXY(doc, 'mine')).toEqual({ x: 0, y: 0 });
        const scene = extractSceneFromDoc(doc) as SceneDataJson;
        expect(scene.nodes.map((n) => n.id).sort()).toEqual(['mine', 'theirs']);
        expect(nodeXY(doc, 'theirs')).toEqual({ x: 9, y: 9 });
    });

    it('redo restores the undone local gesture', () => {
        const doc = createSceneDoc();
        const undo = createCollabUndoManager(doc, ORIGIN_A);

        setNode(doc, 'n1', 0, 0, ORIGIN_A);
        moveNode(doc, 'n1', 5, 5, ORIGIN_A);
        undo.undo();
        expect(undo.canRedo()).toBe(true);

        undo.redo();
        expect(nodeXY(doc, 'n1')).toEqual({ x: 5, y: 5 });
    });

    it('a new local edit after undo truncates the redo path', () => {
        const doc = createSceneDoc();
        const undo = createCollabUndoManager(doc, ORIGIN_A);

        setNode(doc, 'n1', 0, 0, ORIGIN_A);
        moveNode(doc, 'n1', 5, 5, ORIGIN_A);
        undo.undo();

        moveNode(doc, 'n1', 7, 7, ORIGIN_A); // diverging local edit

        expect(undo.canRedo()).toBe(false);
        undo.redo(); // must be a no-op
        expect(nodeXY(doc, 'n1')).toEqual({ x: 7, y: 7 });
    });
});
