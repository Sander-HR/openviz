import { afterEach, describe, expect, it } from 'vitest';
import { createSceneDoc, seedSceneFromJson } from './sceneDocMapping';
import { createSceneDocProjection } from './sceneDocProjection';
import * as Y from 'yjs';

const docs: Y.Doc[] = [];
function makeDoc() {
    const doc = createSceneDoc();
    docs.push(doc);
    return doc;
}
afterEach(() => { for (const doc of docs.splice(0)) doc.destroy(); });

describe('createSceneDocProjection', () => {
    it('applies nested node and connection changes incrementally and exposes the scene name', async () => {
        const doc = makeDoc();
        seedSceneFromJson(doc, {
            nodes: [
                { id: 'a', type: 'image', x: 0, y: 0, data: { alt: 'a' } },
                { id: 'b', type: 'render', x: 1, y: 1, data: {} },
                { id: 'large', type: 'image', x: 2, y: 2, data: { payload: 'large-payload' } },
            ],
            connections: [{ id: 'edge', from: 'a', to: 'b' }],
        });
        const projection = createSceneDocProjection(doc);
        const stableNode = projection.snapshot().scene.nodes.find(({ id }) => id === 'large');
        let updates = 0;
        projection.subscribe(() => { updates += 1; });

        doc.transact(() => {
            const node = doc.getMap('nodes').get('a') as Y.Map<unknown>;
            (node.get('data') as Y.Map<unknown>).set('alt', 'changed');
            doc.getMap('metadata').set('name', 'Shared scene');
        }, 'user:a:1');
        await Promise.resolve();

        const snapshot = projection.snapshot();
        expect(snapshot.scene.nodes.find(({ id }) => id === 'a')?.data).toEqual({ alt: 'changed' });
        expect(snapshot.scene.nodes.find(({ id }) => id === 'large')).toBe(stableNode);
        expect(snapshot.scene.connections).toEqual([{ id: 'edge', from: 'a', to: 'b' }]);
        expect(snapshot.sceneName).toBe('Shared scene');
        expect(updates).toBe(1);
        projection.destroy();
    });

    it('drops dangling connections incrementally when an endpoint is deleted', async () => {
        const doc = makeDoc();
        seedSceneFromJson(doc, {
            nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 1 }],
            connections: [{ id: 'edge', from: 'a', to: 'b' }],
        });
        const projection = createSceneDocProjection(doc);

        doc.getMap('nodes').delete('b');
        await Promise.resolve();

        expect(projection.snapshot().scene.nodes.map(({ id }) => id)).toEqual(['a']);
        expect(projection.snapshot().scene.connections).toEqual([]);
        projection.destroy();
    });
});
