import { StateCreator } from 'zustand';
import { AppState } from '../storeTypes';
import { Layer } from '../../types';

export interface LayerSlice {
    activeLayerId: string | null;
    addLayer: (type?: 'sketch' | 'image' | 'render') => void;
    removeLayer: (id: string) => void;
    setActiveLayer: (id: string | null) => void;
    updateLayer: (id: string, updates: Partial<Layer>) => void;
    reorderLayers: (startIndex: number, endIndex: number) => void;
    duplicateLayer: (id: string) => void;
    copyLayer: (id: string) => void;
    pasteLayer: () => void;
    addResultAsLayer: (image: string) => void;
}

export const createLayerSlice: StateCreator<AppState, [], [], LayerSlice> = (set) => ({
    activeLayerId: 'layer-1',
    addLayer: (type = 'sketch') => set((state: AppState) => {
        const newLayer: Layer = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Layer ${state.project.layers.length}`,
            type,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            // Initialize transform properties
            x: 0,
            y: 0,
            width: state.project.canvas.width,
            height: state.project.canvas.height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            order: state.project.layers.length,
            created: Date.now(),
            modified: Date.now(),
        };
        return {
            project: {
                ...state.project,
                layers: [...state.project.layers, newLayer],
                lastModifiedAt: Date.now()
            },
            activeLayerId: newLayer.id
        };
    }),
    removeLayer: (id) => set((state: AppState) => {
        if (state.project.layers.length <= 1) return state;
        const newLayers = state.project.layers.filter(l => l.id !== id);
        return {
            project: {
                ...state.project,
                layers: newLayers,
                lastModifiedAt: Date.now()
            },
            activeLayerId: state.activeLayerId === id ? newLayers[newLayers.length - 1].id : state.activeLayerId
        };
    }),
    setActiveLayer: (activeLayerId) => set({ activeLayerId }),
    updateLayer: (id, updates) => set((state: AppState) => ({
        project: {
            ...state.project,
            layers: state.project.layers.map(l => l.id === id ? { ...l, ...updates, modified: Date.now() } : l),
            lastModifiedAt: Date.now()
        }
    })),
    reorderLayers: (startIndex, endIndex) => set((state: AppState) => {
        const newLayers = Array.from(state.project.layers);
        const [removed] = newLayers.splice(startIndex, 1);
        newLayers.splice(endIndex, 0, removed);
        return {
            project: {
                ...state.project,
                layers: newLayers.map((l, i) => ({ ...l, order: i })),
                lastModifiedAt: Date.now()
            }
        };
    }),
    duplicateLayer: (id) => set((state: AppState) => {
        const layer = state.project.layers.find(l => l.id === id);
        if (!layer) return state;

        const newLayer: Layer = {
            ...JSON.parse(JSON.stringify(layer)),
            id: Math.random().toString(36).substr(2, 9),
            name: `${layer.name} (Copy)`,
            order: state.project.layers.length,
            created: Date.now(),
            modified: Date.now(),
        };

        return {
            project: {
                ...state.project,
                layers: [...state.project.layers, newLayer],
                lastModifiedAt: Date.now()
            },
            activeLayerId: newLayer.id
        };
    }),
    copyLayer: (id) => set((state: AppState) => {
        const layer = state.project.layers.find(l => l.id === id);
        if (!layer) return state;
        return { clipboard: JSON.parse(JSON.stringify(layer)) };
    }),
    pasteLayer: () => set((state: AppState) => {
        if (!state.clipboard) return state;

        const clipboardData = state.clipboard as unknown as Layer;
        const newLayer: Layer = {
            ...JSON.parse(JSON.stringify(clipboardData)),
            id: Math.random().toString(36).substr(2, 9),
            name: `${clipboardData.name} (Pasted)`,
            order: state.project.layers.length,
            created: Date.now(),
            modified: Date.now(),
        };

        return {
            project: {
                ...state.project,
                layers: [...state.project.layers, newLayer],
                lastModifiedAt: Date.now()
            },
            activeLayerId: newLayer.id
        };
    }),
    addResultAsLayer: (image) => set((state: AppState) => {
        const newLayerStyle = state.renderSettings.stylePreset;
        const newLayer: Layer = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Render: ${newLayerStyle}`,
            type: 'render',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            image,
            thumbnail: image,
            // Initialize transform properties
            x: 0,
            y: 0,
            width: state.project.canvas.width,
            height: state.project.canvas.height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            order: state.project.layers.length,
            created: Date.now(),
            modified: Date.now(),
        };
        return {
            project: {
                ...state.project,
                layers: [...state.project.layers, newLayer],
                lastModifiedAt: Date.now()
            },
            activeLayerId: newLayer.id,
            previewingRender: null // Clear preview after adding
        };
    }),
});
