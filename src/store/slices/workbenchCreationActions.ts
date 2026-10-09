import type { AppState } from '../storeTypes';
import type { AspectRatio, ImageNode, Project } from '../../types';
import { INITIAL_PROJECT } from '../initialState';
import { findNonOverlappingPosition } from '../../services/nodePositioning';
import type { SceneNodeJson } from '@/types/collab.types';
import type { WorkbenchGet, WorkbenchSet, WorkbenchSlice } from './workbenchSlice.types';

export function createWorkbenchCreationActions(set: WorkbenchSet, get: WorkbenchGet): Pick<WorkbenchSlice, 'createNewSketch' | 'createSketchWithFormat'> {
    return {
    createNewSketch: () => {
        const id = Math.random().toString(36).substr(2, 9);
        const currentState = get() as AppState;
        const newProject: Project = {
            ...INITIAL_PROJECT,
            id,
            name: `Untitled ${currentState.workbenchNodes.length + 1}`,
            createdAt: Date.now(),
            lastModifiedAt: Date.now()
        };

        // Standardize thumbnail scaling: Fit canvas into 256px max dimension
        const canvasWidth = newProject.canvas.width;
        const canvasHeight = newProject.canvas.height;
        const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);
        const nodeWidth = canvasWidth * thumbnailScale;
        const nodeHeight = canvasHeight * thumbnailScale;

        // Use non-overlapping position
        const { x, y } = findNonOverlappingPosition({
            startX: 100,
            startY: 100,
            nodeWidth,
            nodeHeight,
            existingNodes: currentState.workbenchNodes,
            columns: 4,
            gap: 50,
            margin: 50
        });

        const newNode: ImageNode = {
            id,
            type: 'image',
            name: newProject.name,
            x,
            y,
            width: nodeWidth,
            height: nodeHeight,
            scale: thumbnailScale,
            project: newProject,
            projectId: currentState.currentProjectId || undefined
        };

        set((state: AppState) => ({
            workbenchNodes: [...state.workbenchNodes, newNode],
            project: newProject,
            activeNodeId: id,
            viewMode: 'STUDIO',
            history: [newProject],
            historyIndex: 0,
            renderResults: []
        }));
    },

    createSketchWithFormat: (width, height) => {
        const id = Math.random().toString(36).substr(2, 9);
        const ratio = width === height ? 'square' : width > height ? 'landscape' : 'portrait';
        const newProject: Project = {
            ...INITIAL_PROJECT,
            id,
            name: `Sketch ${width}x${height}`,
            canvas: { ...INITIAL_PROJECT.canvas, width, height, aspectRatio: ratio as AspectRatio },
            createdAt: Date.now(),
            lastModifiedAt: Date.now(),
        };
        const thumbnailScale = 256 / Math.max(width, height);
        const nodeWidth = width * thumbnailScale;
        const nodeHeight = height * thumbnailScale;
        const currentState = get();
        const { x, y } = findNonOverlappingPosition({
            startX: 100,
            startY: 100,
            nodeWidth,
            nodeHeight,
            existingNodes: currentState.workbenchNodes,
            columns: 4,
            gap: 50,
            margin: 50,
        });
        const newNode: ImageNode = {
            id,
            type: 'image',
            name: newProject.name,
            x,
            y,
            width: nodeWidth,
            height: nodeHeight,
            scale: thumbnailScale,
            project: newProject,
            projectId: currentState.currentProjectId || undefined,
        };

        if (currentState.collabSessionActive && currentState.collabDocumentCommands) {
            currentState.collabDocumentCommands.createNode(newNode as unknown as SceneNodeJson);
            set({ project: newProject, activeNodeId: id, viewMode: 'STUDIO', history: [newProject], historyIndex: 0, renderResults: [] });
            return;
        }
        set((state: AppState) => ({
            workbenchNodes: [...state.workbenchNodes, newNode],
            project: newProject,
            activeNodeId: id,
            viewMode: 'STUDIO',
            history: [newProject],
            historyIndex: 0,
            renderResults: [],
        }));
    }
    };
}
