import { beforeEach, describe, expect, it } from 'vitest';
import type { NoteWorkbenchNode } from '@/types';
import { useStore } from './useStore';
import type { WorkbenchHistorySnapshot } from './storeTypes';

const makeNote = (x = 10, y = 20): NoteWorkbenchNode => ({
    id: 'note-1',
    type: 'note',
    x,
    y,
    data: { text: 'Test', colorVariant: 'yellow' },
});

const resetWorkbench = (node: NoteWorkbenchNode = makeNote()) => {
    const initialSnapshot: WorkbenchHistorySnapshot = {
        workbenchNodes: [node],
        connections: [],
        selectedNodeIds: [node.id],
        activeNodeId: node.id,
    };

    useStore.setState({
        currentProjectId: null,
        workbenchNodes: [node],
        projectNodes: {},
        connections: [],
        selectedNodeIds: [node.id],
        activeNodeId: node.id,
        activeWorkbenchGesture: null,
        workbenchHistory: [initialSnapshot],
        workbenchHistoryIndex: 0,
    });
};

describe('Workbench gesture transactions', () => {
    beforeEach(() => resetWorkbench());

    it('commits many transient position updates as one history action', () => {
        const store = useStore.getState();
        store.beginWorkbenchGesture('move', ['note-1']);
        store.updateWorkbenchNodeTransient('note-1', { x: 20, y: 30 });
        store.updateWorkbenchNodeTransient('note-1', { x: 40, y: 50 });
        store.commitWorkbenchGesture();

        const state = useStore.getState();
        expect(state.workbenchHistory).toHaveLength(2);
        expect(state.workbenchHistoryIndex).toBe(1);
        expect(state.workbenchNodes[0]).toMatchObject({ x: 40, y: 50 });

        state.undoWorkbench();
        expect(useStore.getState().workbenchNodes[0]).toMatchObject({ x: 10, y: 20 });
        state.redoWorkbench();
        expect(useStore.getState().workbenchNodes[0]).toMatchObject({ x: 40, y: 50 });
    });

    it('moves a selected group as one atomic history action', () => {
        const first = makeNote(10, 20);
        const second: NoteWorkbenchNode = { ...makeNote(30, 40), id: 'note-2' };
        resetWorkbench(first);
        useStore.setState({
            workbenchNodes: [first, second],
            selectedNodeIds: ['note-1', 'note-2'],
            activeNodeId: 'note-1',
            workbenchHistory: [{
                workbenchNodes: [first, second],
                connections: [],
                selectedNodeIds: ['note-1', 'note-2'],
                activeNodeId: 'note-1',
            }],
            workbenchHistoryIndex: 0,
        });

        const store = useStore.getState();
        store.beginWorkbenchGesture('move', ['note-1', 'note-2']);
        store.updateWorkbenchNodeTransient('note-1', { x: 50, y: 60 });
        store.updateWorkbenchNodeTransient('note-2', { x: 70, y: 80 });
        store.commitWorkbenchGesture();
        store.undoWorkbench();

        expect(useStore.getState().workbenchNodes).toEqual([first, second]);
    });

    it('clears both history stacks when switching between Studio and Workbench', () => {
        const store = useStore.getState();
        store.beginWorkbenchGesture('move', ['note-1']);
        store.updateWorkbenchNodeTransient('note-1', { x: 100, y: 200 });
        store.commitWorkbenchGesture();
        store.setViewMode('WORKBENCH');

        const state = useStore.getState();
        expect(state.workbenchHistory).toHaveLength(1);
        expect(state.workbenchHistoryIndex).toBe(0);
        expect(state.history).toHaveLength(1);
        expect(state.historyIndex).toBe(0);
    });

    it('does not undo while a gesture is active', () => {
        const store = useStore.getState();
        store.beginWorkbenchGesture('move', ['note-1']);
        store.updateWorkbenchNodeTransient('note-1', { x: 100, y: 200 });
        store.undoWorkbench();

        expect(useStore.getState().workbenchNodes[0]).toMatchObject({ x: 100, y: 200 });
        store.cancelWorkbenchGesture();
    });

    it('does not create history for a no-op transaction', () => {
        const store = useStore.getState();
        store.beginWorkbenchGesture('move', ['note-1']);
        store.commitWorkbenchGesture();

        expect(useStore.getState().workbenchHistory).toHaveLength(1);
        expect(useStore.getState().activeWorkbenchGesture).toBeNull();
    });

    it('restores the start snapshot when a gesture is cancelled', () => {
        const store = useStore.getState();
        store.beginWorkbenchGesture('move', ['note-1']);
        store.updateWorkbenchNodeTransient('note-1', { x: 100, y: 200 });
        store.cancelWorkbenchGesture();

        const state = useStore.getState();
        expect(state.workbenchNodes[0]).toMatchObject({ x: 10, y: 20 });
        expect(state.workbenchHistory).toHaveLength(1);
        expect(state.activeWorkbenchGesture).toBeNull();
    });
});
