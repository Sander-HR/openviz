import type { StateCreator } from 'zustand';
import type { AppState } from '../storeTypes';
import type { RenderTaskRequest, RenderTaskStatus } from '@/types/renderTask.types';
import type { ExtractionOutput } from '@/services/ai/extractionService';
import { generateUUID } from '@/utils/uuid';

/** A connected source image for render tasks (node attachment). */
export interface RenderTaskReference {
    id: string;
    name: string;
    dataUrl: string;
}

/** One displayable output of the active task (seed lock target, SC-008). */
export interface RenderTaskOutputState {
    id: string;
    url?: string;
    seed?: number;
}

/** UI status: coordinator states plus `idle` for "no active task". */
export type RenderTaskUiStatus = RenderTaskStatus | 'idle';

export interface RenderTaskSlice {
    renderReferences: RenderTaskReference[];
    renderTaskStatus: RenderTaskUiStatus;
    renderTaskQueuePosition: number | null;
    renderTaskError: string | null;
    renderTaskOutputs: RenderTaskOutputState[];
    renderTaskExtraction: ExtractionOutput | null;
    /** Coordinator task id (queue/cancel handle). */
    renderTaskId: string | null;
    /** Persisted TaskRecord id (FR-019). */
    renderRecordId: string | null;
    /** Last submitted request — retry and seed-locked regeneration reuse it. */
    lastRenderRequest: RenderTaskRequest | null;

    addRenderReference: (name: string, dataUrl: string) => void;
    /** Inserts at index 0 so the newest image is the primary source (`references[0]`). */
    prependRenderReference: (name: string, dataUrl: string) => void;
    removeRenderReference: (id: string) => void;
    setLastRenderRequest: (request: RenderTaskRequest | null) => void;
    /** Called when a submission is accepted by the coordinator. */
    setRenderTaskActive: (taskId: string, recordId: string) => void;
    setRenderTaskProgress: (patch: {
        status?: RenderTaskUiStatus;
        queuePosition?: number | null;
        error?: string | null;
        outputs?: RenderTaskOutputState[];
        extraction?: ExtractionOutput | null;
    }) => void;
    /** Clears task state (keeps references and lastRenderRequest for retry). */
    resetRenderTask: () => void;
}

export const createRenderTaskSlice: StateCreator<AppState, [], [], RenderTaskSlice> = (set) => ({
    renderReferences: [],
    renderTaskStatus: 'idle',
    renderTaskQueuePosition: null,
    renderTaskError: null,
    renderTaskOutputs: [],
    renderTaskExtraction: null,
    renderTaskId: null,
    renderRecordId: null,
    lastRenderRequest: null,

    addRenderReference: (name, dataUrl) => set((state) => ({
        renderReferences: [...state.renderReferences, { id: generateUUID(), name, dataUrl }],
    })),

    prependRenderReference: (name, dataUrl) => set((state) => ({
        renderReferences: [{ id: generateUUID(), name, dataUrl }, ...state.renderReferences],
    })),

    removeRenderReference: (id) => set((state) => ({
        renderReferences: state.renderReferences.filter((reference) => reference.id !== id),
    })),

    setLastRenderRequest: (request) => set({ lastRenderRequest: request }),

    setRenderTaskActive: (taskId, recordId) => set({
        renderTaskId: taskId,
        renderRecordId: recordId,
        renderTaskStatus: 'queued',
        renderTaskQueuePosition: null,
        renderTaskError: null,
        renderTaskOutputs: [],
        renderTaskExtraction: null,
    }),

    setRenderTaskProgress: (patch) => set({
        ...(patch.status !== undefined ? { renderTaskStatus: patch.status } : {}),
        ...(patch.queuePosition !== undefined ? { renderTaskQueuePosition: patch.queuePosition } : {}),
        ...(patch.error !== undefined ? { renderTaskError: patch.error } : {}),
        ...(patch.outputs !== undefined ? { renderTaskOutputs: patch.outputs } : {}),
        ...(patch.extraction !== undefined ? { renderTaskExtraction: patch.extraction } : {}),
    }),

    resetRenderTask: () => set({
        renderTaskStatus: 'idle',
        renderTaskQueuePosition: null,
        renderTaskError: null,
        renderTaskOutputs: [],
        renderTaskExtraction: null,
        renderTaskId: null,
        renderRecordId: null,
    }),
});
