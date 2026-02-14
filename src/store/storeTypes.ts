import { Project, ToolSettings, RenderSettings, RenderGroup, ViewMode, WorkbenchNode, Connection, ToolType, AspectRatio, Layer } from '../types';

export interface AppState {
    project: Project;
    toolSettings: ToolSettings;
    renderSettings: RenderSettings;
    renderResults: RenderGroup[];
    previewingRender: string | null;
    isPreviewVisible: boolean;
    isRendering: boolean;
    resultsPanelOpen: boolean;
    activeLayerId: string | null;

    // Workbench State
    viewMode: ViewMode;
    workbenchNodes: WorkbenchNode[];
    connections: Connection[];
    activeNodeId: string | null;
    selectedNodeIds: string[];
    clipboard: WorkbenchNode[] | null;
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
    setActiveLayer: (id: string | null) => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    reorderLayers: (startIndex: number, endIndex: number) => void;
    duplicateLayer: (id: string) => void;
    copyLayer: (id: string) => void;
    pasteLayer: () => void;

    // Render Results Actions
    addRenderResultGroup: (settings: RenderSettings, images: string[], width: number, height: number, sourceNodeId?: string) => void;
    loadRenderSettings: (settings: RenderSettings) => void;
    clearRenderResults: () => void;
    setRenderResults: (results: RenderGroup[]) => void;
    setPreviewingRender: (image: string | null) => void;
    setIsPreviewVisible: (visible: boolean) => void;
    setRendering: (loading: boolean) => void;
    setResultsPanelOpen: (open: boolean) => void;
    addGroupToWorkbench: (group: RenderGroup) => void;
    addImageToWorkbench: (image: string) => void;
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
    setWorkbenchNodes: (nodes: WorkbenchNode[]) => void;
    setConnections: (connections: Connection[]) => void;
}
