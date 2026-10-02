import type { AppState } from '../storeTypes';
import { createWorkbenchSnapshot, commitWorkbenchHistory } from './workbenchSlice.utils';
import type { WorkbenchGet, WorkbenchSet, WorkbenchSlice } from './workbenchSlice.types';

export function createWorkbenchToolActions(set: WorkbenchSet, get: WorkbenchGet): Pick<WorkbenchSlice, 'setViewMode' | 'setExitingStudio' | 'setDrawMode' | 'toggleDrawMode' | 'setActiveWorkbenchTool' | 'setFreehandColor' | 'setFreehandStrokeWidth' | 'undoLastFreehandNode' | 'undoWorkbench' | 'redoWorkbench'> {
    return {
    setViewMode: (viewMode) => set((state: AppState) => {
        if (state.viewMode === viewMode) {
            return { viewMode };
        }

        return {
            viewMode,
            history: [structuredClone(state.project)],
            historyIndex: 0,
            workbenchHistory: [createWorkbenchSnapshot(
                state.workbenchNodes,
                state.connections,
                state.selectedNodeIds,
                state.activeNodeId
            )],
            workbenchHistoryIndex: 0,
            activeWorkbenchGesture: null,
        };
    }),

    setExitingStudio: (isExitingStudio) => set({ isExitingStudio }),

    setDrawMode: (isDrawMode) => set({
        isDrawMode,
        activeWorkbenchTool: isDrawMode ? 'draw' : 'select',
    }),

    toggleDrawMode: () => set((state: AppState) => {
        const nextIsDrawMode = !state.isDrawMode;
        return {
            isDrawMode: nextIsDrawMode,
            activeWorkbenchTool: nextIsDrawMode ? 'draw' : 'select',
        };
    }),

    setActiveWorkbenchTool: (activeWorkbenchTool) => set({
        activeWorkbenchTool,
        isDrawMode: activeWorkbenchTool === 'draw',
    }),

    setFreehandColor: (freehandColor) => set({ freehandColor }),

    setFreehandStrokeWidth: (freehandStrokeWidth) => set({ freehandStrokeWidth }),

    undoLastFreehandNode: () => {
        const state = get();
        let freehandIndex = -1;

        for (let index = state.workbenchNodes.length - 1; index >= 0; index -= 1) {
            if ((state.workbenchNodes[index] as { type: string }).type === 'freehand') {
                freehandIndex = index;
                break;
            }
        }

        if (freehandIndex === -1) {
            return state;
        }

        const removedNodeId = state.workbenchNodes[freehandIndex].id;
        if (state.collabSessionActive && state.collabDocumentCommands) {
            state.collabDocumentCommands.deleteNode(removedNodeId);
            set({ selectedNodeIds: state.selectedNodeIds.filter((id) => id !== removedNodeId) });
            return;
        }
        const nextNodes = state.workbenchNodes.filter((_, index) => index !== freehandIndex);
        const nextConnections = state.connections.filter(
            (connection) => connection.from !== removedNodeId && connection.to !== removedNodeId
        );

        const newState: Partial<AppState> = {
            workbenchNodes: nextNodes,
            connections: nextConnections,
            selectedNodeIds: state.selectedNodeIds.filter((selectedId) => selectedId !== removedNodeId),
            activeNodeId: state.activeNodeId === removedNodeId ? null : state.activeNodeId,
        };

        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nextNodes,
            };
        }

        set(() => commitWorkbenchHistory(state, newState));
    },

    undoWorkbench: () => set((state: AppState) => {
        // Collab mode: store-level undo would restore a snapshot that can
        // clobber remote changes — the toolbar uses the Yjs UndoManager.
        if (state.collabSessionActive) {
            return state;
        }
        if (state.activeWorkbenchGesture || state.workbenchHistoryIndex <= 0) {
            return state;
        }

        const nextIndex = state.workbenchHistoryIndex - 1;
        const snapshot = state.workbenchHistory[nextIndex];
        const newState: Partial<AppState> = {
            workbenchNodes: structuredClone(snapshot.workbenchNodes),
            connections: structuredClone(snapshot.connections),
            selectedNodeIds: [...snapshot.selectedNodeIds],
            activeNodeId: snapshot.activeNodeId,
            workbenchHistoryIndex: nextIndex,
        };

        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: structuredClone(snapshot.workbenchNodes),
            };
        }

        return newState;
    }),

    redoWorkbench: () => set((state: AppState) => {
        if (state.collabSessionActive) {
            return state;
        }
        if (state.activeWorkbenchGesture || state.workbenchHistoryIndex >= state.workbenchHistory.length - 1) {
            return state;
        }

        const nextIndex = state.workbenchHistoryIndex + 1;
        const snapshot = state.workbenchHistory[nextIndex];
        const newState: Partial<AppState> = {
            workbenchNodes: structuredClone(snapshot.workbenchNodes),
            connections: structuredClone(snapshot.connections),
            selectedNodeIds: [...snapshot.selectedNodeIds],
            activeNodeId: snapshot.activeNodeId,
            workbenchHistoryIndex: nextIndex,
        };

        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: structuredClone(snapshot.workbenchNodes),
            };
        }

        return newState;
    })
    };
}
