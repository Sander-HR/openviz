export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | '3:4' | 'square' | 'landscape' | 'portrait';
export type ToolType = 'select' | 'brush' | 'eraser' | 'circle' | 'rectangle' | 'line' | 'paintbucket' | 'transform';
export type WorkbenchToolType = 'select' | 'draw' | 'eraser' | 'arrow' | 'text' | 'note' | 'media';
export type LayerType = 'sketch' | 'image' | 'render';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';
export type ViewMode = 'STUDIO' | 'WORKBENCH';

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

export type NodeType = 'image' | 'animate' | 'render' | 'video' | 'freehand' | 'arrow' | 'text' | 'note' | 'media';

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

export interface TextWorkbenchNode extends BaseNode {
    type: 'text';
    data: {
        text: string;
        fontSize: number;
        color: string;
    };
}

export interface NoteWorkbenchNode extends BaseNode {
    type: 'note';
    data: {
        text: string;
        colorVariant: 'yellow';
    };
}

export interface MediaWorkbenchNode extends BaseNode {
    type: 'media';
    data: {
        src: string;
        alt: string;
        mimeType: string;
    };
}

export type WorkbenchNode =
    | ImageNode
    | AnimateNode
    | RenderNode
    | VideoNode
    | FreehandNode
    | ArrowWorkbenchNode
    | TextWorkbenchNode
    | NoteWorkbenchNode
    | MediaWorkbenchNode;

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
