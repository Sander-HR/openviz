/**
 * Feature 012 — render task parameter resolver (T002).
 *
 * Pure function mapping a user-facing `RenderTaskRequest` to the
 * provider-neutral `ResolvedRenderParameters` consumed by the protocol
 * translators (R4). No I/O, no store access. Per-task prompt templates live in
 * `renderTaskPromptRegistry.ts` (T003) — this resolver only handles numeric /
 * routing parameters and passes prompts through verbatim.
 */

import type {
    BenchmarkStatus,
    RenderTaskAspectRatio,
    RenderTaskRequest,
    RenderTaskSeed,
    ResolvedRenderParameters,
} from '@/types/renderTask.types';
import { composeRenderTaskPrompt } from './renderTaskPromptRegistry';

export interface ResolveRenderTaskOptions {
    /** Inject deterministic seeds in tests; defaults to a Math.random-based 32-bit generator. */
    randomSeedGenerator?: () => number;
    /** Provenance of the defaults used (FR-021); all built-in defaults are starting ranges. */
    benchmarkStatus?: BenchmarkStatus;
    /** Resolved @-mention reference names, passed into the prompt templates (R7). */
    referenceNames?: string[];
}

/** Boundary error for invalid task-level requests (data-model.md §Validation rules). */
export class RenderTaskValidationError extends Error {}

function assertValid(request: RenderTaskRequest): void {
    const fail = (message: string): never => {
        throw new RenderTaskValidationError(message);
    };

    if (!request.referenceImageId) {
        fail('A reference image is required for every render task.');
    }

    const variationCount = request.variationCount;
    if (variationCount !== undefined && ![1, 2, 3, 4].includes(variationCount)) {
        fail(`Invalid variation count ${String(variationCount)}: must be 1, 2, 3 or 4.`);
    }

    if (request.seed !== undefined && variationCount !== undefined && variationCount > 1) {
        fail('A locked seed produces a single output; remove the seed or set the variation count to 1.');
    }

    const promptRequired = request.kind === 'modify' || request.kind === 'instant-render' || request.kind === 'animate';
    if (promptRequired && !(request.prompt ?? '').trim()) {
        fail('A non-empty prompt is required for this task.');
    }

    if (request.aspectRatio !== undefined && !isPresetAspectRatio(request.aspectRatio)) {
        fail(`Invalid aspect ratio ${String(request.aspectRatio)}: must be one of the documented presets.`);
    }

    if (request.kind === 'new-view' && !request.targetView) {
        fail('A target view is required for New View.');
    }
}

function isPresetAspectRatio(value: string): value is RenderTaskAspectRatio {
    return Object.prototype.hasOwnProperty.call(ASPECT_RATIO_DIMS, value);
}

// ---------------------------------------------------------------------------
// Constants (R4: OpenViz starting values unless vendor-documented)
// ---------------------------------------------------------------------------

/** R5 preset table: aspect ratio → multiple-of-16 dims at a 1024-class base. */
const ASPECT_RATIO_DIMS: Record<RenderTaskAspectRatio, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '4:3': { width: 1152, height: 864 },
    '3:4': { width: 864, height: 1152 },
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
    '3:2': { width: 1216, height: 816 },
    '2:3': { width: 816, height: 1216 },
};

/** FR-012 default: strong source preservation ⇒ low edit strength. */
const DEFAULT_REFERENCE_FIDELITY = 0.9;

/** FR-012 linear inverted map: strength = 0.85 * (1 - referenceFidelity), clamped to [0, 1]. */
const FIDELITY_STRENGTH_SCALE = 0.85;

/** FR-015 bounded band: strength = 0.25 + 0.45 * magnitude → [0.25, 0.70], capped below full-redraw. */
const FORM_BAND_FLOOR = 0.25;
const FORM_BAND_SPAN = 0.45;

/** R1: documented default fps for the wan-2.2 class family. */
const DEFAULT_VIDEO_FPS = 24;

const DURATION_SECONDS: Record<NonNullable<RenderTaskRequest['duration']>, number> = {
    '2s': 2,
    '4s': 4,
    '8s': 8,
};

/** Vendor-default-ish starting values (FR-021 → benchmarkStatus 'starting'). */
const IMAGE_DEFAULTS = { steps: 30, guidance: 4.0 };
const VIDEO_DEFAULTS = { steps: 30, guidance: 5.0 };
const DEFAULT_REFERENCE_RESOLUTION: 512 | 1024 | 2048 = 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampUnit(value: number): number {
    return Math.min(1, Math.max(0, value));
}

