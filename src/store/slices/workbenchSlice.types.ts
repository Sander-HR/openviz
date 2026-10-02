import type { StateCreator } from 'zustand';
import type { AppState, WorkbenchHistorySnapshot } from '../storeTypes';
import type {
    ViewMode, WorkbenchNode, ImageNode, RenderGroup,
    Connection, WorkbenchToolType, ArrowWorkbenchNode, MediaWorkbenchNode,
    NoteWorkbenchNode, TextWorkbenchNode,
} from '../../types';
import type { WorkbenchGestureKind, WorkbenchGestureTransaction } from '../workbenchGestureHistory';

/** Nodes created by one-shot tools (arrow/text/note/media) — FR-007. */
export type OneShotNode = ImageNode | TextWorkbenchNode | NoteWorkbenchNode | ArrowWorkbenchNode | MediaWorkbenchNode;

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
    /** Commits a group move in one Zustand notification and one collab flush. */
    commitWorkbenchNodePositions: (positions: Array<{ id: string; x: number; y: number }>) => void;
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
    projectCollaborativeGraph: (nodes: WorkbenchNode[], connections: Connection[]) => void;
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


export type WorkbenchSet = Parameters<StateCreator<AppState, [], [], WorkbenchSlice>>[0];
export type WorkbenchGet = Parameters<StateCreator<AppState, [], [], WorkbenchSlice>>[1];
