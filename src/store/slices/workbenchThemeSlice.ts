import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { CanvasTheme } from '@/types';

/**
 * FR-015 — canvas theme preference (per-user client-side setting).
 *
 * Deliberately a dedicated store persisted to localStorage (research R2):
 * the main `useStore` persists scene data to IndexedDB, and the theme must
 * never travel with scene data. Invalid stored values fall back to 'light'.
 */
export interface WorkbenchThemeState {
    canvasTheme: CanvasTheme;
    setCanvasTheme: (theme: CanvasTheme) => void;
}

const STORAGE_KEY = 'openviz.workbench.canvasTheme';

function sanitizeTheme(value: unknown): CanvasTheme {
    return value === 'dark' ? 'dark' : 'light';
}

export const useWorkbenchThemeStore = create<WorkbenchThemeState>()(
    persist(
        (set) => ({
            canvasTheme: 'light',
            setCanvasTheme: (theme) => set({ canvasTheme: theme }),
        }),
        {
            name: STORAGE_KEY,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ canvasTheme: state.canvasTheme }),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<WorkbenchThemeState> | undefined;
                return {
                    ...currentState,
                    canvasTheme: sanitizeTheme(persisted?.canvasTheme),
                };
            },
        },
    ),
);
