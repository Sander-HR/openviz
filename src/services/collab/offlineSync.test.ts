import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import type { IndexeddbPersistence } from 'y-indexeddb';
import { storeState, clearDocument } from 'y-indexeddb';

import type { SceneDataJson, SceneJsonValue } from '@/types/collab.types';
import { createSceneDoc, extractSceneFromDoc, getNodesMap, jsonToYValue, seedSceneFromJson } from './sceneDocMapping';
import { bindSceneOfflineStore, sceneOfflineStoreName } from './collabProviderFactory';
import { createCollabUndoManager } from './undoOrigin';
import { createSceneDocCommands } from './sceneDocCommands';

const SCENE_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_SCENE_ID = '99999999-8888-4777-8666-555555555555';

function sceneWithNode(id: string, text: string): SceneDataJson {
    return { nodes: [{ id, type: 'text', x: 0, y: 0, data: { text } }], connections: [] };
}

/** Opens a fresh doc bound to the scene's offline store and waits for the initial load. */
async function openScene(sceneId: string): Promise<{ doc: Y.Doc; persistence: IndexeddbPersistence; close: () => Promise<void> }> {
    const doc = createSceneDoc();
    const persistence = bindSceneOfflineStore(doc, sceneId);
    await persistence.whenSynced;
    return { doc, persistence, close: () => persistence.destroy() };
}

beforeEach(async () => {
    // Isolate every test on its own (empty) offline stores.
    await clearDocument(sceneOfflineStoreName(SCENE_ID));
    await clearDocument(sceneOfflineStoreName(OTHER_SCENE_ID));
});

describe('per-scene offline store (US3 / SC-004)', () => {
    it('persists local edits across a simulated disconnect and store close/reopen', async () => {
        // Session 1: edit the scene, then the browser closes.
        const first = await openScene(SCENE_ID);
        seedSceneFromJson(first.doc, sceneWithNode('n1', 'hello'));
        await storeState(first.persistence, true); // force flush to IndexedDB
        await first.close();

        // Session 2 (new browser): reopen the same scene — the edit survived.
        const second = await openScene(SCENE_ID);
        const scene = extractSceneFromDoc(second.doc);
        expect(scene.nodes.map((node) => node.id)).toEqual(['n1']);
        await second.close();
    });

    it('persists document content but never persists the session-local undo stack', async () => {
        const first = await openScene(SCENE_ID);
        seedSceneFromJson(first.doc, sceneWithNode('n1', 'base'));
        const undo = createCollabUndoManager(first.doc, 'user:a:1');
        const node = getNodesMap(first.doc).get('n1') as Y.Map<unknown>;
        first.doc.transact(() => (node.get('data') as Y.Map<unknown>).set('text', 'edited'), 'user:a:1');
        expect(undo.canUndo()).toBe(true);
        undo.undo();
        await storeState(first.persistence, true);
        undo.destroy();
        await first.close();

        const second = await openScene(SCENE_ID);
        expect(extractSceneFromDoc(second.doc).nodes[0].data).toMatchObject({ text: 'base' });
        expect(Object.keys(second.doc.toJSON())).not.toContain('undo');
        const reopenedUndo = createCollabUndoManager(second.doc, 'user:a:1');
        expect(reopenedUndo.canUndo()).toBe(false);
        reopenedUndo.destroy();
        await second.close();
    });

    it('merges two offline sides after reconnect with zero lost edits', async () => {
        // Base state committed to the shared store.
        const base = await openScene(SCENE_ID);
        seedSceneFromJson(base.doc, sceneWithNode('n1', 'base'));
        await storeState(base.persistence, true);
        await base.close();

        // Peer A goes offline and edits n1; peer B (server side) adds n2 meanwhile.
        // Both start from the persisted base — no re-seeding (a wipe would leave
        // CRDT tombstones that legitimately suppress the older insert on merge).
        const peerA = await openScene(SCENE_ID);
        const nodeA = peerA.doc.getMap('nodes').get('n1') as Y.Map<unknown>;
        peerA.doc.transact(() => {
            (nodeA.get('data') as Y.Map<unknown>).set('text', 'edited-by-A');
        }, 'user:a:1');

        const peerB = await openScene(SCENE_ID);
        peerB.doc.transact(() => {
            getNodesMap(peerB.doc).set('n2', jsonToYValue(sceneWithNode('n2', 'added-by-B').nodes[0] as unknown as SceneJsonValue));
        }, 'user:b:2');

        // Reconnect: state-vector sync both ways.
        Y.applyUpdate(peerA.doc, Y.encodeStateAsUpdate(peerB.doc));
        Y.applyUpdate(peerB.doc, Y.encodeStateAsUpdate(peerA.doc));

        const mergedA = extractSceneFromDoc(peerA.doc);
        const mergedB = extractSceneFromDoc(peerB.doc);
        for (const scene of [mergedA, mergedB]) {
            expect(scene.nodes.map((node) => node.id).sort()).toEqual(['n1', 'n2']);
            const n1 = scene.nodes.find((node) => node.id === 'n1');
            expect(n1?.data).toMatchObject({ text: 'edited-by-A' });
        }
        await peerA.close();
        await peerB.close();
    });

    it('persists only the completed offline move and never pointer history or awareness fields', async () => {
        const session = await openScene(SCENE_ID);
        seedSceneFromJson(session.doc, sceneWithNode('n1', 'move'));
        const commands = createSceneDocCommands(session.doc, 'user:offline:1');
        commands.moveNodes([{ id: 'n1', x: 120, y: 80 }]);
        await storeState(session.persistence, true);
        await session.close();

        const restored = await openScene(SCENE_ID);
        const saved = extractSceneFromDoc(restored.doc);
        expect(saved.nodes[0]).toMatchObject({ x: 120, y: 80 });
        expect(JSON.stringify(restored.doc.toJSON())).not.toMatch(/cursor|pointer|awareness/i);
        await restored.close();
    });

    it('keeps offline stores isolated per scene', async () => {
        const first = await openScene(SCENE_ID);
        seedSceneFromJson(first.doc, sceneWithNode('n1', 'only-in-scene-1'));
        await storeState(first.persistence, true);
        await first.close();

        const other = await openScene(OTHER_SCENE_ID);
        expect(extractSceneFromDoc(other.doc).nodes).toHaveLength(0);
        await other.close();
    });
});
