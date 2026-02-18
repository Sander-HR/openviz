export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | '3:4' | 'square' | 'landscape' | 'portrait';
export type ToolType = 'select' | 'brush' | 'eraser' | 'circle' | 'rectangle' | 'line' | 'paintbucket' | 'transform';
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

export type NodeType = 'image' | 'animate' | 'render' | 'video';

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

export type WorkbenchNode = ImageNode | AnimateNode | RenderNode | VideoNode;

export interface Connection {
    id: string;
    from: string; // Node ID
    to: string;   // Node ID
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

