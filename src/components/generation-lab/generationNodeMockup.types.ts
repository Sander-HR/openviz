export type GenerationMode = 'base' | 'modify' | 'animate' | 'instant-render' | 'variation' | 'new-view' | 'extract';

export interface ModifyConfiguration {
    aspectRatio: string;
}

export interface AnimateConfiguration {
    styleId: string;
    duration: string;
}
export type VariationKind = 'form' | 'color';
export type ExtractKind = 'color' | 'material' | 'parts';
export type VariationCount = 2 | 4 | 8;
export type VariationPreset = 'Balanced' | 'Soft sculpt' | 'Geometric' | 'Organic';
export type FormPosition = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
export type VariationAxis = 'top' | 'bottom' | 'left' | 'right';
export type ExtractSampleBy = 'Hierarchy' | 'Region';

export interface VariationConfiguration {
    kind: VariationKind;
    axisLabels: Record<VariationAxis, string>;
    position: FormPosition;
    preset: VariationPreset;
    paletteName: string;
    swatches: string[];
    colorCount: VariationCount;
    formCount: VariationCount;
}

export interface GenerationPlaygroundState {
    mode: GenerationMode;
    prompt: string;
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
