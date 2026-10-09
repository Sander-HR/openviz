import type { AppState } from '../storeTypes';
import type { ImageNode, VideoNode } from '../../types';
import { findNonOverlappingPosition } from '../../services/nodePositioning';
import { sceneFieldUpdatesFromObject } from '@/services/collab/sceneDocCommands';
import type { SceneNodeJson } from '@/types/collab.types';
import { createWorkbenchSnapshot, projectFromMediaNode } from './workbenchSlice.utils';
import type { WorkbenchGet, WorkbenchSet, WorkbenchSlice } from './workbenchSlice.types';

export function createWorkbenchSceneActions(set: WorkbenchSet, get: WorkbenchGet): Pick<WorkbenchSlice, 'saveCurrentToWorkbench' | 'openNodeInStudio' | 'setActiveNodeId' | 'setSelectedNodeIds'> {
    return {
    saveCurrentToWorkbench: (thumbnailRef) => {
        const state = get() as AppState;
        // Refs-only contract: `thumbnailRef` is a durable S3 ref (or null when
        // the canvas upload failed). When null, keep the previous thumbnail —
        // never write an inline data URL into the scene.
        const currentProject = {
            ...state.project,
            ...(thumbnailRef ? { thumbnail: thumbnailRef } : {}),
            lastModifiedAt: Date.now(),
        };
        const existingNode = state.workbenchNodes.find(n => n.id === state.activeNodeId);

        // Sync to backend using currentProjectId (the real project ID from database)
        // This should work for both the main project and nodes created from it
        if (state.currentProjectId && thumbnailRef) {
            fetch(`/api/projects/${state.currentProjectId}`, {
                method: 'PATCH',
                body: JSON.stringify({ thumbnailUrl: thumbnailRef }),
                headers: { 'Content-Type': 'application/json' }
            }).catch(err => console.error("Failed to sync thumbnail:", err));
        }

        // Get render results for the current active node
        const nodeRenderResults = state.renderResults.filter(r =>
            r.sourceNodeId === state.activeNodeId ||
            (!r.sourceNodeId && state.activeNodeId === 'default')
        );

        if (state.collabSessionActive && state.collabDocumentCommands) {
            if (existingNode) {
                const canvasWidth = currentProject.canvas.width;
                const canvasHeight = currentProject.canvas.height;
                const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);
                state.collabDocumentCommands.updateNodeFields(existingNode.id, sceneFieldUpdatesFromObject({
                    project: currentProject,
                    renderResults: nodeRenderResults,
                    scale: thumbnailScale,
                    width: canvasWidth * thumbnailScale,
                    height: canvasHeight * thumbnailScale,
                }));
            } else {
                const canvasWidth = currentProject.canvas.width;
                const canvasHeight = currentProject.canvas.height;
                const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);
                const { x, y } = findNonOverlappingPosition({
                    startX: 100,
                    startY: 100,
                    nodeWidth: canvasWidth * thumbnailScale,
                    nodeHeight: canvasHeight * thumbnailScale,
                    existingNodes: state.workbenchNodes,
                    columns: 4,
                    gap: 50,
                    margin: 50,
                });
                const newNode: ImageNode = {
                    id: currentProject.id,
                    type: 'image',
                    name: currentProject.name,
                    x,
                    y,
                    width: canvasWidth * thumbnailScale,
                    height: canvasHeight * thumbnailScale,
                    scale: thumbnailScale,
                    project: currentProject,
                    projectId: state.currentProjectId || undefined,
                    renderResults: nodeRenderResults,
                };
                state.collabDocumentCommands.createNode(newNode as unknown as SceneNodeJson);
                set({ activeNodeId: newNode.id });
            }
            set({ project: currentProject });
            return;
        }

        if (existingNode) {
            // Recalculate scale based on new canvas dimensions to maintain visual size (or reset to default fit)
            // If the node already has a scale, we might want to keep it proportional or reset it.
            // Let's reset it to fit 256px to ensure it looks good if aspect ratio changed drastically.
            const canvasWidth = currentProject.canvas.width;
            const canvasHeight = currentProject.canvas.height;
            const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);

            set({
                project: currentProject,
                workbenchNodes: state.workbenchNodes.map(n =>
                    n.id === state.activeNodeId ? { 
                        ...n, 
                        project: currentProject, 
                        renderResults: nodeRenderResults,
                        scale: thumbnailScale,
                        // We can optionally update width/height for backward compatibility or remove them.
                        // For now, let's update them to match the new scale so everything stays in sync.
                        width: canvasWidth * thumbnailScale,
                        height: canvasHeight * thumbnailScale
                    } : n
                )
            });
        } else {
            // Standardize thumbnail scaling: Fit canvas into 256px max dimension
            const canvasWidth = currentProject.canvas.width;
            const canvasHeight = currentProject.canvas.height;
            const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);
            const nodeWidth = canvasWidth * thumbnailScale;
            const nodeHeight = canvasHeight * thumbnailScale;

            // Find non-overlapping position
            const { x, y } = findNonOverlappingPosition({
                startX: 100,
                startY: 100,
                nodeWidth,
                nodeHeight,
                existingNodes: state.workbenchNodes,
                columns: 4,
                gap: 50,
                margin: 50
            });

            const newNode: ImageNode = {
                id: currentProject.id,
                type: 'image',
                name: currentProject.name,
                x,
                y,
                width: nodeWidth,
                height: nodeHeight,
                scale: thumbnailScale,
                project: currentProject,
                projectId: state.currentProjectId || undefined,
                renderResults: nodeRenderResults
            };
            set({
                project: currentProject,
                workbenchNodes: [...state.workbenchNodes, newNode],
                activeNodeId: newNode.id
            });
        }
    },

    openNodeInStudio: (id) => {
        const state = get() as AppState;
        const node = state.workbenchNodes.find(n => n.id === id);
        if (!node) return;

        if (node.type === 'image' || node.type === 'video') {
            const nodeRenderResults = (node as ImageNode | VideoNode).renderResults || [];
            set({
                project: node.project,
                activeNodeId: id,
                history: [node.project],
                historyIndex: 0,
                renderResults: nodeRenderResults,
                viewMode: 'STUDIO',
                workbenchHistory: [createWorkbenchSnapshot(state.workbenchNodes, state.connections, state.selectedNodeIds, id)],
                workbenchHistoryIndex: 0,
                activeWorkbenchGesture: null,
            });
        } else if (node.type === 'media') {
            // Media uploads are canvas images without a saved Project yet.
            // Materialize a minimal editor project when the node is opened so
            // double-clicking an upload enters the same editor as a sketch.
            const mediaProject = projectFromMediaNode(node);
            set({
                project: mediaProject,
                activeNodeId: id,
                history: [mediaProject],
                historyIndex: 0,
                renderResults: [],
                viewMode: 'STUDIO',
                workbenchHistory: [createWorkbenchSnapshot(state.workbenchNodes, state.connections, state.selectedNodeIds, id)],
                workbenchHistoryIndex: 0,
                activeWorkbenchGesture: null,
            });
        } else {
            set({
                activeNodeId: id,
                viewMode: 'STUDIO',
                workbenchHistory: [createWorkbenchSnapshot(state.workbenchNodes, state.connections, state.selectedNodeIds, id)],
                workbenchHistoryIndex: 0,
                activeWorkbenchGesture: null,
            });
        }
    },

    setActiveNodeId: (id) => set((state: AppState) => {
        if (!id) return { activeNodeId: null, selectedNodeIds: [] };

        const node = state.workbenchNodes.find(n => n.id === id);
        if (!node) return state;

        const newState: Partial<AppState> = {
            activeNodeId: id,
            selectedNodeIds: [id]
        };

        if (node.type === 'image' || node.type === 'video') {
            // Load the node's render results into global state
            const nodeRenderResults = (node as ImageNode | VideoNode).renderResults || [];
            newState.project = node.project;
            newState.history = [node.project];
            newState.historyIndex = 0;
            newState.renderResults = nodeRenderResults;
        } else if (node.type === 'media') {
            const mediaProject = projectFromMediaNode(node);
            newState.project = mediaProject;
            newState.history = [mediaProject];
            newState.historyIndex = 0;
            newState.renderResults = [];
        }

        return newState;
    }),

    setSelectedNodeIds: (ids) => set((state: AppState) => ({
        selectedNodeIds: ids,
        activeNodeId: ids.length === 1 ? ids[0] : (ids.includes(state.activeNodeId as string) ? state.activeNodeId : (ids.length > 0 ? ids[ids.length - 1] : null))
    }))
    };
}
