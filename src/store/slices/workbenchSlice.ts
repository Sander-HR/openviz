import { StateCreator } from 'zustand';
import { AppState } from '../storeTypes';
import { ViewMode, WorkbenchNode, ImageNode, VideoNode, Project, AspectRatio, RenderGroup } from '../../types';
import { INITIAL_PROJECT } from '../initialState';
import { findNonOverlappingPosition } from '../../services/nodePositioning';

export interface WorkbenchSlice {
    viewMode: ViewMode;
    workbenchNodes: WorkbenchNode[];
    connections: any[];
    activeNodeId: string | null;
    selectedNodeIds: string[];
    clipboard: WorkbenchNode[] | null;
    isExitingStudio: boolean;
    setViewMode: (mode: ViewMode) => void;
    addWorkbenchNode: (node: WorkbenchNode) => void;
    addConnection: (fromId: string, toId: string) => void;
    removeConnection: (id: string) => void;
    updateWorkbenchNode: (id: string, updates: Partial<WorkbenchNode>) => void;
    removeWorkbenchNode: (id?: string) => void;
    duplicateWorkbenchNode: (id?: string) => void;
    reorderWorkbenchNode: (id: string, direction: 'front' | 'back') => void;
    copyToClipboard: (id?: string) => void;
    pasteFromClipboard: (pos: { x: number, y: number }) => void;
    saveCurrentToWorkbench: (thumbnail: string) => void;
    openNodeInStudio: (id: string) => void;
    setActiveNodeId: (id: string | null) => void;
    setSelectedNodeIds: (ids: string[]) => void;
    createNewSketch: () => void;
    createSketchWithFormat: (width: number, height: number) => void;
    setExitingStudio: (exiting: boolean) => void;
    addGroupToWorkbench: (group: RenderGroup) => void;
    addImageToWorkbench: (image: string) => void;
}

