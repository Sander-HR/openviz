import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import * as Y from 'yjs';
import type { WorkbenchNode } from '@/types';
import { useStore } from '@/store/useStore';
import { createSceneDoc, extractSceneFromDoc, jsonToYValue, seedSceneFromJson } from '@/services/collab/sceneDocMapping';
import { useWorkbenchGraphProjection } from './useWorkbenchGraphProjection';

const docs: Y.Doc[] = [];

function createDoc(): Y.Doc {
    useStore.setState({ collabSessionActive: true });
    const doc = createSceneDoc();
    docs.push(doc);
    return doc;
}

afterEach(() => {
    useStore.setState({ workbenchNodes: [], connections: [], collabSessionActive: false });
    for (const doc of docs.splice(0)) doc.destroy();
});

describe('useWorkbenchGraphProjection', () => {
    it('projects the canonical graph and scene name from the document', async () => {
        const doc = createDoc();
        seedSceneFromJson(doc, {
            nodes: [
                { id: 'z-node', type: 'render', x: 4, y: 5, data: {} },
                { id: 'a-node', type: 'image', x: 1, y: 2, data: {} },
            ],
            connections: [{ id: 'edge-1', from: 'a-node', to: 'z-node' }],
        });
        doc.getMap('metadata').set('name', 'Storyboard');

        const { result } = renderHook(() => useWorkbenchGraphProjection({ doc, enabled: true }));

        await waitFor(() => expect(useStore.getState().workbenchNodes.map(({ id }) => id)).toEqual(['a-node', 'z-node']));
        expect(useStore.getState().connections).toMatchObject([{ id: 'edge-1', from: 'a-node', to: 'z-node' }]);
        expect(result.current.sceneName).toBe('Storyboard');
    });

    it('projects subsequent Y.Doc updates without replacing unaffected graph nodes', async () => {
        const doc = createDoc();
        seedSceneFromJson(doc, {
            nodes: [{ id: 'shared', type: 'note', x: 0, y: 0, data: { text: 'shared' } }, { id: 'stable', type: 'note', x: 1, y: 1, data: { text: 'stable' } }],
            connections: [],
        });
        const { result } = renderHook(() => useWorkbenchGraphProjection({ doc, enabled: true }));

        await waitFor(() => expect(useStore.getState().workbenchNodes).toHaveLength(2));
        const stableNode = useStore.getState().workbenchNodes.find(({ id }) => id === 'stable');
        act(() => {
            doc.transact(() => {
                doc.getMap('nodes').set('remote', jsonToYValue({ id: 'remote', x: 7, y: 8 }));
                doc.getMap('metadata').set('name', 'Renamed');
            }, 'user:remote:9');
        });
        await waitFor(() => expect(useStore.getState().workbenchNodes.map(({ id }) => id)).toContain('remote'));
        expect(useStore.getState().workbenchNodes.find(({ id }) => id === 'stable')).toBe(stableNode);
        await waitFor(() => expect(result.current.sceneName).toBe('Renamed'));

        act(() => {
            useStore.setState({ workbenchNodes: [{ id: 'ui-only', type: 'image', x: 9, y: 9 } as WorkbenchNode] });
        });

        expect(extractSceneFromDoc(doc).nodes.map(({ id }) => id)).toEqual(['remote', 'shared', 'stable']);
        expect(useStore.getState().workbenchNodes.map(({ id }) => id)).toEqual(['ui-only']);
    });

    it('stops observing document changes when disabled or unmounted', async () => {
        const doc = createDoc();
        seedSceneFromJson(doc, { nodes: [{ id: 'initial', x: 0, y: 0 }], connections: [] });
        const { rerender, unmount } = renderHook(
            ({ enabled }) => useWorkbenchGraphProjection({ doc, enabled }),
            { initialProps: { enabled: true } },
        );
        await waitFor(() => expect(useStore.getState().workbenchNodes.map(({ id }) => id)).toEqual(['initial']));

        rerender({ enabled: false });
        act(() => doc.transact(() => doc.getMap('nodes').set('later', jsonToYValue({ id: 'later' }))));
        expect(useStore.getState().workbenchNodes.map(({ id }) => id)).toEqual(['initial']);

        rerender({ enabled: true });
        act(() => doc.transact(() => doc.getMap('nodes').set('active', jsonToYValue({ id: 'active' }))));
        await waitFor(() => expect(useStore.getState().workbenchNodes.map(({ id }) => id)).toEqual(['active', 'initial', 'later']));
        unmount();
        act(() => doc.transact(() => doc.getMap('nodes').set('after-unmount', jsonToYValue({ id: 'after-unmount' }))));
        expect(useStore.getState().workbenchNodes.map(({ id }) => id)).toEqual(['active', 'initial', 'later']);
    });
});
