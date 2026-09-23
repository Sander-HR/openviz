import { StateCreator } from 'zustand';
import { AppState, WorkbenchHistorySnapshot } from '../storeTypes';
import {
    ViewMode,
    WorkbenchNode,
    ImageNode,
    VideoNode,
    Project,
    AspectRatio,
    RenderGroup,
    Connection,
    WorkbenchToolType,
    ArrowWorkbenchNode,
    MediaWorkbenchNode,
    NoteWorkbenchNode,
    TextWorkbenchNode,
} from '../../types';

/** Nodes created by one-shot tools (arrow/text/note/media) — FR-007. */
type OneShotNode = ImageNode | TextWorkbenchNode | NoteWorkbenchNode | ArrowWorkbenchNode | MediaWorkbenchNode;
import { INITIAL_PROJECT } from '../initialState';
import { findNonOverlappingPosition } from '../../services/nodePositioning';
import { addConnectionWithPolicy, normalizeConnections } from '../../services/workbench/connectionPolicy';
import {
    areWorkbenchSnapshotsEqual,
    createWorkbenchGestureTransaction,
    type WorkbenchGestureKind,
    type WorkbenchGestureTransaction,
} from '../workbenchGestureHistory';

function projectFromMediaNode(node: MediaWorkbenchNode): Project {
    const now = Date.now();
    const canvas = INITIAL_PROJECT.canvas;
    const layerId = `${node.id}-image`;

    return {
        ...INITIAL_PROJECT,
        id: node.id,
        name: node.data.alt || 'Uploaded image',
        createdAt: now,
        lastModifiedAt: now,
        layers: [
            {
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
            },
        ],
    };
}

export interface WorkbenchSlice {
    viewMode: ViewMode;
    currentProjectId: string | null;
    workbenchNodes: WorkbenchNode[];
    projectNodes: Record<string, WorkbenchNode[] | undefined>;
    connections: Connection[];
    activeNodeId: string | null;
    selectedNodeIds: string[];
    clipboard: WorkbenchNode[] | null;
    isExitingStudio: boolean;
    isDrawMode: boolean;
    activeWorkbenchTool: WorkbenchToolType;
    freehandColor: string;
    freehandStrokeWidth: number;
    workbenchHistory: WorkbenchHistorySnapshot[];
    workbenchHistoryIndex: number;
    activeWorkbenchGesture: WorkbenchGestureTransaction | null;
    setViewMode: (mode: ViewMode) => void;
    addWorkbenchNode: (node: WorkbenchNode) => void;
    createOneShotNode: (node: OneShotNode) => void;
    addConnection: (
        fromId: string,
        toId: string,
        sourceHandle?: string | null,
        targetHandle?: string | null
    ) => void;
    removeConnection: (id: string) => void;
    updateWorkbenchNode: (id: string, updates: Partial<WorkbenchNode>) => void;
    updateWorkbenchNodeTransient: (id: string, updates: Partial<WorkbenchNode>) => void;
    beginWorkbenchGesture: (kind: WorkbenchGestureKind, affectedNodeIds?: string[]) => void;
    commitWorkbenchGesture: () => void;
    cancelWorkbenchGesture: () => void;
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
    setConnections: (connections: Connection[]) => void;
    setCurrentProjectId: (id: string | null) => void;
    setDrawMode: (isDrawMode: boolean) => void;
    toggleDrawMode: () => void;
    setActiveWorkbenchTool: (tool: WorkbenchToolType) => void;
    setFreehandColor: (color: string) => void;
    setFreehandStrokeWidth: (strokeWidth: number) => void;
    undoLastFreehandNode: () => void;
    undoWorkbench: () => void;
    redoWorkbench: () => void;
}

const MAX_WORKBENCH_HISTORY = 100;

