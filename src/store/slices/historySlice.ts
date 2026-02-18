import { StateCreator } from 'zustand';
import { AppState } from '../storeTypes';
import { Project } from '../../types';
import { INITIAL_PROJECT } from '../initialState';

export interface HistorySlice {
    history: Project[];
    historyIndex: number;
    undo: () => void;
    redo: () => void;
    pushHistory: () => void;
}

export const createHistorySlice: StateCreator<AppState, [], [], HistorySlice> = (set, get) => ({
    history: [INITIAL_PROJECT],
    historyIndex: 0,
    undo: () => {
        const state = get() as AppState;
        if (state.historyIndex > 0) {
            set({
                project: state.history[state.historyIndex - 1],
                historyIndex: state.historyIndex - 1
            });
        }
    },

    redo: () => {
        const state = get() as AppState;
        if (state.historyIndex < state.history.length - 1) {
            set({
                project: state.history[state.historyIndex + 1],
                historyIndex: state.historyIndex + 1
            });
        }
    },

    pushHistory: () => {
        const state = get() as AppState;
        const snapshot = structuredClone(state.project);
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(snapshot);
        if (newHistory.length > 50) newHistory.shift();
        set({
            history: newHistory,
            historyIndex: newHistory.length - 1
        });
    },
});
