import type { AppState } from '../storeTypes';
import type { AspectRatio, ImageNode, Project, WorkbenchNode } from '../../types';
import { INITIAL_PROJECT } from '../initialState';
import { findNonOverlappingPosition } from '../../services/nodePositioning';
import type { SceneNodeJson } from '@/types/collab.types';
import { commitWorkbenchHistory } from './workbenchSlice.utils';
import type { WorkbenchGet, WorkbenchSet, WorkbenchSlice } from './workbenchSlice.types';

export function createWorkbenchRenderActions(set: WorkbenchSet, get: WorkbenchGet): Pick<WorkbenchSlice, 'addGroupToWorkbench' | 'addImageToWorkbench'> {
    return {
    addGroupToWorkbench: (group) => {
        const state = get();
        const nodes = [...state.workbenchNodes];
        const activeNode = nodes.find(n => n.id === state.activeNodeId) as ImageNode | undefined;

        // Position to the right of the active node, but aligned to a grid
        // Fallback to defaults if dimensions are missing
        const activeWidth = activeNode ? (activeNode.width ?? (activeNode.scale ?? 1) * activeNode.project.canvas.width) : 0;
        const startX = activeNode ? activeNode.x + activeWidth + 100 : 100;
        const startY = activeNode ? activeNode.y : 100;

        // Use dimensions from the render group (source node dimensions)
        const canvasWidth = group.width || activeNode?.project.canvas.width || INITIAL_PROJECT.canvas.width;
        const canvasHeight = group.height || activeNode?.project.canvas.height || INITIAL_PROJECT.canvas.height;

        // Standardize thumbnail scaling: Fit canvas into 256px max dimension
        const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);
        const nodeWidth = canvasWidth * thumbnailScale;
        const nodeHeight = canvasHeight * thumbnailScale;

        const promptTitle = group.prompt.length > 50 ? group.prompt.substring(0, 50) + '...' : group.prompt;

        const newNodes: WorkbenchNode[] = [];

        group.images.forEach((image) => {
            const id = Math.random().toString(36).substr(2, 9);

            // Find non-overlapping position using the positioning service
            const { x: currentX, y: currentY } = findNonOverlappingPosition({
                startX,
                startY,
                nodeWidth,
                nodeHeight,
                existingNodes: [...nodes, ...newNodes],
                columns: 4,
                gap: 50,
                margin: 50
            });

            const newProject: Project = {
                ...INITIAL_PROJECT,
                id,
                name: promptTitle,
                thumbnail: image,
                canvas: {
                    ...INITIAL_PROJECT.canvas,
                    width: canvasWidth,
                    height: canvasHeight,
                    aspectRatio: canvasWidth === canvasHeight ? 'square' : canvasWidth > canvasHeight ? 'landscape' : 'portrait'
                },
                layers: [
                    {
                        ...INITIAL_PROJECT.layers[0],
                        id: 'bg-layer',
                        order: 0,
                    },
                    {
                        id: 'render-layer',
                        name: 'Render',
                        type: 'render',
                        visible: true,
                        locked: false,
                        opacity: 100,
                        blendMode: 'normal',
                        strokes: [],
                        image,
                        order: 1,
                        created: Date.now(),
                        modified: Date.now(),
                    }
                ],
                createdAt: Date.now(),
                lastModifiedAt: Date.now()
            };

            const newNode: ImageNode = {
                id,
                type: 'image',
                name: promptTitle,
                x: currentX,
                y: currentY,
                width: nodeWidth,
                height: nodeHeight,
                scale: thumbnailScale,
                project: newProject,
                projectId: state.currentProjectId || undefined
            };

            newNodes.push(newNode);
        });

        if (state.collabSessionActive && state.collabDocumentCommands) {
            state.collabDocumentCommands.createGraph(newNodes as unknown as SceneNodeJson[], []);
            return;
        }
        set((current: AppState) => commitWorkbenchHistory(current, {
            workbenchNodes: [...current.workbenchNodes, ...newNodes],
        }));
    },

    addImageToWorkbench: (image) => {
        const state = get();
        const activeNode = state.workbenchNodes.find((node) => node.id === state.activeNodeId) as ImageNode | undefined;
        const canvasWidth = activeNode?.project.canvas.width || INITIAL_PROJECT.canvas.width;
        const canvasHeight = activeNode?.project.canvas.height || INITIAL_PROJECT.canvas.height;
        const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);
        const nodeWidth = canvasWidth * thumbnailScale;
        const nodeHeight = canvasHeight * thumbnailScale;
        const activeWidth = activeNode ? (activeNode.width ?? (activeNode.scale ?? 1) * activeNode.project.canvas.width) : 0;
        const { x, y } = findNonOverlappingPosition({
            startX: activeNode ? activeNode.x + activeWidth + 100 : 100,
            startY: activeNode?.y ?? 100,
            nodeWidth,
            nodeHeight,
            existingNodes: state.workbenchNodes,
            columns: 4,
            gap: 50,
            margin: 50,
        });
        const id = Math.random().toString(36).slice(2, 11);
        const ratio = canvasWidth / canvasHeight;
        const aspectRatio: AspectRatio = Math.abs(ratio - 1) <= 0.1 ? 'square' : ratio > 1 ? 'landscape' : 'portrait';
        const newProject: Project = {
            ...INITIAL_PROJECT,
            id,
            name: 'Image',
            thumbnail: image,
            canvas: { ...INITIAL_PROJECT.canvas, width: canvasWidth, height: canvasHeight, aspectRatio },
            layers: [
                { ...INITIAL_PROJECT.layers[0], id: 'bg-layer', order: 0 },
                {
                    id: 'render-layer', name: 'Render', type: 'render', visible: true, locked: false,
                    opacity: 100, blendMode: 'normal', strokes: [], image, order: 1,
                    created: Date.now(), modified: Date.now(),
                },
            ],
            createdAt: Date.now(),
            lastModifiedAt: Date.now(),
        };
        const newNode: ImageNode = {
            id,
            type: 'image',
            name: 'Image',
            x,
            y,
            width: nodeWidth,
            height: nodeHeight,
            scale: thumbnailScale,
            project: newProject,
            projectId: state.currentProjectId || undefined,
        };

        if (state.collabSessionActive && state.collabDocumentCommands) {
            state.collabDocumentCommands.createNode(newNode as unknown as SceneNodeJson);
            return;
        }
        set((current: AppState) => commitWorkbenchHistory(current, {
            workbenchNodes: [...current.workbenchNodes, newNode],
        }));
    }
    };
}
