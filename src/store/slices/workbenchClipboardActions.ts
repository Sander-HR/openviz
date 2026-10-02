import type { AppState } from '../storeTypes';
import type { SceneNodeJson } from '@/types/collab.types';
import { commitWorkbenchHistory } from './workbenchSlice.utils';
import type { WorkbenchGet, WorkbenchSet, WorkbenchSlice } from './workbenchSlice.types';

export function createWorkbenchClipboardActions(set: WorkbenchSet, get: WorkbenchGet): Pick<WorkbenchSlice, 'duplicateWorkbenchNode' | 'reorderWorkbenchNode' | 'copyToClipboard' | 'pasteFromClipboard'> {
    return {
    duplicateWorkbenchNode: (id) => {
        const current = get();
        const idsToDuplicate = id ? [id] : current.selectedNodeIds;
        if (idsToDuplicate.length === 0) return;
        const nodesToDuplicate = current.workbenchNodes.filter((node) => idsToDuplicate.includes(node.id));
        const idMap: Record<string, string> = {};
        const newNodes = nodesToDuplicate.map((node) => {
            const newId = Math.random().toString(36).slice(2, 11);
            idMap[node.id] = newId;
            const newNode = structuredClone(node);
            newNode.id = newId;
            newNode.x += 40;
            newNode.y += 40;
            if (newNode.type === 'image' || newNode.type === 'video') newNode.project.id = newId;
            newNode.projectId = node.projectId;
            return newNode;
        });
        const newConnections = current.connections
            .filter((connection) => idsToDuplicate.includes(connection.from) && idsToDuplicate.includes(connection.to))
            .map((connection) => ({
                id: Math.random().toString(36).slice(2, 11),
                from: idMap[connection.from],
                to: idMap[connection.to],
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
            }));

        if (current.collabSessionActive && current.collabDocumentCommands) {
            current.collabDocumentCommands.createGraph(
                newNodes as unknown as SceneNodeJson[],
                newConnections,
            );
            set({ selectedNodeIds: newNodes.map(({ id: nodeId }) => nodeId), activeNodeId: newNodes.length === 1 ? newNodes[0].id : current.activeNodeId });
            return;
        }

        set((state: AppState) => {
            const nextNodes = [...state.workbenchNodes, ...newNodes];
            const newState: Partial<AppState> = {
                workbenchNodes: nextNodes,
                connections: [...state.connections, ...newConnections],
                selectedNodeIds: newNodes.map((node) => node.id),
                activeNodeId: newNodes.length === 1 ? newNodes[0].id : state.activeNodeId,
            };
            if (state.currentProjectId) {
                newState.projectNodes = { ...state.projectNodes, [state.currentProjectId]: nextNodes };
            }
            return commitWorkbenchHistory(state, newState);
        });
    },

    reorderWorkbenchNode: (id, direction) => set((state: AppState) => {
        const index = state.workbenchNodes.findIndex(n => n.id === id);
        if (index === -1) return state;

        const nodes = [...state.workbenchNodes];
        const [node] = nodes.splice(index, 1);
        if (direction === 'front') {
            nodes.push(node);
        } else {
            nodes.unshift(node);
        }

        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes
            };
        }
        return commitWorkbenchHistory(state, newState);
    }),

    copyToClipboard: (id) => set((state: AppState) => {
        const idsToCopy = id ? [id] : state.selectedNodeIds;
        if (idsToCopy.length === 0) return state;

        const nodesToCopy = state.workbenchNodes.filter(n => idsToCopy.includes(n.id));
        return { clipboard: structuredClone(nodesToCopy) };
    }),

    pasteFromClipboard: (pos) => {
        const current = get();
        if (!current.clipboard || current.clipboard.length === 0) return;
        const minX = Math.min(...current.clipboard.map((node) => node.x));
        const minY = Math.min(...current.clipboard.map((node) => node.y));
        const idMap: Record<string, string> = {};
        const newNodes = current.clipboard.map((node) => {
            const newId = Math.random().toString(36).slice(2, 11);
            idMap[node.id] = newId;
            const newNode = structuredClone(node);
            newNode.id = newId;
            newNode.x = pos.x + (node.x - minX);
            newNode.y = pos.y + (node.y - minY);
            if (newNode.type === 'image' || newNode.type === 'video') newNode.project.id = newId;
            newNode.projectId = node.projectId;
            return newNode;
        });
        const clipboardIds = current.clipboard.map((node) => node.id);
        const newConnections = current.connections
            .filter((connection) => clipboardIds.includes(connection.from) && clipboardIds.includes(connection.to))
            .map((connection) => ({
                id: Math.random().toString(36).slice(2, 11),
                from: idMap[connection.from],
                to: idMap[connection.to],
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
            }));

        if (current.collabSessionActive && current.collabDocumentCommands) {
            current.collabDocumentCommands.createGraph(newNodes as unknown as SceneNodeJson[], newConnections);
            set({ selectedNodeIds: newNodes.map(({ id }) => id), activeNodeId: newNodes.length === 1 ? newNodes[0].id : current.activeNodeId });
            return;
        }
        set((state: AppState) => commitWorkbenchHistory(state, {
            workbenchNodes: [...state.workbenchNodes, ...newNodes],
            connections: [...state.connections, ...newConnections],
            selectedNodeIds: newNodes.map(({ id }) => id),
            activeNodeId: newNodes.length === 1 ? newNodes[0].id : state.activeNodeId,
        }));
    }
    };
}
