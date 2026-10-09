import { StateCreator } from 'zustand';
import { AppState } from '../storeTypes';
import { ToolType } from '../../types';

export interface ToolSlice {
    toolSettings: {
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
    };
    setActiveTool: (tool: ToolType) => void;
    setBrushSize: (size: number) => void;
    setBrushColor: (color: string) => void;
    setBrushOpacity: (opacity: number) => void;
    setBrushStabilizer: (stabilizer: number) => void;
    setBrushHardness: (hardness: number) => void;
    setEraserSize: (size: number) => void;
}

export const createToolSlice: StateCreator<AppState, [], [], ToolSlice> = (set) => ({
    toolSettings: {
        activeTool: 'brush',
        brushSize: 5,
        brushColor: '#000000',
        brushOpacity: 100,
        brushStabilizer: 20,
        brushHardness: 80,
        eraserSize: 20,
        shapeFill: 'transparent',
        shapeStroke: '#000000',
        strokeWidth: 2,
    },
    setActiveTool: (activeTool) => set((state: AppState) => ({
        toolSettings: { ...state.toolSettings, activeTool }
    })),
    setBrushSize: (brushSize) => set((state: AppState) => ({
        toolSettings: { ...state.toolSettings, brushSize }
    })),
    setBrushColor: (brushColor) => set((state: AppState) => ({
        toolSettings: { ...state.toolSettings, brushColor }
    })),
    setBrushOpacity: (brushOpacity) => set((state: AppState) => ({
        toolSettings: { ...state.toolSettings, brushOpacity }
    })),
    setBrushStabilizer: (brushStabilizer) => set((state: AppState) => ({
        toolSettings: { ...state.toolSettings, brushStabilizer }
    })),
    setBrushHardness: (brushHardness) => set((state: AppState) => ({
        toolSettings: { ...state.toolSettings, brushHardness }
    })),
    setEraserSize: (eraserSize) => set((state: AppState) => ({
        toolSettings: { ...state.toolSettings, eraserSize }
    })),
});
