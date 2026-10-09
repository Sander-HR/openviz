import { StateCreator } from 'zustand';
import { AppState } from '../storeTypes';
import { INITIAL_PROJECT } from '../initialState';
import { AspectRatio, WorkbenchNode } from '../../types';

export interface ProjectSlice {
    project: typeof INITIAL_PROJECT;
    setName: (name: string) => void;
    setCanvasSize: (width: number, height: number, ratio: AspectRatio) => void;
    setBackgroundColor: (color: string) => void;
    setZoom: (zoom: number) => void;
    setPan: (x: number, y: number) => void;
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set) => ({
    project: INITIAL_PROJECT,
    setName: (name) => set((state: AppState) => {
        const newProject = { ...state.project, name, lastModifiedAt: Date.now() };
        return {
            project: newProject,
            workbenchNodes: state.workbenchNodes.map((n: WorkbenchNode) =>
                n.id === state.activeNodeId ? { ...n, name, project: newProject } : n
            )
        };
    }),
    setCanvasSize: (width, height, ratio) => set((state: AppState) => ({
        project: {
            ...state.project,
            canvas: { ...state.project.canvas, width, height, aspectRatio: ratio },
            lastModifiedAt: Date.now()
        }
    })),
    setBackgroundColor: (backgroundColor) => set((state: AppState) => ({
        project: {
            ...state.project,
            canvas: { ...state.project.canvas, backgroundColor },
            lastModifiedAt: Date.now()
        }
    })),
    setZoom: (zoomLevel) => set((state: AppState) => ({
        project: {
            ...state.project,
            canvas: { ...state.project.canvas, zoomLevel }
        }
    })),
    setPan: (panX, panY) => set((state: AppState) => ({
        project: {
            ...state.project,
            canvas: { ...state.project.canvas, panX, panY }
        }
    })),
});

