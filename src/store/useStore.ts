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
import { createAIComputeSlice } from './slices/aiComputeSlice';
import { createRenderTaskSlice } from './slices/renderTaskSlice';
import { createProductDesignSlice } from './slices/productDesignSlice';

// Custom storage object for IndexedDB with debouncing
// IndexedDB only exists in the browser; SSR must be a no-op or zustand's
// persist middleware throws "ReferenceError: indexedDB is not defined".
const hasIndexedDB = typeof globalThis.indexedDB !== 'undefined';
let saveTimeout: any = null;
const storage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        if (!hasIndexedDB) return null;
        const raw = await idbGet(name);
        return raw || null;
    },
    setItem: (name: string, value: string): void => {
        if (!hasIndexedDB) return;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            await idbSet(name, value);
            saveTimeout = null;
        }, 1000);
    },
    removeItem: async (name: string): Promise<void> => {
        if (!hasIndexedDB) return;
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
            ...createAIComputeSlice(...a),
            ...createRenderTaskSlice(...a),
            ...createProductDesignSlice(...a),
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
                // persistedState is undefined on a fresh profile (empty storage);
                // throwing here aborts zustand hydration entirely (hasHydrated
                // stays false and onFinishHydration never fires).
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
            onRehydrateStorage: () => (_state, error) => {
                if (error) console.error('[PERSIST] rehydration failed:', error);
            },
            partialize: (state) => ({
                project: state.project,
                activeLayerId: state.activeLayerId,
                toolSettings: state.toolSettings,
                renderSettings: state.renderSettings,
                viewMode: state.viewMode,
                currentProjectId: state.currentProjectId,
                lastOpenedProjectId: state.lastOpenedProjectId,
                workbenchNodes: state.workbenchNodes,
                projectNodes: state.projectNodes,
                connections: state.connections,
                activeNodeId: state.activeNodeId,
                clipboard: state.clipboard,
                currentSceneVersion: state.currentSceneVersion,
                activeWorkbenchTool: state.activeWorkbenchTool,
                computeSettings: state.computeSettings,
                productJobs: state.productJobs,
                productReferences: state.productReferences,
                productVariantSets: state.productVariantSets,
                activeProductReferenceId: state.activeProductReferenceId,
            }),
        }
    )
);
