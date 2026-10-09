import type { AppState, WorkbenchHistorySnapshot } from '../storeTypes';
import type { Connection, MediaWorkbenchNode, WorkbenchNode, Project } from '../../types';
import { INITIAL_PROJECT } from '../initialState';
import { areWorkbenchSnapshotsEqual } from '../workbenchGestureHistory';

const MAX_WORKBENCH_HISTORY = 100;

export const createWorkbenchSnapshot = (
    workbenchNodes: WorkbenchNode[],
    connections: Connection[],
    selectedNodeIds: string[],
    activeNodeId: string | null
): WorkbenchHistorySnapshot => ({
    workbenchNodes: structuredClone(workbenchNodes),
    connections: structuredClone(connections),
    selectedNodeIds: [...selectedNodeIds],
    activeNodeId,
});

export const commitWorkbenchHistory = (state: AppState, nextState: Partial<AppState>): Partial<AppState> => {
    const snapshot = createWorkbenchSnapshot(
        (nextState.workbenchNodes ?? state.workbenchNodes) as WorkbenchNode[],
        (nextState.connections ?? state.connections) as Connection[],
        (nextState.selectedNodeIds ?? state.selectedNodeIds) as string[],
        (nextState.activeNodeId ?? state.activeNodeId) as string | null
    );

    // Collaborative history belongs to the session's Y.UndoManager.
    if (state.collabSessionActive) return nextState;

    const currentSnapshot = state.workbenchHistory[state.workbenchHistoryIndex];
    if (currentSnapshot && areWorkbenchSnapshotsEqual(currentSnapshot, snapshot)) return nextState;

    const historyWindow = state.workbenchHistory.slice(0, state.workbenchHistoryIndex + 1);
    const nextHistory = [...historyWindow, snapshot];
    const trimmedHistory = nextHistory.length > MAX_WORKBENCH_HISTORY
        ? nextHistory.slice(nextHistory.length - MAX_WORKBENCH_HISTORY)
        : nextHistory;

    return {
        ...nextState,
        workbenchHistory: trimmedHistory,
        workbenchHistoryIndex: trimmedHistory.length - 1,
    };
};

export function projectFromMediaNode(node: MediaWorkbenchNode): Project {
    const now = Date.now();
    const canvas = INITIAL_PROJECT.canvas;
    const layerId = `${node.id}-image`;

    return {
        ...INITIAL_PROJECT,
        id: node.id,
        name: node.data.alt || 'Uploaded image',
        createdAt: now,
        lastModifiedAt: now,
        layers: [{
            id: layerId,
            name: node.data.alt || 'Uploaded image',
            type: 'image',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            image: node.data.src,
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            order: 1,
            created: now,
            modified: now,
        }],
    };
}