export const createWorkbenchSlice: StateCreator<AppState, [], [], WorkbenchSlice> = (set, get) => ({
    viewMode: 'STUDIO',
    workbenchNodes: [],
    connections: [],
    activeNodeId: 'default',
    selectedNodeIds: [],
    clipboard: null,
    isExitingStudio: false,

    setViewMode: (viewMode) => set({ viewMode }),

    addWorkbenchNode: (node) => set((state: AppState) => ({
        workbenchNodes: [...state.workbenchNodes, node]
    })),

    addConnection: (fromId, toId) => set((state: AppState) => ({
        connections: [...state.connections, {
            id: Math.random().toString(36).substr(2, 9),
            from: fromId,
            to: toId
        }]
    })),

    removeConnection: (id) => set((state: AppState) => ({
        connections: state.connections.filter((c: any) => c.id !== id)
    })),

    updateWorkbenchNode: (id, updates) => set((state: AppState) => {
        const nodes = state.workbenchNodes.map(n => {
            if (n.id !== id) return n;
            const updated = { ...n, ...updates } as WorkbenchNode;

            // if ((updated.type === 'image' || updated.type === 'video') && (updates.width || updates.height)) {
            //     const ratio = updated.width / updated.height;
            //     const baseDim = 1024;
            //     let newWidth, newHeight, newRatio;

            //     if (updated.width >= updated.height) {
            //         newWidth = baseDim;
            //         newHeight = Math.round(baseDim / ratio);
            //         newRatio = ratio === 1 ? 'square' : 'landscape';
            //     } else {
            //         newHeight = baseDim;
            //         newWidth = Math.round(baseDim * ratio);
            //         newRatio = 'portrait';
            //     }

            //     return {
            //         ...updated,
            //         project: {
            //             ...updated.project,
            //             canvas: {
            //                 ...updated.project.canvas,
            //                 width: newWidth,
            //                 height: newHeight,
            //                 aspectRatio: newRatio as AspectRatio
            //             }
            //         }
            //     } as WorkbenchNode;
            // }
            return updated;
        });
        return { workbenchNodes: nodes };
    }),

    removeWorkbenchNode: (id) => set((state: AppState) => {
        const idsToRemove = id ? [id] : state.selectedNodeIds;
        if (idsToRemove.length === 0) return state;

        return {
            workbenchNodes: state.workbenchNodes.filter(n => !idsToRemove.includes(n.id)),
            connections: state.connections.filter((c: any) => !idsToRemove.includes(c.from) && !idsToRemove.includes(c.to)),
            selectedNodeIds: state.selectedNodeIds.filter(sid => !idsToRemove.includes(sid)),
            activeNodeId: idsToRemove.includes(state.activeNodeId as string) ? null : state.activeNodeId
        };
    }),

    duplicateWorkbenchNode: (id) => set((state: AppState) => {
        const idsToDuplicate = id ? [id] : state.selectedNodeIds;
        if (idsToDuplicate.length === 0) return state;

        const nodesToDuplicate = state.workbenchNodes.filter(n => idsToDuplicate.includes(n.id));
        const newNodes: WorkbenchNode[] = [];
        const idMap: Record<string, string> = {};

        nodesToDuplicate.forEach(node => {
            const newId = Math.random().toString(36).substr(2, 9);
            idMap[node.id] = newId;
            const newNode: WorkbenchNode = JSON.parse(JSON.stringify(node));
            newNode.id = newId;
            newNode.x += 40;
            newNode.y += 40;
            if (newNode.type === 'image' || newNode.type === 'video') {
                newNode.project.id = newId;
            }
            newNodes.push(newNode);
        });

        // Also duplicate connections between the duplicated nodes
        const newConnections = state.connections
            .filter(c => idsToDuplicate.includes(c.from) && idsToDuplicate.includes(c.to))
            .map(c => ({
                id: Math.random().toString(36).substr(2, 9),
                from: idMap[c.from],
                to: idMap[c.to]
            }));

        return {
            workbenchNodes: [...state.workbenchNodes, ...newNodes],
            connections: [...state.connections, ...newConnections],
            selectedNodeIds: newNodes.map(n => n.id),
            activeNodeId: newNodes.length === 1 ? newNodes[0].id : state.activeNodeId
        };
    }),

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

        return { workbenchNodes: nodes };
    }),

    copyToClipboard: (id) => set((state: AppState) => {
        const idsToCopy = id ? [id] : state.selectedNodeIds;
        if (idsToCopy.length === 0) return state;

        const nodesToCopy = state.workbenchNodes.filter(n => idsToCopy.includes(n.id));
        return { clipboard: JSON.parse(JSON.stringify(nodesToCopy)) };
    }),

    pasteFromClipboard: (pos) => set((state: AppState) => {
        if (!state.clipboard || state.clipboard.length === 0) return state;

        // Calculate offset if multiple nodes
        const minX = Math.min(...state.clipboard.map(n => n.x));
        const minY = Math.min(...state.clipboard.map(n => n.y));

        const newNodes: WorkbenchNode[] = [];
        const idMap: Record<string, string> = {};

        state.clipboard.forEach(node => {
            const newId = Math.random().toString(36).substr(2, 9);
            idMap[node.id] = newId;
            const newNode: WorkbenchNode = JSON.parse(JSON.stringify(node));
            newNode.id = newId;
            newNode.x = pos.x + (node.x - minX);
            newNode.y = pos.y + (node.y - minY);
            if (newNode.type === 'image' || newNode.type === 'video') {
                newNode.project.id = newId;
            }
            newNodes.push(newNode);
        });

        // Also duplicate connections between the pasted nodes if they were copied together
        const clipboardIds = state.clipboard.map(n => n.id);
        const newConnections = state.connections
            .filter(c => clipboardIds.includes(c.from) && clipboardIds.includes(c.to))
            .map(c => ({
                id: Math.random().toString(36).substr(2, 9),
                from: idMap[c.from],
                to: idMap[c.to]
            }));

        return {
            workbenchNodes: [...state.workbenchNodes, ...newNodes],
            connections: [...state.connections, ...newConnections],
            selectedNodeIds: newNodes.map(n => n.id),
            activeNodeId: newNodes.length === 1 ? newNodes[0].id : state.activeNodeId
        };
    }),

    saveCurrentToWorkbench: (thumbnail) => {
        const state = get() as AppState;
        const currentProject = { ...state.project, thumbnail, lastModifiedAt: Date.now() };
        const existingNode = state.workbenchNodes.find(n => n.id === state.activeNodeId);

        // Get render results for the current active node
        const nodeRenderResults = state.renderResults.filter(r =>
            r.sourceNodeId === state.activeNodeId ||
            (!r.sourceNodeId && state.activeNodeId === 'default')
        );

        if (existingNode) {
            set({
                project: currentProject,
                workbenchNodes: state.workbenchNodes.map(n =>
                    n.id === state.activeNodeId ? { ...n, project: currentProject, renderResults: nodeRenderResults } : n
                )
            });
        } else {
            const newNode: ImageNode = {
                id: currentProject.id,
                type: 'image',
                name: currentProject.name,
                x: 100,
                y: 100,
                width: currentProject.canvas.width / 4,
                height: currentProject.canvas.height / 4,
                project: currentProject,
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
                viewMode: 'STUDIO'
            });
        } else {
            set({ activeNodeId: id, viewMode: 'STUDIO' });
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
        }

        return newState;
    }),

    setSelectedNodeIds: (ids) => set((state: AppState) => ({
        selectedNodeIds: ids,
        activeNodeId: ids.length === 1 ? ids[0] : (ids.includes(state.activeNodeId as string) ? state.activeNodeId : (ids.length > 0 ? ids[ids.length - 1] : null))
    })),

    createNewSketch: () => {
        const id = Math.random().toString(36).substr(2, 9);
        const state = get() as AppState;
        const newProject: Project = {
            ...INITIAL_PROJECT,
            id,
            name: `Untitled ${state.workbenchNodes.length + 1}`,
            createdAt: Date.now(),
            lastModifiedAt: Date.now()
        };

        const displayWidth = INITIAL_PROJECT.canvas.width / 4;
        const displayHeight = INITIAL_PROJECT.canvas.height / 4;

        const newNode: ImageNode = {
            id,
            type: 'image',
            name: newProject.name,
            x: window.innerWidth / 2 - displayWidth / 2,
            y: window.innerHeight / 2 - displayHeight / 2,
            width: displayWidth,
            height: displayHeight,
            project: newProject
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
            canvas: {
                ...INITIAL_PROJECT.canvas,
                width,
                height,
                aspectRatio: ratio as AspectRatio
            },
            createdAt: Date.now(),
            lastModifiedAt: Date.now()
        };

        const displayWidth = Math.min(300, width * 0.25);
        const displayHeight = displayWidth * (height / width);

        const newNode: ImageNode = {
            id,
            type: 'image',
            name: newProject.name,
            x: window.innerWidth / 2 - displayWidth / 2,
            y: window.innerHeight / 2 - displayHeight / 2,
            width: displayWidth,
            height: displayHeight,
            project: newProject
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

    setExitingStudio: (isExitingStudio) => set({ isExitingStudio }),

    addGroupToWorkbench: (group) => set((state: AppState) => {
        const nodes = [...state.workbenchNodes];
        const activeNode = nodes.find(n => n.id === state.activeNodeId) as ImageNode | undefined;

        let startX = activeNode ? activeNode.x + activeNode.width + 50 : 100;
        let startY = activeNode ? activeNode.y : 100;

        // Use dimensions from the render group (source node dimensions)
        const canvasWidth = group.width || INITIAL_PROJECT.canvas.width;
        const canvasHeight = group.height || INITIAL_PROJECT.canvas.height;

        // Calculate display size based on active node's display ratio if available
        let nodeWidth: number;
        let nodeHeight: number;

        if (activeNode) {
            // Use the active node's display size as reference
            const activeCanvasWidth = activeNode.project.canvas.width;
            const displayScale = activeNode.width / activeCanvasWidth;
            nodeWidth = canvasWidth * displayScale;
            nodeHeight = canvasHeight * displayScale;
        } else {
            // Fallback to default scale if no active node
            nodeWidth = canvasWidth / 4;
            nodeHeight = canvasHeight / 4;
        }

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
                margin: 20
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
                project: newProject
            };

            newNodes.push(newNode);
        });

        return {
            workbenchNodes: [...state.workbenchNodes, ...newNodes]
        };
    }),

    addImageToWorkbench: (image) => set((state: AppState) => {
        const activeNode = state.workbenchNodes.find(n => n.id === state.activeNodeId) as ImageNode | undefined;

        // Default dimensions (256x256 matches Studio's 1024/4)
        let nodeWidth = 256;
        let nodeHeight = 256;

        // Inherit dimensions from active node if it exists
        if (activeNode) {
            nodeWidth = activeNode.width;
            nodeHeight = activeNode.height;
        }

        // Position to the right of the active node, or default position
        const startX = activeNode ? activeNode.x + activeNode.width + 100 : 100;
        const startY = activeNode ? activeNode.y : 100;

        // Use the extracted positioning service
        const { x: currentX, y: currentY } = findNonOverlappingPosition({
            startX,
            startY,
            nodeWidth,
            nodeHeight,
            existingNodes: state.workbenchNodes,
            columns: 4,
            gap: 50,
            margin: 20
        });

        const id = Math.random().toString(36).substr(2, 9);

        // Calculate aspect ratio from dimensions
        const ratio = nodeWidth / nodeHeight;
        let aspectRatio: AspectRatio = 'square';
        if (Math.abs(ratio - 1) > 0.1) {
            aspectRatio = ratio > 1 ? 'landscape' : 'portrait';
        }

        const newProject: Project = {
            ...INITIAL_PROJECT,
            id,
            name: 'Image',
            thumbnail: image,
            canvas: {
                ...INITIAL_PROJECT.canvas,
                width: 1024,
                height: 1024,
                aspectRatio
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
            name: 'Image',
            x: currentX,
            y: currentY,
            width: nodeWidth,
            height: nodeHeight,
            project: newProject
        };

        return {
            workbenchNodes: [...state.workbenchNodes, newNode]
        };
    }),
});
