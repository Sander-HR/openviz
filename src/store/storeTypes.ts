import type { WorkbenchGestureKind, WorkbenchGestureTransaction } from './workbenchGestureHistory';
import {
    Project,
    ToolSettings,
    RenderSettings,
    RenderGroup,
    ViewMode,
    WorkbenchNode,
    ImageNode,
    Connection,
    ToolType,
    WorkbenchToolType,
    TextWorkbenchNode,
    NoteWorkbenchNode,
    ArrowWorkbenchNode,
    MediaWorkbenchNode,
    AspectRatio,
    Layer,
    NodeLockState,
    PresenceState,
    ProductReference,
    ProductVariantSet,
} from '../types';
import type { CollabPresencePeer, CollabRemoteAwarenessEntry, CollabRemoteCursorState } from '@/types/collab.types';
import type { ComputeSettings } from '@/types/executionTarget.types';
import type { GenerationJob } from '@/types/generationJob.types';
import type {
    RenderTaskOutputState,
    RenderTaskReference,
    RenderTaskUiStatus,
} from './slices/renderTaskSlice';
import type { ExtractionOutput } from '@/services/ai/extractionService';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import type { SceneDocCommands } from '@/services/collab/sceneDocCommands';

export interface WorkbenchHistorySnapshot {
    workbenchNodes: WorkbenchNode[];
    connections: Connection[];
    selectedNodeIds: string[];
    activeNodeId: string | null;
}

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
    computeSettings: ComputeSettings;
    renderReferences: RenderTaskReference[];
    renderTaskStatus: RenderTaskUiStatus;
    renderTaskQueuePosition: number | null;
    renderTaskError: string | null;
    renderTaskOutputs: RenderTaskOutputState[];
    renderTaskExtraction: ExtractionOutput | null;
    renderTaskId: string | null;
    renderRecordId: string | null;
    lastRenderRequest: RenderTaskRequest | null;
    productJobs: Record<string, GenerationJob>;
    productReferences: Record<string, ProductReference>;
    productVariantSets: Record<string, ProductVariantSet>;
    activeProductReferenceId: string | null;

    // Workbench State
    viewMode: ViewMode;
    currentProjectId: string | null;
    /** Last project whose nodes are in workbenchNodes — never cleared on unmount, so a re-open can paint from IndexedDB (stale-while-revalidate). */
    lastOpenedProjectId: string | null;
    workbenchNodes: WorkbenchNode[];
    projectNodes: Record<string, WorkbenchNode[] | undefined>;
    connections: Connection[];
    activeNodeId: string | null;
    selectedNodeIds: string[];
    clipboard: WorkbenchNode[] | null;
    isExitingStudio: boolean;
    currentSceneVersion: number;
    sceneHydrated: boolean;
    /** True while a real-time collaboration session owns this scene's writes. */
    collabSessionActive: boolean;
    /** Join attempt ended terminally without syncing — single-user fallback should fetch the full scene. */
    collabUnavailable: boolean;
    setCollabUnavailable: (unavailable: boolean) => void;
    collabDocumentCommands: SceneDocCommands | null;
    nodeLocks: Record<string, NodeLockState>;
    presenceByUser: Record<string, CollabPresencePeer>;
    /** Remote cursor markers keyed by awareness client id. */
    remoteCursors: Record<string, CollabRemoteCursorState>;
    /** Projects a full awareness snapshot into presence/cursors/remote locks. */
    applyRemoteAwareness: (entries: CollabRemoteAwarenessEntry[], localClientId: number) => void;
    isDrawMode: boolean;
    activeWorkbenchTool: WorkbenchToolType;
    freehandColor: string;
    freehandStrokeWidth: number;
    workbenchHistory: WorkbenchHistorySnapshot[];
    workbenchHistoryIndex: number;
    activeWorkbenchGesture: WorkbenchGestureTransaction | null;

    history: Project[];
    historyIndex: number;

    // Actions
    setName: (name: string) => void;
    setCanvasSize: (width: number, height: number, ratio: AspectRatio) => void;
    setBackgroundColor: (color: string) => void;
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
    addImageLayer: (image: string, name?: string) => void;

    // Render Results Actions
    addRenderResultGroup: (settings: RenderSettings, images: string[], width: number, height: number, sourceNodeId?: string) => void;
    loadRenderSettings: (settings: RenderSettings) => void;
    clearRenderResults: () => void;
    setRenderResults: (results: RenderGroup[]) => void;
    setPreviewingRender: (image: string | null) => void;
    setIsPreviewVisible: (visible: boolean) => void;
    setRendering: (loading: boolean) => void;
    setResultsPanelOpen: (open: boolean) => void;
    setComputePreference: (preference: import('@/types/executionTarget.types').ComputePreference) => void;
    setLocalComfyEndpoint: (endpoint: string) => void;
    setHostedComfyEndpoint: (endpoint: string) => void;
    setExecutionTargetKind: (kind: import('@/types/executionTarget.types').ExecutionTargetKind) => void;
    setExecutionTargetProtocol: (protocol: import('@/types/executionTarget.types').ExecutionTargetProtocol) => void;
    setImageApiEndpoint: (endpoint: string) => void;
    setImageApiKey: (key: string) => void;
    setImageApiKeyless: (keyless: boolean) => void;
    setImageApiModels: (models: string[]) => void;
    setImageApiModel: (model: string) => void;
    setImageApiSize: (size: string) => void;
    setEndpointConcurrency: (concurrency: number) => void;
    setBenchmarkGateEnabled: (enabled: boolean) => void;
    applyComputeSettings: (settings: Partial<ComputeSettings>) => void;
    addRenderReference: (name: string, dataUrl: string) => void;
    prependRenderReference: (name: string, dataUrl: string) => void;
    removeRenderReference: (id: string) => void;
    setLastRenderRequest: (request: RenderTaskRequest | null) => void;
    setRenderTaskActive: (taskId: string, recordId: string) => void;
    setRenderTaskProgress: (patch: {
        status?: RenderTaskUiStatus;
        queuePosition?: number | null;
        error?: string | null;
        outputs?: RenderTaskOutputState[];
        extraction?: ExtractionOutput | null;
    }) => void;
    resetRenderTask: () => void;
    upsertProductJob: (job: GenerationJob) => void;
    updateProductJob: (jobId: string, updates: Partial<GenerationJob>) => void;
    removeProductJob: (jobId: string) => void;
    upsertProductReference: (reference: ProductReference) => void;
    setActiveProductReference: (referenceId: string | null) => void;
    upsertProductVariantSet: (variantSet: ProductVariantSet) => void;
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
    createOneShotNode: (
        node: ImageNode | TextWorkbenchNode | NoteWorkbenchNode | ArrowWorkbenchNode | MediaWorkbenchNode
    ) => void;
    addConnection: (
        fromId: string,
        toId: string,
        sourceHandle?: string | null,
        targetHandle?: string | null
    ) => void;
    removeConnection: (id: string) => void;
    updateWorkbenchNode: (id: string, updates: Partial<WorkbenchNode>) => void;
    updateWorkbenchNodeTransient: (id: string, updates: Partial<WorkbenchNode>) => void;
    commitWorkbenchNodePositions: (positions: Array<{ id: string; x: number; y: number }>) => void;
    beginWorkbenchGesture: (kind: WorkbenchGestureKind, affectedNodeIds?: string[]) => void;
    commitWorkbenchGesture: () => void;
    cancelWorkbenchGesture: () => void;
    removeWorkbenchNode: (id?: string) => void;
    duplicateWorkbenchNode: (id?: string) => void;
    reorderWorkbenchNode: (id: string, direction: 'front' | 'back') => void;
    copyToClipboard: (id?: string) => void;
    pasteFromClipboard: (pos: { x: number, y: number }) => void;
    saveCurrentToWorkbench: (thumbnailRef: string | null) => void;
    openNodeInStudio: (id: string) => void;
    setActiveNodeId: (id: string | null) => void;
    setSelectedNodeIds: (ids: string[]) => void;
    createNewSketch: () => void;
    createSketchWithFormat: (width: number, height: number) => void;
    setExitingStudio: (exiting: boolean) => void;
    setWorkbenchNodes: (nodes: WorkbenchNode[]) => void;
    projectCollaborativeGraph: (nodes: WorkbenchNode[], connections: Connection[]) => void;
    setProjectNodes: (projectId: string, nodes: WorkbenchNode[]) => void;
    setConnections: (connections: Connection[]) => void;
    setCurrentProjectId: (id: string | null) => void;
    setCurrentSceneVersion: (version: number) => void;
    setSceneHydrated: (hydrated: boolean) => void;
    setCollabSessionActive: (active: boolean) => void;
    setCollabDocumentCommands: (commands: SceneDocCommands | null) => void;
    setNodeLockState: (lock: NodeLockState) => void;
    clearNodeLockState: (nodeId: string) => void;
    upsertPresenceState: (presence: PresenceState) => void;
    clearPresenceState: (userId: string) => void;
    clearCollaborationState: () => void;
    setDrawMode: (isDrawMode: boolean) => void;
    toggleDrawMode: () => void;
    setActiveWorkbenchTool: (tool: WorkbenchToolType) => void;
    setFreehandColor: (color: string) => void;
    setFreehandStrokeWidth: (strokeWidth: number) => void;
    undoLastFreehandNode: () => void;
    undoWorkbench: () => void;
    redoWorkbench: () => void;
}
