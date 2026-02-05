import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

import { Project, ToolSettings, Layer, ToolType, AspectRatio, RenderSettings, RenderGroup, ViewMode, WorkbenchNode, Connection, ImageNode } from '../types';

interface AppState {
    project: Project;
    toolSettings: ToolSettings;
    renderSettings: RenderSettings;
    renderResults: RenderGroup[];
    previewingRender: string | null;
    isRendering: boolean;
    resultsPanelOpen: boolean;
    activeLayerId: string | null;

    // Workbench State
    viewMode: ViewMode;
    workbenchNodes: WorkbenchNode[];
    connections: Connection[];
    activeNodeId: string | null;
    clipboard: WorkbenchNode | null;
    isExitingStudio: boolean;

    history: Project[];
    historyIndex: number;

    // Actions
    setName: (name: string) => void;
    setCanvasSize: (width: number, height: number, ratio: AspectRatio) => void;
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;

    // Tool Actions
    setActiveTool: (tool: ToolType) => void;
    setBrushSize: (size: number) => void;
    setBrushColor: (color: string) => void;
    setBrushOpacity: (opacity: number) => void;
    setBrushStabilizer: (stabilizer: number) => void;
    setBrushHardness: (hardness: number) => void;
    setEraserSize: (size: number) => void;

    // Render Actions
    setRenderPrompt: (prompt: string) => void;
    setRenderStyle: (style: string) => void;
    setRenderInfluence: (influence: number) => void;
    setRenderNumImages: (count: number) => void;
    setRenderReferenceImage: (image: string | undefined) => void;


    // Layer Actions
    addLayer: (type?: 'sketch' | 'image' | 'render') => void;
    removeLayer: (id: string) => void;
    setActiveLayer: (id: string) => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    reorderLayers: (startIndex: number, endIndex: number) => void;
    duplicateLayer: (id: string) => void;
    copyLayer: (id: string) => void;
    pasteLayer: () => void;

    clipboard: Layer | null;

    // Render Results Actions
    addRenderResultGroup: (settings: RenderSettings, images: string[]) => void;
    loadRenderSettings: (settings: RenderSettings) => void;
    clearRenderResults: () => void;
    setPreviewingRender: (image: string | null) => void;
    setRendering: (loading: boolean) => void;
    setResultsPanelOpen: (open: boolean) => void;
    addGroupToWorkbench: (group: RenderGroup) => void;
    addResultAsLayer: (image: string) => void;

    // History Actions
    undo: () => void;
    redo: () => void;
    pushHistory: () => void;

    // Workbench Actions
    setViewMode: (mode: ViewMode) => void;
    addWorkbenchNode: (node: WorkbenchNode) => void;
    addConnection: (fromId: string, toId: string) => void;
    removeConnection: (id: string) => void;
    updateWorkbenchNode: (id: string, updates: Partial<WorkbenchNode>) => void;
    removeWorkbenchNode: (id: string) => void;
    duplicateWorkbenchNode: (id: string) => void;
    reorderWorkbenchNode: (id: string, direction: 'front' | 'back') => void;
    copyToClipboard: (id: string) => void;
    pasteFromClipboard: (pos: { x: number, y: number }) => void;
    saveCurrentToWorkbench: (thumbnail: string) => void;
    openNodeInStudio: (id: string) => void;
    setActiveNodeId: (id: string | null) => void;
    createNewSketch: () => void;
    setExitingStudio: (exiting: boolean) => void;
}

const INITIAL_PROJECT: Project = {
    id: 'default',
    name: 'Untitled Project',
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
    canvas: {
        width: 1024,
        height: 768,
        aspectRatio: 'landscape',
        zoomLevel: 1,
        panX: 0,
        panY: 0,
        backgroundColor: '#ffffff',
    },
    layers: [
        {
            id: 'bg-layer',
            name: 'Background',
            type: 'sketch',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            order: 0,
            created: Date.now(),
            modified: Date.now(),
        },
        {
            id: 'layer-1',
            name: 'Layer 1',
            type: 'sketch',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            order: 1,
            created: Date.now(),
            modified: Date.now(),
        }
    ],
};

