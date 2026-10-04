/**
 * Feature 012 — AI Render Task Parameters: task-level types.
 *
 * Mirrors specs/012-ai-render-task-params/contracts/render-task-request.schema.json,
 * contracts/task-record.schema.json and contracts/extraction-output.schema.json.
 * All IDs are strings (ULID); timestamps are epoch milliseconds.
 */

import type { ViewName } from './workbenchParity.types';

export type { ViewName };

// ---------------------------------------------------------------------------
// Task kinds & request (render-task-request.schema.json)
// ---------------------------------------------------------------------------

/** The seven MVP render task kinds; `expression` is deferred (UI shows "Soon"). */
export type RenderTaskKind =
    | 'modify'
    | 'instant-render'
    | 'form-variate'
    | 'color-variate'
    | 'new-view'
    | 'animate'
    | 'extract';

/** Aspect-ratio presets (FR-013); the resolver maps each to multiple-of-16 dims. */
export type RenderTaskAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | '3:2' | '2:3';

/** 32-bit unsigned seed value (0..4294967295). */
export type RenderTaskSeed = number;

export interface FormDirectionAxisLabels {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
}

/** Form-variate direction control (FR-015): preset + magnitude 0–1. */
export interface FormDirection {
    preset: 'balanced' | 'soft-sculpt' | 'geometric' | 'organic';
    /** 0–1; maps to a bounded edit-strength band, capped below full-redraw. */
    magnitude: number;
    axisLabels?: FormDirectionAxisLabels;
}

/** Color-variate palette (FR-008): ≥ 1 hex swatch (`#rrggbb`). */
export interface RenderTaskPalette {
    name?: string;
    swatches: string[];
}

/** FR-003 MVP advanced set only. Mask/LoRA/control/upscale are NOT part of the contract. */
export interface RenderTaskAdvancedSettings {
    steps?: number;
    guidance?: number;
    referenceResolution?: 512 | 1024 | 2048;
}

/** Task-level user-facing request for one render task (resolver input). */
export interface RenderTaskRequest {
    kind: RenderTaskKind;
    /** ≤ 2000 chars; required & non-empty except color-variate/extract/new-view. */
    prompt?: string;
    referenceImageId?: string;
    endFrameImageId?: string;
    aspectRatio?: RenderTaskAspectRatio;
    /** 0–1; monotonic map to edit strength (lower = closer to source, FR-012). */
    referenceFidelity?: number;
    variationCount?: 2 | 4 | 8;
    formDirection?: FormDirection;
    palette?: RenderTaskPalette;
    targetView?: ViewName;
    duration?: '2s' | '4s' | '8s';
    extractKind?: 'color' | 'material' | 'parts';
    sampleBy?: 'hierarchy' | 'region';
    /** Locked seed for exact regeneration (SC-008); implies single output. */
    seed?: RenderTaskSeed;
    advanced?: RenderTaskAdvancedSettings;
}

// ---------------------------------------------------------------------------
// Resolved parameters (resolver output, provider-neutral)
// ---------------------------------------------------------------------------

/** Capability-class routing (FR-020). */
export type RenderWorkflow = 'edit' | 'reference' | 'video' | 'extract';

/** Provenance of the defaults used (FR-021 benchmark gate). */
export type BenchmarkStatus = 'starting' | 'validated';

export interface ResolvedRenderParameters {
    workflow: RenderWorkflow;
    /** Template-rendered prompt, preservation clauses included (FR-005..FR-011). */
    prompt: string;
    negativePrompt?: string | null;
    /** Multiples of 16 (R5). */
    width?: number;
    height?: number;
    /** Edit workflows only; 0–1. */
    strength?: number | null;
    steps?: number;
    /** Never includes dual-stage video guidance values (FR-002). */
    guidance?: number | null;
    referenceResolution?: 512 | 1024 | 2048;
    /** Length = output count; unique within a batch (FR-014). */
    seeds: RenderTaskSeed[];
    firstFrame?: string | null;
    lastFrame?: string | null;
    numFrames?: number | null;
    fps?: number | null;
    benchmarkStatus: BenchmarkStatus;
}

// ---------------------------------------------------------------------------
// Task record (task-record.schema.json — FR-019, SC-008)
// ---------------------------------------------------------------------------