const createWorkbenchSnapshot = (
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

const commitWorkbenchHistory = (state: AppState, nextState: Partial<AppState>): Partial<AppState> => {
    const snapshot = createWorkbenchSnapshot(
        (nextState.workbenchNodes ?? state.workbenchNodes) as WorkbenchNode[],
        (nextState.connections ?? state.connections) as Connection[],
        (nextState.selectedNodeIds ?? state.selectedNodeIds) as string[],
        (nextState.activeNodeId ?? state.activeNodeId) as string | null
    );

    // While a collaboration session is active the shared document owns
    // history: remote projections must not pollute the local undo stack
    // (SC-005) and toolbar undo/redo routes through the Yjs UndoManager.
    if (state.collabSessionActive) {
        return nextState;
    }

    const currentSnapshot = state.workbenchHistory[state.workbenchHistoryIndex];
    if (currentSnapshot && areWorkbenchSnapshotsEqual(currentSnapshot, snapshot)) {
        return nextState;
    }

    const historyWindow = state.workbenchHistory.slice(0, state.workbenchHistoryIndex + 1);
    const nextHistory = [...historyWindow, snapshot];
    const trimmedHistory =
        nextHistory.length > MAX_WORKBENCH_HISTORY
            ? nextHistory.slice(nextHistory.length - MAX_WORKBENCH_HISTORY)
            : nextHistory;

    return {
        ...nextState,
        workbenchHistory: trimmedHistory,
        workbenchHistoryIndex: trimmedHistory.length - 1,
    };
};

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
    isDrawMode: false,
    activeWorkbenchTool: 'select',
    freehandColor: '#111827',
    freehandStrokeWidth: 4,
    workbenchHistory: [createWorkbenchSnapshot([], [], [], 'default')],
    workbenchHistoryIndex: 0,
    activeWorkbenchGesture: null,

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

    addWorkbenchNode: (node) => set((state: AppState) => {
        const newNodes = [...state.workbenchNodes, node];
        const newState: Partial<AppState> = { workbenchNodes: newNodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: newNodes
            };
        }
        return commitWorkbenchHistory(state, newState);
    }),

    // FR-007: one-shot tools create exactly one item, then auto-return to Select.
    // Atomic in a single state update so the canvas never observes an
    // intermediate "node exists but tool not yet switched" frame.
    createOneShotNode: (node) => set((state: AppState) => {
        const newNodes = [...state.workbenchNodes, node];
        const newState: Partial<AppState> = {
            workbenchNodes: newNodes,
            activeNodeId: node.id,
            selectedNodeIds: [node.id],
            activeWorkbenchTool: 'select',
        };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: newNodes
            };
        }
        return commitWorkbenchHistory(state, newState);
    }),

    addConnection: (fromId, toId, sourceHandle, targetHandle) => set((state: AppState) =>
        commitWorkbenchHistory(state, {
            connections: addConnectionWithPolicy(
            state.connections,
            state.workbenchNodes,
            fromId,
            toId,
            sourceHandle,
            targetHandle
            ),
        })),

    removeConnection: (id) => set((state: AppState) =>
        commitWorkbenchHistory(state, {
            connections: state.connections.filter((c) => c.id !== id)
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
        return commitWorkbenchHistory(state, newState);
    }),

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
                if (typeof source === 'string' && source.startsWith('blob:')) {
                    URL.revokeObjectURL(source);
                }
            });

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
    },

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
                to: idMap[c.to],
                sourceHandle: c.sourceHandle,
                targetHandle: c.targetHandle,
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

        return commitWorkbenchHistory(state, newState);
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
        return commitWorkbenchHistory(state, newState);
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
                to: idMap[c.to],
                sourceHandle: c.sourceHandle,
                targetHandle: c.targetHandle,
            }));

        return commitWorkbenchHistory(state, {
            workbenchNodes: [...state.workbenchNodes, ...newNodes],
            connections: [...state.connections, ...newConnections],
            selectedNodeIds: newNodes.map(n => n.id),
            activeNodeId: newNodes.length === 1 ? newNodes[0].id : state.activeNodeId
        });
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

        return commitWorkbenchHistory(state, {
            workbenchNodes: [...state.workbenchNodes, ...newNodes]
        });
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

        return commitWorkbenchHistory(state, {
            workbenchNodes: [...state.workbenchNodes, newNode]
        });
    }),
    setWorkbenchNodes: (nodes) => set((state: AppState) => {
        const newState: Partial<AppState> = { workbenchNodes: nodes };
        if (state.currentProjectId) {
            newState.projectNodes = {
                ...state.projectNodes,
                [state.currentProjectId]: nodes
            };
        }
        return commitWorkbenchHistory(state, newState);
    }),
    setProjectNodes: (projectId, nodes) => set((state: AppState) => ({
        projectNodes: {
            ...state.projectNodes,
            [projectId]: nodes
        }
    })),
    setConnections: (connections) => set((state: AppState) =>
        commitWorkbenchHistory(state, {
            connections: normalizeConnections(connections, state.workbenchNodes),
        })),
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
    }),
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
    undoLastFreehandNode: () => set((state: AppState) => {
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

        return commitWorkbenchHistory(state, newState);
    }),
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
    }),
});
