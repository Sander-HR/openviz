export type AspectRatio = 'square' | 'landscape' | 'portrait';
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

export interface WorkbenchNode {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    project: Project;
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
}

