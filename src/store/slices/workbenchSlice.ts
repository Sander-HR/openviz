import { StateCreator } from 'zustand';
import { AppState } from '../storeTypes';
import { ViewMode, WorkbenchNode, ImageNode, VideoNode, Project, AspectRatio, RenderGroup } from '../../types';
import { INITIAL_PROJECT } from '../initialState';
import { findNonOverlappingPosition } from '../../services/nodePositioning';

export interface WorkbenchSlice {
    viewMode: ViewMode;
    currentProjectId: string | null;
    workbenchNodes: WorkbenchNode[];
    projectNodes: Record<string, WorkbenchNode[] | undefined>;
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
    setWorkbenchNodes: (nodes: WorkbenchNode[]) => void;
    setProjectNodes: (projectId: string, nodes: WorkbenchNode[]) => void;
    setConnections: (connections: any[]) => void;
    setCurrentProjectId: (id: string | null) => void;
}

export const createWorkbenchSlice: StateCreator<AppState, [], [], WorkbenchSlice> = (set, get) => ({
    viewMode: 'STUDIO',
    currentProjectId: null,
    workbenchNodes: [],
    projectNodes: {},
    connections: [],
    activeNodeId: 'default',
    selectedNodeIds: [],
    clipboard: null,
    isExitingStudio: false,

    setViewMode: (viewMode) => set({ viewMode }),

    addWorkbenchNode: (node) => set((state: AppState) => {
        const newNodes = [...state.workbenchNodes, node];
        const newState: Partial<AppState> = { workbenchNodes: newNodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: newNodes
            };
        }
        return newState;
    }),

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
        return newState;
    }),

    removeWorkbenchNode: (id) => set((state: AppState) => {
        const idsToRemove = id ? [id] : state.selectedNodeIds;
        if (idsToRemove.length === 0) return state;

        const newNodes = state.workbenchNodes.filter(n => !idsToRemove.includes(n.id));
        const newState: Partial<AppState> = {
            workbenchNodes: newNodes,
            connections: state.connections.filter((c: any) => !idsToRemove.includes(c.from) && !idsToRemove.includes(c.to)),
            selectedNodeIds: state.selectedNodeIds.filter(sid => !idsToRemove.includes(sid)),
            activeNodeId: idsToRemove.includes(state.activeNodeId as string) ? null : state.activeNodeId
        };

        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: newNodes
            };
        }

        return newState;
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
            const newNode: WorkbenchNode = structuredClone(node);
            newNode.id = newId;
            newNode.x += 40;
            newNode.y += 40;
            if (newNode.type === 'image' || newNode.type === 'video') {
                newNode.project.id = newId;
            }
            // Preserve projectId for dashboard grouping
            newNode.projectId = node.projectId;
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

        const newState: Partial<AppState> = {
            workbenchNodes: [...state.workbenchNodes, ...newNodes],
            connections: [...state.connections, ...newConnections],
            selectedNodeIds: newNodes.map(n => n.id),
            activeNodeId: newNodes.length === 1 ? newNodes[0].id : state.activeNodeId
        };

        if (state.currentProjectId && newState.workbenchNodes) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: newState.workbenchNodes
            } as Record<string, WorkbenchNode[]>;
        }

        return newState;
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

        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes
            };
        }
        return newState;
    }),

    copyToClipboard: (id) => set((state: AppState) => {
        const idsToCopy = id ? [id] : state.selectedNodeIds;
        if (idsToCopy.length === 0) return state;

        const nodesToCopy = state.workbenchNodes.filter(n => idsToCopy.includes(n.id));
        return { clipboard: structuredClone(nodesToCopy) };
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
            const newNode: WorkbenchNode = structuredClone(node);
            newNode.id = newId;
            newNode.x = pos.x + (node.x - minX);
            newNode.y = pos.y + (node.y - minY);
            if (newNode.type === 'image' || newNode.type === 'video') {
                newNode.project.id = newId;
            }
            // Preserve projectId for dashboard grouping
            newNode.projectId = node.projectId;
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

        // Sync to backend using currentProjectId (the real project ID from database)
        // This should work for both the main project and nodes created from it
        if (state.currentProjectId) {
            fetch(`/api/projects/${state.currentProjectId}`, {
                method: 'PATCH',
                body: JSON.stringify({ thumbnailUrl: thumbnail }),
                headers: { 'Content-Type': 'application/json' }
            }).catch(err => console.error("Failed to sync thumbnail:", err));
        }

        // Get render results for the current active node
        const nodeRenderResults = state.renderResults.filter(r =>
            r.sourceNodeId === state.activeNodeId ||
            (!r.sourceNodeId && state.activeNodeId === 'default')
        );

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
            canvas: {
                ...INITIAL_PROJECT.canvas,
                width,
                height,
                aspectRatio: ratio as AspectRatio
            },
            createdAt: Date.now(),
            lastModifiedAt: Date.now()
        };

        // Standardize thumbnail scaling: Fit canvas into 256px max dimension
        const thumbnailScale = 256 / Math.max(width, height);
        const nodeWidth = width * thumbnailScale;
        const nodeHeight = height * thumbnailScale;

        const currentState = get() as AppState;

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

    setExitingStudio: (isExitingStudio) => set({ isExitingStudio }),

    addGroupToWorkbench: (group) => set((state: AppState) => {
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

        return {
            workbenchNodes: [...state.workbenchNodes, ...newNodes]
        };
    }),

    addImageToWorkbench: (image) => set((state: AppState) => {
        const activeNode = state.workbenchNodes.find(n => n.id === state.activeNodeId) as ImageNode | undefined;

        // Use dimensions from active node if it exists, otherwise use default
        const canvasWidth = activeNode?.project.canvas.width || INITIAL_PROJECT.canvas.width;
        const canvasHeight = activeNode?.project.canvas.height || INITIAL_PROJECT.canvas.height;

        // Standardize thumbnail scaling: Fit canvas into 256px max dimension
        const thumbnailScale = 256 / Math.max(canvasWidth, canvasHeight);
        const nodeWidth = canvasWidth * thumbnailScale;
        const nodeHeight = canvasHeight * thumbnailScale;

        // Position to the right of the active node, or default position
        const activeWidth = activeNode ? (activeNode.width ?? (activeNode.scale ?? 1) * activeNode.project.canvas.width) : 0;
        const startX = activeNode ? activeNode.x + activeWidth + 100 : 100;
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
            margin: 50
        });

        const id = Math.random().toString(36).substr(2, 9);

        // Calculate aspect ratio from dimensions
        const ratio = canvasWidth / canvasHeight;
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
                width: canvasWidth,
                height: canvasHeight,
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

        const currentState = get() as AppState;

        const newNode: ImageNode = {
            id,
            type: 'image',
            name: 'Image',
            x: currentX,
            y: currentY,
            width: nodeWidth,
            height: nodeHeight,
            scale: thumbnailScale,
            project: newProject,
            projectId: currentState.currentProjectId || undefined
        };

        return {
            workbenchNodes: [...state.workbenchNodes, newNode]
        };
    }),
    setWorkbenchNodes: (nodes) => set((state: AppState) => {
        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes
            };
        }
        return newState;
    }),
    setProjectNodes: (projectId, nodes) => set((state: AppState) => ({
        projectNodes: {
            ...state.projectNodes,
            [projectId]: nodes
        }
    })),
    setConnections: (connections) => set({ connections }),
    setCurrentProjectId: (id) => set((state: AppState) => {
        const newState: Partial<AppState> = { currentProjectId: id };
        if (id && state.projectNodes[id]) {
            newState.workbenchNodes = state.projectNodes[id];
        } else if (id) {
            newState.workbenchNodes = [];
        }
        return newState;
    }),
});
