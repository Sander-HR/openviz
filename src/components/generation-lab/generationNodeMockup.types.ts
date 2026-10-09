import type { VariationCount } from '@/types/renderTask.types';

export type { VariationCount };

export type GenerationMode = 'base' | 'modify' | 'animate' | 'instant-render' | 'variation' | 'new-view' | 'extract';

export interface ModifyConfiguration {
    aspectRatio: string;
    /** 0–1; lower = closer to the source image (FR-012). */
    fidelity: number;
}

/** FR-003 MVP advanced set only. Mask/LoRA/control conditioning/upscale are deferred. */
export interface AdvancedConfiguration {
    open: boolean;
    /** Generation quality / inference steps. */
    steps: number;
    /** Prompt adherence (guidance). */
    guidance: number;
    referenceResolution: 512 | 1024 | 2048;
}

export interface AnimateConfiguration {
    styleId: string;
    duration: import('@/types/renderTask.types').RenderTaskDuration;
}
export type VariationKind = 'form' | 'color';
export type ExtractKind = 'color' | 'material' | 'parts';
/** The studio variate panel's seven direction templates (VariationPanel parity). */
export type VariationPreset =
    | 'Expression'
    | 'Proportion'
    | 'Massing'
    | 'Edge Quality'
    | 'Symmetry & Balance'
    | 'Flow / Continuity'
    | 'Custom';
/** Continuous 0–100 position on the form-variation slider (studio panel parity). */
export interface FormSliderPosition {
    x: number;
    y: number;
}
export type VariationAxis = 'top' | 'bottom' | 'left' | 'right';
export type ExtractSampleBy = 'Hierarchy' | 'Region';

export interface VariationConfiguration {
    kind: VariationKind;
    axisLabels: Record<VariationAxis, string>;
    /** Continuous 0–100 knob position on the form-variation slider. */
    position: FormSliderPosition;
    preset: VariationPreset;
    /** 0–1 form-morph magnitude (FR-015). */
    magnitude: number;
    paletteName: string;
    /** Hex swatches (`#rrggbb`), studio panel parity. */
    swatches: string[];
    colorCount: VariationCount;
    formCount: VariationCount;
}

export interface GenerationPlaygroundState {
    mode: GenerationMode;
    prompt: string;
    /** Instant Render output ratio (FR-013). */
    instantRatio: import('@/types/renderTask.types').RenderTaskAspectRatio;
    /** Instant Render style preset — a studio legacy renderer style id (`stylePromptRegistry`). */
    instantStyle?: string;
    advanced: AdvancedConfiguration;
    modify: ModifyConfiguration;
    animate: AnimateConfiguration;
    variation: VariationConfiguration;
    selectedView: string;
    extractKind: ExtractKind;
    sampleBy: ExtractSampleBy;
    extractAttached: boolean;
}

export type GenerationStatePatch = Partial<GenerationPlaygroundState>;
export type VariationPatch = Partial<VariationConfiguration>;
