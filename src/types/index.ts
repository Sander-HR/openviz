import type { BackgroundHandling, VaryMode, ViewName } from './workbenchParity.types';

export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | '3:4' | 'square' | 'landscape' | 'portrait';
export type ToolType = 'select' | 'brush' | 'eraser' | 'circle' | 'rectangle' | 'line' | 'paintbucket' | 'transform';
export type WorkbenchToolType = 'select' | 'hand' | 'draw' | 'eraser' | 'arrow' | 'text' | 'note' | 'media';
export type LayerType = 'sketch' | 'image' | 'render';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';
export type ViewMode = 'STUDIO' | 'WORKBENCH';
export type { AdjustmentName, AdjustmentValues } from './adjustments';

export interface CanvasState {
    width: number;
    height: number;
    aspectRatio: AspectRatio;
    zoomLevel: number;
    panX: number;
    panY: number;
    backgroundColor: string;
}

export interface Stroke {
    tool: ToolType;
    points: number[];
    color: string;
    size: number;
    opacity: number;
    hardness: number;
    fill?: string;
}

export interface Layer {
    id: string;
    name: string;
    type: LayerType;
    visible: boolean;
    locked: boolean;
    opacity: number;
    blendMode: BlendMode;
    strokes: Stroke[];
    image?: string; // base64 or URL
    adjustments?: import('./adjustments').AdjustmentValues;
    adjustmentsEnabled?: boolean;
    // Transform properties
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    order: number;
    created: number;
    thumbnail?: string; // base64 thumbnail
    modified: number;
}

export interface Project {
    id: string;
    name: string;
    createdAt: number;
    lastModifiedAt: number;
    canvas: CanvasState;
    layers: Layer[];
    thumbnail?: string;
}

export type NodeType = 'image' | 'modify' | 'animate' | 'render' | 'video' | 'freehand' | 'arrow' | 'text' | 'note' | 'media' | 'variate' | 'new-view' | 'extract' | 'section';

export interface BaseNode {
    id: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    scale?: number;
    projectId?: string; // Database project ID for grouping/filtering
}

export interface ImageNode extends BaseNode {
    type: 'image';
    name: string;
    project: Project;
    status?: 'rendering' | 'done' | 'error';
    renderResults?: RenderGroup[];
}

export interface AnimateNode extends BaseNode {
    type: 'animate';
    data: {
        prompt: string;
        frames: {
            start?: string; // image id or url
            end?: string;
        };
        settings: {
            model: string;
            workflowId?: string;
            duration: string;
        };
    };
}

export interface VideoNode extends BaseNode {
    type: 'video';
    name: string;
    project: Project; // Reusing Project for consistency, thumbnail will be the video URL or poster
    status?: 'rendering' | 'done' | 'error';
    renderResults?: RenderGroup[];
}

export interface RenderNode extends BaseNode {
    type: 'render';
    data: RenderSettings;
}

export type ModifyNodeStatus = 'idle' | 'validating' | 'rendering' | 'done' | 'error';

export interface ModifyNode extends BaseNode {
    type: 'modify';
    data: {
        workflowId: string;
        prompt: string;
        negativePrompt?: string;
        aspectRatio: AspectRatio;
        preservation: number;
        structureStrength: number;
        references: Array<{
            assetId: string;
            role: 'primary' | 'material' | 'color' | 'style' | 'environment' | 'annotation' | 'mask';
            token?: string;
        }>;
        maskAssetId?: string;
        numImages: number;
        status: ModifyNodeStatus;
        error?: string;
    };
}

export interface FreehandNode extends BaseNode {
    type: 'freehand';
    data: {
        path: string;
        width: number;
        height: number;
        color: string;
        strokeWidth: number;
    };
}

export interface ArrowWorkbenchNode extends BaseNode {
    type: 'arrow';
    data: {
        start: { x: number; y: number };
        end: { x: number; y: number };
        control: { x: number; y: number };
        strokeColor: string;
        strokeWidth: number;
    };
}

/** Shared text formatting fields used by the text/note formatting toolbar. */
export interface TextFormattingData {
    fontSize?: number;
    fontWeight?: number;
    fontStyle?: 'normal' | 'italic';
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    fontFamily?: string;
    color?: string;
}

export interface TextWorkbenchNode extends BaseNode {
    type: 'text';
    data: {
        text: string;
        fontSize: number;
        color: string;
        fontWeight?: number;
        fontStyle?: 'normal' | 'italic';
        underline?: boolean;
        align?: 'left' | 'center' | 'right';
        fontFamily?: string;
    };
}

export interface NoteWorkbenchNode extends BaseNode {
    type: 'note';
    data: {
        text: string;
        colorVariant: 'yellow';
    } & TextFormattingData;
}

export interface MediaWorkbenchNode extends BaseNode {
    type: 'media';
    data: {
        src: string;
        alt: string;
        mimeType: string;
    };
}

