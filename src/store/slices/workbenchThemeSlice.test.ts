import { beforeEach, describe, expect, it } from 'vitest';

import { useWorkbenchThemeStore } from './workbenchThemeSlice';

// T013: FR-015 canvas theme preference — default, update, persistence, rehydration.

const STORAGE_KEY = 'openviz.workbench.canvasTheme';

beforeEach(() => {
    localStorage.clear();
});

describe('workbenchThemeStore', () => {
    it('defaults to the light canvas theme', () => {
        expect(useWorkbenchThemeStore.getState().canvasTheme).toBe('light');
    });

    it('setCanvasTheme updates state immediately (no reload path)', () => {
        useWorkbenchThemeStore.getState().setCanvasTheme('dark');
        expect(useWorkbenchThemeStore.getState().canvasTheme).toBe('dark');
        useWorkbenchThemeStore.getState().setCanvasTheme('light');
        expect(useWorkbenchThemeStore.getState().canvasTheme).toBe('light');
    });

    it('persists the preference to a namespaced localStorage key', () => {
        useWorkbenchThemeStore.getState().setCanvasTheme('dark');
        const raw = localStorage.getItem(STORAGE_KEY);
        expect(raw).not.toBeNull();
        expect(raw).toContain('"canvasTheme":"dark"');
    });

    it('rehydrates a stored preference at store creation / rehydrate()', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { canvasTheme: 'dark' }, version: 0 }));
        await useWorkbenchThemeStore.persist.rehydrate();
        expect(useWorkbenchThemeStore.getState().canvasTheme).toBe('dark');
    });

    it('falls back to light when the stored value is invalid', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { canvasTheme: 'neon' }, version: 0 }));
        await useWorkbenchThemeStore.persist.rehydrate();
        expect(useWorkbenchThemeStore.getState().canvasTheme).toBe('light');
    });

    it('keeps light when nothing is stored', async () => {
        await useWorkbenchThemeStore.persist.rehydrate();
        expect(useWorkbenchThemeStore.getState().canvasTheme).toBe('light');
    });
});
