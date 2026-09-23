// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import type { SceneDataJson } from '../../src/types/collab.types';
import { createSceneDoc, seedSceneFromJson, extractSceneFromDoc, getNodesMap, jsonToYValue } from '../../src/services/collab/sceneDocMapping';
import { createFetch, createStore, parseOriginUser } from './persistence';

const SCENE_ID = 'scene-1';

const sampleData: SceneDataJson = {
    nodes: [{ id: 'n1', type: 'image', position: { x: 1, y: 2 }, data: { alt: 'a' } }],
    connections: [],
};

function makeDoc(data: SceneDataJson): Y.Doc {
    const doc = createSceneDoc();
    seedSceneFromJson(doc, data);
    return doc;
}

function fakeStorePayload(document: Y.Doc, lastTransactionOrigin: unknown) {
    return {
        clientsCount: 1,
        document,
        lastContext: { userId: 'u-9' },
        lastTransactionOrigin,
        documentName: SCENE_ID,
        instance: null,
        state: Y.encodeStateAsUpdate(document),
    } as never;
}

describe('createFetch (load / lazy import)', () => {
    it('prefers the stored ydoc over JSON when both exist', async () => {
        const doc = makeDoc(sampleData);
        const ydocBytes = Y.encodeStateAsUpdate(doc);
        const getScene = vi.fn(async () => ({ id: SCENE_ID, data: sampleData, ydoc: ydocBytes }));
        const fetch = createFetch({ getScene });
        const result = await fetch({ documentName: SCENE_ID } as never);
        expect(new Uint8Array(result)).toEqual(ydocBytes);
    });

    it('seeds from JSON when ydoc is absent, preserving 100% of content (SC-007)', async () => {
        const rich: SceneDataJson = {
            nodes: [
                { id: 'a', position: { x: 0, y: 0 }, data: {} },
                { id: 'b', position: { x: 9, y: 9 }, data: { text: 'hi' } },
            ],
            connections: [{ id: 'c1', source: 'a', target: 'b' }],
        };
        const getScene = vi.fn(async () => ({ id: SCENE_ID, data: rich, ydoc: null }));
        const fetch = createFetch({ getScene });
        const result = await fetch({ documentName: SCENE_ID } as never);
        expect(result).not.toBeNull();
        const decoded = createSceneDoc(); // empty doc — the update must carry all content
        Y.applyUpdate(decoded, result!);
        expect(extractSceneFromDoc(decoded)).toEqual(rich);
    });

    it('returns null for a scene that does not exist yet', async () => {
        const getScene = vi.fn(async () => null);
        const fetch = createFetch({ getScene });
        expect(await fetch({ documentName: SCENE_ID } as never)).toBeNull();
    });
});

describe('US5 adoption cycle (SC-007)', () => {
    it('JSON-only scene seeds on first open, and reload loads the converged ydoc — not a stale snapshot', async () => {
        // In-memory stand-in for the scenes row, mutated by the store hook.
        let row: { id: string; data: SceneDataJson; ydoc: Uint8Array | null } = {
            id: SCENE_ID,
            data: sampleData,
            ydoc: null, // pre-feature scene: JSON only
        };
        const deps = {
            getScene: vi.fn(async () => row),
            saveScene: vi.fn(async (input: { data: SceneDataJson; ydoc: Uint8Array }) => {
                row = { id: SCENE_ID, data: input.data, ydoc: input.ydoc };
            }),
        };
        const fetch = createFetch(deps);
        const store = createStore(deps);

        // First collaborative open: seeded from the saved JSON.
        const first = await fetch({ documentName: SCENE_ID } as never);
        expect(first).not.toBeNull();
        const doc = new Y.Doc();
        Y.applyUpdate(doc, first!);
        expect(extractSceneFromDoc(doc).nodes.map((node) => node.id)).toEqual(['n1']);

        // A collaborator adds a node; the server persists the converged state.
        doc.transact(() => {
            getNodesMap(doc).set('n2', jsonToYValue({ id: 'n2', type: 'text', x: 3, y: 4, data: { text: 'added live' } } as never));
        }, 'user:b:1');
        await store(fakeStorePayload(doc, 'user:b:1') as never);
        expect(deps.saveScene).toHaveBeenCalledTimes(1);

        // Simulate the JSON snapshot going stale (e.g. a failed partial write).
        // The reload must still load the converged state from the ydoc.
        row.data = sampleData; // only n1 — stale

        const second = await fetch({ documentName: SCENE_ID } as never);
        expect(second).not.toBeNull();
        const reloaded = new Y.Doc();
        Y.applyUpdate(reloaded, second!);
        expect(extractSceneFromDoc(reloaded).nodes.map((node) => node.id)).toEqual(['n1', 'n2']);
    });
});

describe('createStore (save)', () => {
    it('writes extracted data, encoded ydoc, and the last editor from the transaction origin', async () => {
        const doc = makeDoc(sampleData);
        const saveScene = vi.fn(async () => undefined);
        const store = createStore({ saveScene });
        await store(fakeStorePayload(doc, 'user:u-9'));
        expect(saveScene).toHaveBeenCalledTimes(1);
        const input = saveScene.mock.calls[0][0];
        expect(input.sceneId).toBe(SCENE_ID);
        expect(input.data).toEqual(sampleData);
        expect(new Uint8Array(input.ydoc)).toEqual(Y.encodeStateAsUpdate(doc));
        expect(input.updatedBy).toBe('u-9');
    });

    it('uses null updatedBy for non-user transaction origins', async () => {
        const doc = makeDoc(sampleData);
        const saveScene = vi.fn(async () => undefined);
        await createStore({ saveScene })(fakeStorePayload(doc, 'hocuspocus-sync'));
        expect(saveScene.mock.calls[0][0].updatedBy).toBeNull();
    });

    it('a failed save never throws and is retried on the next trigger', async () => {
        const doc = makeDoc(sampleData);
        let calls = 0;
        const saveScene = vi.fn(async () => {
            calls += 1;
            if (calls === 1) throw new Error('db down');
        });
        const store = createStore({ saveScene, log: vi.fn() });
        await expect(store(fakeStorePayload(doc, 'user:u-9'))).resolves.toBeUndefined();
        await expect(store(fakeStorePayload(doc, 'user:u-9'))).resolves.toBeUndefined();
        expect(saveScene).toHaveBeenCalledTimes(2);
    });
});

describe('parseOriginUser', () => {
    it('extracts the user id from local client origins only', () => {
        expect(parseOriginUser('user:u-42')).toBe('u-42');
        // Per-client origin suffix (multi-tab isolation) must not leak into userId.
        expect(parseOriginUser('user:u-42:client-7')).toBe('u-42');
        expect(parseOriginUser('hocuspocus')).toBeNull();
        expect(parseOriginUser(null)).toBeNull();
        expect(parseOriginUser({})).toBeNull();
    });
});