/** Task status state machine (data-model.md §4). */
export type RenderTaskStatus =
    | 'queued'
    | 'active'
    | 'completed'
    | 'partial'
    | 'failed'
    | 'cancelled'
    | 'interrupted';

/** Active protocol at submission; serves both image and video routes. */
export type RenderTaskProtocol = 'openai-compatible' | 'comfyui';

/** FR-019 machine-readable task record; SC-008 reproducibility source. */
export interface TaskRecord {
    id: string;
    projectId?: string | null;
    kind: RenderTaskKind;
    /** User-level inputs, verbatim. */
    request: RenderTaskRequest;
    /** Exact backend parameters used. */
    resolved: ResolvedRenderParameters;
    protocol: RenderTaskProtocol;
    /** e.g. `qwen-image-edit-2511`, `wan-2.2` (informational, not user-facing). */
    modelFamily?: string | null;
    status: RenderTaskStatus;
    /** 1-based FIFO position at submission (FR-022 visibility). */
    queuePositionAtSubmit?: number | null;
    /** Terminal failure reason. */
    error?: string | null;
    /** → GenerationResult rows; a batch shares one task. */
    outputIds: string[];
    createdAt: number;
    updatedAt: number;
}

/**
 * State transitions (data-model.md §4):
 * queued → active (slot acquired) | cancelled (pre-run);
 * active → completed (all ok) | partial (some ok) | failed (all fail/timeout)
 *         | cancelled (mid-run, supported);
 * interrupted = reload with no live promise (terminal, retryable).
 */
export const RENDER_TASK_STATUS_TRANSITIONS: Record<RenderTaskStatus, readonly RenderTaskStatus[]> = {
    queued: ['active', 'cancelled'],
    active: ['completed', 'partial', 'failed', 'cancelled'],
    completed: [],
    partial: [],
    failed: [],
    cancelled: [],
    interrupted: [],
};

/** Terminal states have no outgoing transitions. */
export function isRenderTaskStatusTerminal(status: RenderTaskStatus): boolean {
    return RENDER_TASK_STATUS_TRANSITIONS[status].length === 0;
}

// ---------------------------------------------------------------------------
// Extraction (extraction-output.schema.json — FR-018)
// ---------------------------------------------------------------------------

/** Normalized bounding box, 0–1 coordinates relative to the source image. */
export interface ExtractionRegion {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** color kind only: representative color + deterministic hex + confidence. */
export interface ExtractionColor {
    label?: string;
    /** `#rrggbb`. */
    hex: string;
    confidence: number;
}

/** material kind only: observations separated from inferences (FR-018). */
export interface ExtractionMaterial {
    category?: string;
    finish?: string;
    texture?: string;
    roughnessImpression?: string;
    metallicAppearance?: boolean;
    reflectivity?: string;
    observations: string[];
    inferences: string[];
}

/** One structured component of an extraction result (background excluded). */
export interface ExtractionComponent {
    name: string;
    /** Semantic role (parts kind). */
    role?: string;
    region: ExtractionRegion;
    color?: ExtractionColor | null;
    material?: ExtractionMaterial | null;
}

/** Persisted extraction record (`extraction_records` table). */
export interface ExtractionRecord {
    id: string;
    /** → TaskRecord.id (kind='extract'). */
    taskId: string;
    sourceImageId: string;
    kind: 'color' | 'material' | 'parts';
    sampleBy: 'hierarchy' | 'region';
    components: ExtractionComponent[];
    /** Overall record confidence, 0–1. */
    confidence: number;
    createdAt: number;
}

// ---------------------------------------------------------------------------
// Project assets (project_assets table — FR-023)
// ---------------------------------------------------------------------------

export type ProjectAssetKind = 'palette' | 'material-notes' | 'part-list';

export interface PaletteAssetPayload {
    name?: string;
    swatches: string[];
}

export interface MaterialNotesAssetPayload {
    components: Array<{ name: string; material: ExtractionMaterial }>;
}

export interface PartListAssetPayload {
    components: Array<{ name: string; role?: string }>;
}

/** Saved, referenceable unit of design data created from an extraction record. */
export interface ProjectAsset {
    id: string;
    projectId: string;
    kind: ProjectAssetKind;
    /** Provenance → ExtractionRecord.id. */
    extractionRecordId: string;
    payload: PaletteAssetPayload | MaterialNotesAssetPayload | PartListAssetPayload;
    createdAt: number;
}
