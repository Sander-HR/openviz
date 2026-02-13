import { StateCreator } from 'zustand';
import { AppState } from '../storeTypes';
import { RenderSettings, RenderGroup } from '../../types';

export interface RenderSlice {
    renderSettings: RenderSettings;
    renderResults: RenderGroup[];
    previewingRender: string | null;
    isPreviewVisible: boolean;
    isRendering: boolean;
    resultsPanelOpen: boolean;
    setRenderPrompt: (prompt: string) => void;
    setRenderStyle: (style: string) => void;
    setRenderInfluence: (influence: number) => void;
    setRenderNumImages: (count: number) => void;
    setRenderReferenceImage: (image: string | undefined) => void;
    addRenderResultGroup: (settings: RenderSettings, images: string[], width: number, height: number, sourceNodeId?: string) => void;
    loadRenderSettings: (settings: RenderSettings) => void;
    clearRenderResults: () => void;
    setRenderResults: (results: RenderGroup[]) => void;
    setPreviewingRender: (image: string | null) => void;
    setIsPreviewVisible: (visible: boolean) => void;
    setRendering: (loading: boolean) => void;
    setResultsPanelOpen: (open: boolean) => void;
}

export const createRenderSlice: StateCreator<AppState, [], [], RenderSlice> = (set) => ({
    renderSettings: {
        prompt: '',
        stylePreset: 'Photorealistic',
        drawingInfluence: 1.0,
        numImages: 1,
    },
    renderResults: [],
    previewingRender: null,
    isPreviewVisible: true,
    isRendering: false,
    resultsPanelOpen: false,
    setRenderPrompt: (prompt) => set((state: AppState) => ({
        renderSettings: { ...state.renderSettings, prompt }
    })),
    setRenderStyle: (stylePreset) => set((state: AppState) => ({
        renderSettings: { ...state.renderSettings, stylePreset }
    })),
    setRenderInfluence: (drawingInfluence) => set((state: AppState) => ({
        renderSettings: { ...state.renderSettings, drawingInfluence }
    })),
    setRenderNumImages: (numImages) => set((state: AppState) => ({
        renderSettings: { ...state.renderSettings, numImages }
    })),
    setRenderReferenceImage: (referenceImage) => set((state: AppState) => ({
        renderSettings: { ...state.renderSettings, referenceImage }
    })),
    addRenderResultGroup: (settings, images, width, height, sourceNodeId) => set((state: AppState) => ({
        renderResults: [
            {
                id: Math.random().toString(36).substr(2, 9),
                prompt: settings.prompt,
                style: settings.stylePreset,
                settings: { ...settings },
                images,
                timestamp: Date.now(),
                width,
                height,
                sourceNodeId
            },
            ...state.renderResults
        ],
        resultsPanelOpen: true
    })),
    loadRenderSettings: (settings) => set((state: AppState) => ({
        renderSettings: settings ? { ...state.renderSettings, ...settings } : state.renderSettings
    })),
    clearRenderResults: () => set({ renderResults: [] }),
    setRenderResults: (renderResults) => set({ renderResults }),
    setPreviewingRender: (previewingRender) => set({ previewingRender }),
    setIsPreviewVisible: (isPreviewVisible) => set({ isPreviewVisible }),
    setRendering: (isRendering) => set({ isRendering: isRendering }),
    setResultsPanelOpen: (resultsPanelOpen) => set({ resultsPanelOpen }),
});