/** FR-012: lower fidelity ⇒ closer to source ⇒ lower edit strength. */
export function fidelityToStrength(referenceFidelity: number | undefined): number {
    const fidelity = clampUnit(referenceFidelity ?? DEFAULT_REFERENCE_FIDELITY);
    return FIDELITY_STRENGTH_SCALE * (1 - fidelity);
}

/** FR-015: magnitude 0–1 → bounded band [0.25, 0.70], strictly below full-redraw. */
export function formMagnitudeToStrength(magnitude: number): number {
    return FORM_BAND_FLOOR + FORM_BAND_SPAN * clampUnit(magnitude);
}

function toSeed(value: number): RenderTaskSeed {
    // Wrap into the 32-bit unsigned range regardless of generator output.
    return ((value % 4294967296) + 4294967296) % 4294967296;
}

function defaultSeedGenerator(): number {
    return Math.floor(Math.random() * 4294967296);
}

/** FR-014: N unique seeds; locked seed ⇒ exactly one output with that seed. */
export function resolveSeeds(request: RenderTaskRequest, randomSeedGenerator?: () => number): RenderTaskSeed[] {
    if (request.seed !== undefined) {
        return [toSeed(request.seed)];
    }

    const count = request.variationCount ?? 1;
    const generate = randomSeedGenerator ?? defaultSeedGenerator;
    const seeds: RenderTaskSeed[] = [];
    const seen = new Set<RenderTaskSeed>();
    while (seeds.length < count) {
        const seed = toSeed(generate());
        if (!seen.has(seed)) {
            seen.add(seed);
            seeds.push(seed);
        }
    }
    return seeds;
}

// ---------------------------------------------------------------------------
// Per-kind resolution
// ---------------------------------------------------------------------------

export function resolveRenderTask(request: RenderTaskRequest, options?: ResolveRenderTaskOptions): ResolvedRenderParameters {
    assertValid(request);
    const workflow = routeWorkflow(request.kind);
    const seeds = resolveSeeds(request, options?.randomSeedGenerator);
    const advanced = request.advanced;

    // Template-rendered prompts incl. preservation clauses (FR-005..FR-011);
    // the resolved record is self-contained for FR-019/SC-008 reproducibility.
    const composed = composeRenderTaskPrompt(request, options?.referenceNames);
    const prompt = composed.prompt;
    const negativePrompt = composed.negativePrompt ?? null;

    const resolved: ResolvedRenderParameters = {
        workflow,
        prompt,
        negativePrompt,
        seeds,
        benchmarkStatus: options?.benchmarkStatus ?? 'starting',
    };

    if (workflow === 'extract') {
        // Vision/segmentation pipeline — no generative diffusion parameters.
        return resolved;
    }

    const isVideo = workflow === 'video';
    resolved.steps = advanced?.steps ?? (isVideo ? VIDEO_DEFAULTS.steps : IMAGE_DEFAULTS.steps);
    resolved.guidance = advanced?.guidance ?? (isVideo ? VIDEO_DEFAULTS.guidance : IMAGE_DEFAULTS.guidance);
    resolved.referenceResolution = advanced?.referenceResolution ?? DEFAULT_REFERENCE_RESOLUTION;

    if (workflow === 'edit') {
        const dims = request.aspectRatio ? ASPECT_RATIO_DIMS[request.aspectRatio] : undefined;
        if (dims) {
            resolved.width = dims.width;
            resolved.height = dims.height;
        }
        // No ratio ⇒ no width/height: the source image's dimensions apply downstream (R5).

        if (request.kind === 'form-variate' && request.formDirection) {
            resolved.strength = formMagnitudeToStrength(request.formDirection.magnitude);
        } else {
            resolved.strength = fidelityToStrength(request.referenceFidelity);
        }
    }

    if (workflow === 'reference') {
        const dims = ASPECT_RATIO_DIMS[request.aspectRatio ?? '1:1'];
        resolved.width = dims.width;
        resolved.height = dims.height;
    }

    if (isVideo) {
        // R1: duration × documented family fps → num_frames.
        const seconds = DURATION_SECONDS[request.duration ?? '2s'];
        resolved.numFrames = seconds * DEFAULT_VIDEO_FPS;
        resolved.fps = DEFAULT_VIDEO_FPS;
        resolved.firstFrame = request.referenceImageId ?? null;
        resolved.lastFrame = request.endFrameImageId ?? null;
    }

    return resolved;
}

/** FR-020 capability-class routing. */
export function routeWorkflow(kind: RenderTaskRequest['kind']): ResolvedRenderParameters['workflow'] {
    switch (kind) {
        case 'modify':
        case 'form-variate':
        case 'color-variate':
        case 'new-view':
            return 'edit';
        case 'instant-render':
            return 'reference';
        case 'animate':
            return 'video';
        case 'extract':
            return 'extract';
    }
}
