import type { AppState } from '../storeTypes';
import type { WorkbenchNode } from '../../types';
import { normalizeConnections } from '../../services/workbench/connectionPolicy';
import { createWorkbenchSnapshot, commitWorkbenchHistory } from './workbenchSlice.utils';
import type { WorkbenchGet, WorkbenchSet, WorkbenchSlice } from './workbenchSlice.types';

export function createWorkbenchStateActions(set: WorkbenchSet, _get: WorkbenchGet): Pick<WorkbenchSlice, 'setWorkbenchNodes' | 'projectCollaborativeGraph' | 'setProjectNodes' | 'setConnections' | 'setCurrentProjectId'> {
    return {
    setWorkbenchNodes: (nodes) => set((state: AppState) => {
        if (state.collabSessionActive) return state;
        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes
            };
        }
        return commitWorkbenchHistory(state, newState);
    }),

    projectCollaborativeGraph: (nodes, connections) => set((state: AppState) => {
        if (!state.collabSessionActive) return state;
        return {
            workbenchNodes: nodes,
            connections,
            projectNodes: state.currentProjectId
                ? { ...state.projectNodes, [state.currentProjectId]: nodes }
                : state.projectNodes,
        };
    }),

    setProjectNodes: (projectId, nodes) => set((state: AppState) => ({
        projectNodes: {
            ...state.projectNodes,
            [projectId]: nodes
        }
    })),

    setConnections: (connections) => set((state: AppState) => {
        if (state.collabSessionActive) return state;
        return commitWorkbenchHistory(state, {
            connections: normalizeConnections(connections, state.workbenchNodes),
        });
    }),

    setCurrentProjectId: (id) => set((state: AppState) => {
        const newState: Partial<AppState> = { currentProjectId: id };
        if (id && state.projectNodes[id]) {
            newState.workbenchNodes = state.projectNodes[id];
        } else if (id) {
            newState.workbenchNodes = [];
        }
        const nextNodes = (newState.workbenchNodes ?? state.workbenchNodes) as WorkbenchNode[];
        newState.connections = state.connections.filter((connection) =>
            nextNodes.some((node) => node.id === connection.from) && nextNodes.some((node) => node.id === connection.to)
        );
        newState.selectedNodeIds = [];
        newState.activeNodeId = null;
        newState.activeWorkbenchGesture = null;
        newState.history = [structuredClone(state.project)];
        newState.historyIndex = 0;
        newState.workbenchHistory = [createWorkbenchSnapshot(nextNodes, newState.connections, [], null)];
        newState.workbenchHistoryIndex = 0;
        return newState;
    })
    };
}