// US5 node types (data-model.md "WorkbenchNode (extended)"). Shells land in
// US3 (T036); generation bodies arrive with the renderService ops in US5.
export interface VariateWorkbenchNode extends BaseNode {
    type: 'variate';
    data: {
        prompt: string;
        count: 2 | 4 | 8;
        varyMode?: VaryMode;
    };
}

export interface NewViewWorkbenchNode extends BaseNode {
    type: 'new-view';
    data: {
        prompt: string;
        /** null = "Select a view" placeholder; Generate disabled until set (FR-007). */
        view: ViewName | null;
    };
}

export interface ExtractWorkbenchNode extends BaseNode {
    type: 'extract';
    data: {
        prompt: string;
        extractPrompt?: string;
        backgroundHandling: BackgroundHandling;
    };
}

// US3 (T036): lightweight grouping container for the add-node menu's Section
// entry. Membership/wrapping behavior ("Wrap in section") is deferred; v1 only
// needs a creatable, selectable placeholder card.
export interface SectionWorkbenchNode extends BaseNode {
    type: 'section';
    data: {
        label: string;
    };
}

export type WorkbenchNode =
    | ImageNode
    | ModifyNode
    | AnimateNode
    | RenderNode
    | VideoNode
    | FreehandNode
    | ArrowWorkbenchNode
    | TextWorkbenchNode
    | NoteWorkbenchNode
    | MediaWorkbenchNode
    | VariateWorkbenchNode
    | NewViewWorkbenchNode
    | ExtractWorkbenchNode
    | SectionWorkbenchNode;

export interface Connection {
    id: string;
    from: string; // Node ID
    to: string;   // Node ID
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

export interface ToolSettings {
    activeTool: ToolType;
    brushSize: number;
    brushColor: string;
    brushOpacity: number;
    brushStabilizer: number;
    brushHardness: number;
    eraserSize: number;
    shapeFill: string;
    shapeStroke: string;
    strokeWidth: number;
}

export interface RenderSettings {
    prompt: string;
    stylePreset: string;
    workflowId?: string;
    drawingInfluence: number;
    numImages: number;
    referenceImage?: string;
}
export interface RenderGroup {
    id: string;
    prompt: string;
    style: string;
    settings: RenderSettings;
    images: string[];
    timestamp: number;
    width: number;
    height: number;
    sourceNodeId?: string;
}

export interface SceneData {
    nodes: WorkbenchNode[];
    connections: Connection[];
}

export type ScenePatchRequest = {
    data: SceneData;
    expectedVersion: number;
};

export type ScenePatchResponse = {
    scene: SceneData;
    version: number;
};

export type SceneEventType =
    | 'scene.node.created'
    | 'scene.node.updated'
    | 'scene.node.deleted'
    | 'scene.connection.created'
    | 'scene.connection.deleted'
    | 'scene.selection.locked'
    | 'scene.selection.unlocked'
    | 'scene.presence.updated';

export interface SceneEvent<TPayload = unknown> {
    type: SceneEventType;
    projectId: string;
    timestamp: number;
    payload: TPayload;
}

export interface NodeLockState {
    nodeId: string;
    userId: string;
    userName?: string;
    /**
     * Optional TTL for time-based locks. Awareness-derived soft locks are
     * ephemeral (they live exactly as long as the peer's awareness state) and
     * leave this unset.
     */
    expiresAt?: number;
}

export interface PresenceState {
    userId: string;
    userName?: string;
    selectedNodeIds: string[];
    cursor?: {
        x: number;
        y: number;
    };
    updatedAt: number;
}

export type {
    ProductWorkflowCategory,
    ProductModelFamily,
    ModelTier,
    Precision,
    ProductWorkflowDefinition,
    ProductWorkflowRequest,
    ProductReferenceInput,
    ProductReference,
    ProductReferenceRole,
    ProductVariantSet,
    ProductVariantVariable,
    ProductVariantSetStatus,
    WorkflowDependency,
    WorkflowInputDefinition,
    WorkflowValidationIssue,
    WorkflowValidationResult,
} from './productWorkflow.types';
export type {
    ExecutionTarget,
    ExecutionTargetKind,
    ExecutionTargetProtocol,
    ComputePreference,
    ComputeSettings,
    ExecutionTargetStatus,
    TargetCapabilities,
    TargetHealth,
    PreflightResult,
    ExecutionTargetAdapter,
    ComfyDeviceCapability,
} from './executionTarget.types';
export type {
    GenerationJob,
    GenerationJobError,
    GenerationJobOutput,
    GenerationJobStatus,
    ModelTierDecision,
} from './generationJob.types';
export type {
    CanvasTheme,
    AbsorbedAttributeType,
    AbsorbedAttribute,
    ExportFormat,
    ExportScaling,
    ExportOptions,
    ViewName,
    VaryMode,
    BackgroundHandling,
} from './workbenchParity.types';
export { VIEW_NAMES } from './workbenchParity.types';