// Custom storage object for IndexedDB
const storage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        console.log('Loading state from IndexedDB:', name);
        return (await idbGet(name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        console.log('Saving state to IndexedDB:', name);
        await idbSet(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await idbDel(name);
    },
};

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            project: INITIAL_PROJECT,
            toolSettings: {
                activeTool: 'brush',
                brushSize: 5,
                brushColor: '#000000',
                brushOpacity: 100,
                brushStabilizer: 20,
                brushHardness: 80,
                eraserSize: 20,
                shapeFill: 'transparent',
                shapeStroke: '#000000',
                strokeWidth: 2,
            },
            renderSettings: {
                prompt: '',
                stylePreset: 'Photorealistic',
                drawingInfluence: 1.0,
                numImages: 1,
            },
            renderResults: [],
            previewingRender: null,
            isRendering: false,
            resultsPanelOpen: false,
            activeLayerId: 'layer-1',

            viewMode: 'STUDIO',
            workbenchNodes: [],
            connections: [],
            activeNodeId: 'default',
            clipboard: null,
            isExitingStudio: false,


            history: [INITIAL_PROJECT],
            historyIndex: 0,

            setName: (name) => set((state) => {
                const newProject = { ...state.project, name, lastModifiedAt: Date.now() };
                return {
                    project: newProject,
                    workbenchNodes: state.workbenchNodes.map(n =>
                        n.id === state.activeNodeId ? { ...n, name, project: newProject } : n
                    )
                };
            }),

            setCanvasSize: (width, height, ratio) => set((state) => ({
                project: {
                    ...state.project,
                    canvas: { ...state.project.canvas, width, height, aspectRatio: ratio },
                    lastModifiedAt: Date.now()
                }
            })),

            setZoom: (zoomLevel) => set((state) => ({
                project: {
                    ...state.project,
                    canvas: { ...state.project.canvas, zoomLevel }
                }
            })),

            setPan: (panX, panY) => set((state) => ({
                project: {
                    ...state.project,
                    canvas: { ...state.project.canvas, panX, panY }
                }
            })),

            setActiveTool: (activeTool) => set((state) => ({
                toolSettings: { ...state.toolSettings, activeTool }
            })),

            setBrushSize: (brushSize) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushSize }
            })),

            setBrushColor: (brushColor) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushColor }
            })),

            setBrushOpacity: (brushOpacity) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushOpacity }
            })),

            setBrushStabilizer: (brushStabilizer) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushStabilizer }
            })),

            setBrushHardness: (brushHardness) => set((state) => ({
                toolSettings: { ...state.toolSettings, brushHardness }
            })),

            setEraserSize: (eraserSize) => set((state) => ({
                toolSettings: { ...state.toolSettings, eraserSize }
            })),

            setRenderPrompt: (prompt) => set((state) => ({
                renderSettings: { ...state.renderSettings, prompt }
            })),

            setRenderStyle: (stylePreset) => set((state) => ({
                renderSettings: { ...state.renderSettings, stylePreset }
            })),

            setRenderInfluence: (drawingInfluence) => set((state) => ({
                renderSettings: { ...state.renderSettings, drawingInfluence }
            })),

            setRenderNumImages: (numImages) => set((state) => ({
                renderSettings: { ...state.renderSettings, numImages }
            })),

            setRenderReferenceImage: (referenceImage) => set((state) => ({
                renderSettings: { ...state.renderSettings, referenceImage }
            })),

            addRenderResultGroup: (settings, images) => set((state) => ({
                renderResults: [
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        prompt: settings.prompt,
                        style: settings.stylePreset,
                        settings: { ...settings },
                        images,
                        timestamp: Date.now()
                    },
                    ...state.renderResults
                ],
                resultsPanelOpen: true
            })),

            loadRenderSettings: (settings) => set((state) => ({
                renderSettings: settings ? { ...state.renderSettings, ...settings } : state.renderSettings
            })),

            clearRenderResults: () => set({ renderResults: [] }),

            setPreviewingRender: (previewingRender) => set({ previewingRender }),

            setRendering: (isRendering) => set({ isRendering }),

            setResultsPanelOpen: (resultsPanelOpen) => set({ resultsPanelOpen }),

            addResultAsLayer: (image) => set((state) => {
                const newLayerStyle = state.renderSettings.stylePreset;
                const newLayer: Layer = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: `Render: ${newLayerStyle}`,
                    type: 'render',
                    visible: true,
                    locked: false,
                    opacity: 100,
                    blendMode: 'normal',
                    strokes: [],
                    image,
                    thumbnail: image,
                    order: state.project.layers.length,
                    created: Date.now(),
                    modified: Date.now(),
                };
                return {
                    project: {
                        ...state.project,
                        layers: [...state.project.layers, newLayer],
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: newLayer.id,
                    previewingRender: null // Clear preview after adding
                };
            }),

            addGroupToWorkbench: (group) => set((state) => {
                const nodes = [...state.workbenchNodes];
                const activeNode = nodes.find(n => n.id === state.activeNodeId);

                let startX = activeNode ? activeNode.x + activeNode.width + 50 : 100;
                let startY = activeNode ? activeNode.y : 100;

                const nodeWidth = 250;
                const nodeHeight = 200;

                const promptTitle = group.prompt.length > 50 ? group.prompt.substring(0, 50) + '...' : group.prompt;

                const newNodes: WorkbenchNode[] = [];

                group.images.forEach((image) => {
                    const id = Math.random().toString(36).substr(2, 9);

                    // Find non-overlapping position
                    let currentX = startX;
                    let currentY = startY;
                    let foundPos = false;

                    while (!foundPos) {
                        const overlap = [...nodes, ...newNodes].some(n =>
                            currentX < n.x + n.width + 20 &&
                            currentX + nodeWidth + 20 > n.x &&
                            currentY < n.y + n.height + 20 &&
                            currentY + nodeHeight + 20 > n.y
                        );

                        if (overlap) {
                            currentY += nodeHeight + 50;
                            // If we've gone too far down, move right and reset Y
                            if (currentY > startY + (nodeHeight + 50) * 3) {
                                currentY = startY;
                                currentX += nodeWidth + 50;
                            }
                        } else {
                            foundPos = true;
                        }
                    }

                    const newProject: Project = {
                        ...INITIAL_PROJECT,
                        id,
                        name: promptTitle,
                        thumbnail: image,
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


            addLayer: (type = 'sketch') => set((state) => {
                const newLayer: Layer = {
                    id: Math.random().toString(36).substr(2, 9),
                    name: `Layer ${state.project.layers.length}`,
                    type,
                    visible: true,
                    locked: false,
                    opacity: 100,
                    blendMode: 'normal',
                    strokes: [],
                    order: state.project.layers.length,
                    created: Date.now(),
                    modified: Date.now(),
                };
                return {
                    project: {
                        ...state.project,
                        layers: [...state.project.layers, newLayer],
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: newLayer.id
                };
            }),

            removeLayer: (id) => set((state) => {
                if (state.project.layers.length <= 1) return state;
                const newLayers = state.project.layers.filter(l => l.id !== id);
                return {
                    project: {
                        ...state.project,
                        layers: newLayers,
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: state.activeLayerId === id ? newLayers[newLayers.length - 1].id : state.activeLayerId
                };
            }),

            setActiveLayer: (activeLayerId) => set({ activeLayerId }),

            updateLayer: (id, updates) => set((state) => ({
                project: {
                    ...state.project,
                    layers: state.project.layers.map(l => l.id === id ? { ...l, ...updates, modified: Date.now() } : l),
                    lastModifiedAt: Date.now()
                }
            })),

            reorderLayers: (startIndex, endIndex) => set((state) => {
                const newLayers = Array.from(state.project.layers);
                const [removed] = newLayers.splice(startIndex, 1);
                newLayers.splice(endIndex, 0, removed);
                return {
                    project: {
                        ...state.project,
                        layers: newLayers.map((l, i) => ({ ...l, order: i })),
                        lastModifiedAt: Date.now()
                    }
                };
            }),

            duplicateLayer: (id) => set((state) => {
                const layer = state.project.layers.find(l => l.id === id);
                if (!layer) return state;

                const newLayer: Layer = {
                    ...JSON.parse(JSON.stringify(layer)),
                    id: Math.random().toString(36).substr(2, 9),
                    name: `${layer.name} (Copy)`,
                    order: state.project.layers.length,
                    created: Date.now(),
                    modified: Date.now(),
                };

                return {
                    project: {
                        ...state.project,
                        layers: [...state.project.layers, newLayer],
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: newLayer.id
                };
            }),

            clipboard: null,

            copyLayer: (id) => set((state) => {
                const layer = state.project.layers.find(l => l.id === id);
                if (!layer) return state;
                return { clipboard: JSON.parse(JSON.stringify(layer)) };
            }),

            pasteLayer: () => set((state) => {
                if (!state.clipboard) return state;

                const newLayer: Layer = {
                    ...JSON.parse(JSON.stringify(state.clipboard)),
                    id: Math.random().toString(36).substr(2, 9),
                    name: `${state.clipboard.name} (Pasted)`,
                    order: state.project.layers.length,
                    created: Date.now(),
                    modified: Date.now(),
                };

                return {
                    project: {
                        ...state.project,
                        layers: [...state.project.layers, newLayer],
                        lastModifiedAt: Date.now()
                    },
                    activeLayerId: newLayer.id
                };
            }),

            undo: () => {
                const { historyIndex, history } = get();
                if (historyIndex > 0) {
                    set({
                        project: history[historyIndex - 1],
                        historyIndex: historyIndex - 1
                    });
                }
            },

            redo: () => {
                const { historyIndex, history } = get();
                if (historyIndex < history.length - 1) {
                    set({
                        project: history[historyIndex + 1],
                        historyIndex: historyIndex + 1
                    });
                }
            },

            pushHistory: () => {
                const { project, history, historyIndex } = get();
                const snapshot = JSON.parse(JSON.stringify(project));
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(snapshot);
                if (newHistory.length > 50) newHistory.shift();
                set({
                    history: newHistory,
                    historyIndex: newHistory.length - 1
                });
            },

            setViewMode: (viewMode) => set({ viewMode }),

            addWorkbenchNode: (node) => set((state) => ({
                workbenchNodes: [...state.workbenchNodes, node]
            })),

            addConnection: (fromId, toId) => set((state) => ({
                connections: [...state.connections, {
                    id: Math.random().toString(36).substr(2, 9),
                    from: fromId,
                    to: toId
                }]
            })),

            removeConnection: (id) => set((state) => ({
                connections: state.connections.filter(c => c.id !== id)
            })),

            updateWorkbenchNode: (id, updates) => set((state) => ({
                workbenchNodes: state.workbenchNodes.map(n => n.id === id ? { ...n, ...updates } as WorkbenchNode : n)
            })),

            removeWorkbenchNode: (id) => set((state) => ({
                workbenchNodes: state.workbenchNodes.filter(n => n.id !== id),
                connections: state.connections.filter(c => c.from !== id && c.to !== id)
            })),

            duplicateWorkbenchNode: (id) => set((state) => {
                const node = state.workbenchNodes.find(n => n.id === id);
                if (!node) return state;

                const newId = Math.random().toString(36).substr(2, 9);
                const newNode: WorkbenchNode = JSON.parse(JSON.stringify(node));
                newNode.id = newId;
                newNode.x += 40;
                newNode.y += 40;
                if (newNode.type === 'image') {
                    newNode.project.id = newId;
                }

                return {
                    workbenchNodes: [...state.workbenchNodes, newNode]
                };
            }),

            reorderWorkbenchNode: (id, direction) => set((state) => {
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

            copyToClipboard: (id) => set((state) => {
                const node = state.workbenchNodes.find(n => n.id === id);
                if (!node) return state;
                return { clipboard: JSON.parse(JSON.stringify(node)) };
            }),

            pasteFromClipboard: (pos) => set((state) => {
                if (!state.clipboard) return state;

                const newId = Math.random().toString(36).substr(2, 9);
                const newNode = JSON.parse(JSON.stringify(state.clipboard)) as WorkbenchNode;
                newNode.id = newId;
                newNode.x = pos.x;
                newNode.y = pos.y;
                if (newNode.type === 'image') {
                    newNode.project.id = newId;
                }

                return {
                    workbenchNodes: [...state.workbenchNodes, newNode]
                };
            }),

            saveCurrentToWorkbench: (thumbnail) => {
                const state = get();
                const currentProject = { ...state.project, thumbnail, lastModifiedAt: Date.now() };
                const existingNode = state.workbenchNodes.find(n => n.id === state.activeNodeId);

                if (existingNode) {
                    set({
                        project: currentProject,
                        workbenchNodes: state.workbenchNodes.map(n =>
                            n.id === state.activeNodeId ? { ...n, project: currentProject } : n
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
                        project: currentProject
                    };
                    set({
                        project: currentProject,
                        workbenchNodes: [...state.workbenchNodes, newNode],
                        activeNodeId: newNode.id
                    });
                }
            },

            // ... (rest of the actions)

            openNodeInStudio: (id) => {
                get().setActiveNodeId(id);
                set({ viewMode: 'STUDIO' });
            },

            setActiveNodeId: (id) => set((state) => {
                if (!id) return { activeNodeId: null };

                const node = state.workbenchNodes.find(n => n.id === id);
                if (!node || node.type !== 'image') return state;

                return {
                    project: node.project,
                    activeNodeId: id,
                    history: [node.project],
                    historyIndex: 0
                };
            }),

            createNewSketch: () => {
                const id = Math.random().toString(36).substr(2, 9);
                const newProject: Project = {
                    ...INITIAL_PROJECT,
                    id,
                    name: `Untitled ${get().workbenchNodes.length + 1}`,
                    createdAt: Date.now(),
                    lastModifiedAt: Date.now()
                };

                const newNode: ImageNode = {
                    id,
                    type: 'image',
                    name: newProject.name,
                    x: window.innerWidth / 2 - 125, // Centered-ish
                    y: window.innerHeight / 2 - 100,
                    width: 250,
                    height: 200,
                    project: newProject
                };

                set((state) => ({
                    workbenchNodes: [...state.workbenchNodes, newNode],
                    project: newProject,
                    activeNodeId: id,
                    viewMode: 'STUDIO',
                    history: [newProject],
                    historyIndex: 0
                }));
            },

            setExitingStudio: (isExitingStudio) => set({ isExitingStudio }),
        }),
        {
            name: 'openviz-storage-idb', // Change name to avoid conflicts with localStorage
            storage: createJSONStorage(() => storage),
            partialize: (state) => ({
                renderSettings: state.renderSettings,
                viewMode: state.viewMode,
                workbenchNodes: state.workbenchNodes,
                activeNodeId: state.activeNodeId,
                clipboard: state.clipboard
            }),
        }
    )
);
