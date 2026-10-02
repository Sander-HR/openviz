import type { StateCreator } from 'zustand';
import type { AppState } from '../storeTypes';
import { createWorkbenchSnapshot } from './workbenchSlice.utils';
import type { WorkbenchSlice } from './workbenchSlice.types';
import { createWorkbenchNodeActions } from './workbenchNodeActions';
import { createWorkbenchClipboardActions } from './workbenchClipboardActions';
import { createWorkbenchSceneActions } from './workbenchSceneActions';
import { createWorkbenchCreationActions } from './workbenchCreationActions';
import { createWorkbenchRenderActions } from './workbenchRenderActions';
import { createWorkbenchStateActions } from './workbenchStateActions';
import { createWorkbenchToolActions } from './workbenchToolActions';

export type { WorkbenchSlice } from './workbenchSlice.types';

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
    ...createWorkbenchNodeActions(set, get),
    ...createWorkbenchClipboardActions(set, get),
    ...createWorkbenchSceneActions(set, get),
    ...createWorkbenchCreationActions(set, get),
    ...createWorkbenchRenderActions(set, get),
    ...createWorkbenchStateActions(set, get),
    ...createWorkbenchToolActions(set, get),
});
