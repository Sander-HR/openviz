import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

import { AppState } from './storeTypes';
import { createProjectSlice } from './slices/projectSlice';
import { createToolSlice } from './slices/toolSlice';
import { createRenderSlice } from './slices/renderSlice';
import { createLayerSlice } from './slices/layerSlice';
import { createWorkbenchSlice } from './slices/workbenchSlice';
import { createHistorySlice } from './slices/historySlice';
import { createWorkbenchCollaborationSlice } from './slices/workbenchCollaborationSlice';

// Custom storage object for IndexedDB with debouncing
let saveTimeout: any = null;
const storage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await idbGet(name)) || null;
    },
    setItem: (name: string, value: string): void => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            await idbSet(name, value);
            saveTimeout = null;
        }, 1000);
    },
    removeItem: async (name: string): Promise<void> => {
        await idbDel(name);
    },
};

export const useStore = create<AppState>()(
    persist(
        (...a) => ({
            ...createProjectSlice(...a),
            ...createToolSlice(...a),
            ...createRenderSlice(...a),
            ...createLayerSlice(...a),
            ...createWorkbenchSlice(...a),
            ...createWorkbenchCollaborationSlice(...a),
            ...createHistorySlice(...a),
        }),
        {
            name: 'openviz-storage-idb',
            storage: createJSONStorage(() => storage),
            // IndexedDB rehydration is async and can land AFTER a collaboration
            // session has already projected the live shared scene. In that case a
            // stale persisted snapshot must not clobber workbenchNodes/connections
            // (the bridge would flush it back and overwrite remote edits).
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<AppState>;
                if ((currentState as AppState).collabSessionActive) {
                    return {
                        ...currentState,
                        ...persisted,
                        workbenchNodes: currentState.workbenchNodes,
                        connections: currentState.connections,
                        projectNodes: currentState.projectNodes,
                    } as AppState;
                }
                return { ...currentState, ...persisted } as AppState;
            },
            partialize: (state) => ({
                project: state.project,
                activeLayerId: state.activeLayerId,
                toolSettings: state.toolSettings,
                renderSettings: state.renderSettings,
                viewMode: state.viewMode,
                currentProjectId: state.currentProjectId,
                workbenchNodes: state.workbenchNodes,
                projectNodes: state.projectNodes,
                connections: state.connections,
                activeNodeId: state.activeNodeId,
                clipboard: state.clipboard,
                currentSceneVersion: state.currentSceneVersion,
                activeWorkbenchTool: state.activeWorkbenchTool,
            }),
        }
    )
);
