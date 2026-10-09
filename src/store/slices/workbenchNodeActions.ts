import type { AppState } from '../storeTypes';
import type { WorkbenchNode } from '../../types';
import { sceneFieldUpdatesFromObject } from '@/services/collab/sceneDocCommands';
import { addConnectionWithPolicy } from '../../services/workbench/connectionPolicy';
import type { SceneNodeJson } from '@/types/collab.types';
import { areWorkbenchSnapshotsEqual, createWorkbenchGestureTransaction, type WorkbenchGestureKind } from '../workbenchGestureHistory';
import { commitWorkbenchHistory, createWorkbenchSnapshot } from './workbenchSlice.utils';
import type { WorkbenchGet, WorkbenchSet, WorkbenchSlice } from './workbenchSlice.types';

export function createWorkbenchNodeActions(set: WorkbenchSet, get: WorkbenchGet): Pick<WorkbenchSlice, 'addWorkbenchNode' | 'createOneShotNode' | 'addConnection' | 'removeConnection' | 'updateWorkbenchNode' | 'updateWorkbenchNodeTransient' | 'commitWorkbenchNodePositions' | 'beginWorkbenchGesture' | 'commitWorkbenchGesture' | 'cancelWorkbenchGesture' | 'removeWorkbenchNode'> {
    return {
    addWorkbenchNode: (node) => {
        const state = get();
        if (state.collabSessionActive && state.collabDocumentCommands) {
            state.collabDocumentCommands.createNode(node as unknown as SceneNodeJson);
            return;
        }
        set((current: AppState) => {
            const newNodes = [...current.workbenchNodes, node];
            const newState: Partial<AppState> = { workbenchNodes: newNodes };
            if (current.currentProjectId) {
                newState.projectNodes = {
                    ...current.projectNodes,
                    [current.currentProjectId]: newNodes,
                };
            }
            return commitWorkbenchHistory(current, newState);
        });
    },

    createOneShotNode: (node) => {
        const state = get();
        if (state.collabSessionActive && state.collabDocumentCommands) {
            state.collabDocumentCommands.createNode(node as unknown as SceneNodeJson);
            set({ activeNodeId: node.id, selectedNodeIds: [node.id], activeWorkbenchTool: 'select' });
            return;
        }
        set((current: AppState) => {
            const newNodes = [...current.workbenchNodes, node];
            const newState: Partial<AppState> = {
                workbenchNodes: newNodes,
                activeNodeId: node.id,
                selectedNodeIds: [node.id],
                activeWorkbenchTool: 'select',
            };
            if (current.currentProjectId) {
                newState.projectNodes = {
                    ...current.projectNodes,
                    [current.currentProjectId]: newNodes,
                };
            }
            return commitWorkbenchHistory(current, newState);
        });
    },

    addConnection: (fromId, toId, sourceHandle, targetHandle) => {
        const current = get();
        if (current.collabSessionActive && current.collabDocumentCommands) {
            const next = addConnectionWithPolicy(current.connections, current.workbenchNodes, fromId, toId, sourceHandle, targetHandle);
            const currentIds = new Set(current.connections.map(({ id }) => id));
            const nextIds = new Set(next.map(({ id }) => id));
            const created = next.find(({ id }) => !currentIds.has(id));
            const deleted = current.connections.filter(({ id }) => !nextIds.has(id)).map(({ id }) => id);
            const documentConnection = created ? {
                id: created.id,
                from: created.from,
                to: created.to,
                sourceHandle: created.sourceHandle ?? null,
                targetHandle: created.targetHandle ?? null,
            } : null;
            current.collabDocumentCommands.applyConnectionChanges(documentConnection, deleted);
            return;
        }
        set((state: AppState) => commitWorkbenchHistory(state, {
            connections: addConnectionWithPolicy(state.connections, state.workbenchNodes, fromId, toId, sourceHandle, targetHandle),
        }));
    },

    removeConnection: (id) => {
        const state = get();
        if (state.collabSessionActive && state.collabDocumentCommands) {
            state.collabDocumentCommands.applyConnectionChanges(null, [id]);
            return;
        }
        set((current: AppState) => commitWorkbenchHistory(current, {
            connections: current.connections.filter((connection) => connection.id !== id),
        }));
    },

    updateWorkbenchNode: (id, updates) => {
        const current = get();
        if (current.collabSessionActive && current.collabDocumentCommands) {
            current.collabDocumentCommands.updateNodeFields(id, sceneFieldUpdatesFromObject(updates));
            return;
        }
        set((state: AppState) => {
        const nodes = state.workbenchNodes.map(n => {
            if (n.id !== id) return n;
            // Ensure project stays in sync if resolution properties are ever added, 
            // but as per requirements, we DO NOT update project.canvas from node resize.
            const updated = { ...n, ...updates } as WorkbenchNode;
            return updated;
        });
        
        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes
            };
        }
        return commitWorkbenchHistory(state, newState);
        });
    },

    updateWorkbenchNodeTransient: (id, updates) => set((state: AppState) => {
        const nodes = state.workbenchNodes.map((node) =>
            node.id === id ? ({ ...node, ...updates } as WorkbenchNode) : node
        );
        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes,
            };
        }
        return newState;
    }),

    commitWorkbenchNodePositions: (positions) => {
        const current = get();
        if (current.collabSessionActive && current.collabDocumentCommands) {
            current.collabDocumentCommands.moveNodes(positions);
            return;
        }
        set((state: AppState) => {
        if (positions.length === 0) return state;

        const positionById = new Map(positions.map(({ id, x, y }) => [id, { x, y }]));
        let changed = false;
        const nodes = state.workbenchNodes.map((node) => {
            const position = positionById.get(node.id);
            if (!position || (node.x === position.x && node.y === position.y)) return node;
            changed = true;
            return { ...node, x: position.x, y: position.y } as WorkbenchNode;
        });

        if (!changed) return state;

        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes,
            };
        }
        // The gesture commit owns the history snapshot. Avoid cloning the
        // whole scene here and again in commitWorkbenchGesture.
        return state.activeWorkbenchGesture ? newState : commitWorkbenchHistory(state, newState);
        });
    },

    beginWorkbenchGesture: (kind: WorkbenchGestureKind, affectedNodeIds = []) => set((state: AppState) => {
        if (state.activeWorkbenchGesture) {
            return state;
        }

        const snapshot = createWorkbenchSnapshot(
            state.workbenchNodes,
            state.connections,
            state.selectedNodeIds,
            state.activeNodeId
        );
        return {
            activeWorkbenchGesture: createWorkbenchGestureTransaction(
                kind,
                state.currentProjectId,
                snapshot,
                affectedNodeIds
            ),
        };
    }),

    commitWorkbenchGesture: () => set((state: AppState) => {
        const transaction = state.activeWorkbenchGesture;
        if (!transaction) {
            return state;
        }

        const finalSnapshot = createWorkbenchSnapshot(
            state.workbenchNodes,
            state.connections,
            state.selectedNodeIds,
            state.activeNodeId
        );
        const nextState: Partial<AppState> = { activeWorkbenchGesture: null };
        if (areWorkbenchSnapshotsEqual(transaction.startSnapshot, finalSnapshot)) {
            return nextState;
        }

        return commitWorkbenchHistory(state, nextState);
    }),

    cancelWorkbenchGesture: () => set((state: AppState) => {
        const transaction = state.activeWorkbenchGesture;
        if (!transaction) {
            return state;
        }

        const snapshot = transaction.startSnapshot;
        const nextNodes = structuredClone(snapshot.workbenchNodes);
        const nextState: Partial<AppState> = {
            workbenchNodes: nextNodes,
            connections: structuredClone(snapshot.connections),
            selectedNodeIds: [...snapshot.selectedNodeIds],
            activeNodeId: snapshot.activeNodeId,
            activeWorkbenchGesture: null,
        };
        if (state.currentProjectId) {
            nextState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nextNodes,
            };
        }
        return nextState;
    }),

    removeWorkbenchNode: (id) => {
        const state = get();
        // Remote soft locks (spec FR-015): a node another collaborator has
        // selected or is editing cannot be deleted from this session.
        const idsToRemove = (id ? [id] : state.selectedNodeIds).filter((nodeId) => !state.nodeLocks[nodeId]);
        if (idsToRemove.length === 0) return;

        // Release object URLs from removed uploaded images so blob memory does
        // not leak across add/remove cycles. Non-blob sources are untouched.
        state.workbenchNodes
            .filter((n) => idsToRemove.includes(n.id))
            .forEach((n) => {
                const source = n.type === 'media'
                    ? n.data?.src
                    : n.type === 'image'
                        ? n.project.layers.find((layer) => layer.image)?.image
                        : undefined;
                if (typeof source === 'string' && source.startsWith('blob:')) URL.revokeObjectURL(source);
            });

        if (state.collabSessionActive && state.collabDocumentCommands) {
            if (state.collabDocumentCommands.deleteNodes(idsToRemove)) {
                set({
                    selectedNodeIds: state.selectedNodeIds.filter((selectedId) => !idsToRemove.includes(selectedId)),
                    activeNodeId: idsToRemove.includes(state.activeNodeId as string) ? null : state.activeNodeId,
                });
            }
            return;
        }

        set(() => {
        const newNodes = state.workbenchNodes.filter(n => !idsToRemove.includes(n.id));
        const newState: Partial<AppState> = {
            workbenchNodes: newNodes,
            connections: state.connections.filter((c) => !idsToRemove.includes(c.from) && !idsToRemove.includes(c.to)),
            selectedNodeIds: state.selectedNodeIds.filter(sid => !idsToRemove.includes(sid)),
            activeNodeId: idsToRemove.includes(state.activeNodeId as string) ? null : state.activeNodeId
        };

        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: newNodes
            };
        }

        return commitWorkbenchHistory(state, newState);
        });
    }
    };
}
