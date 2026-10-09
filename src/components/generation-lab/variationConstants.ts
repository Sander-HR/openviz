import type { FormDirection } from '@/types/renderTask.types';
import type { VariationCount, VariationPreset } from './generationNodeMockup.types';

/** The studio variate panel's direction templates (VariationPanel parity). */
export interface VariationPresetTemplate {
    name: VariationPreset;
    /** [left, right] axis labels. */
    horizontal: [string, string];
    /** [top, bottom] axis labels. */
    vertical: [string, string];
}

/** Copied from the studio VariationPanel: seven direction templates incl. Custom. */
export const VARIATION_PRESETS: VariationPresetTemplate[] = [
    { name: 'Expression', horizontal: ['Geometric', 'Organic'], vertical: ['Complex', 'Simple'] },
    { name: 'Proportion', horizontal: ['Narrow', 'Wide'], vertical: ['Tall', 'Short'] },
    { name: 'Massing', horizontal: ['Light', 'Heavy'], vertical: ['Airy', 'Dense'] },
    { name: 'Edge Quality', horizontal: ['Soft', 'Sharp'], vertical: ['Rounded', 'Angular'] },
    { name: 'Symmetry & Balance', horizontal: ['Symmetrical', 'Asymmetrical'], vertical: ['Stable', 'Dynamic'] },
    { name: 'Flow / Continuity', horizontal: ['Smooth', 'Faceted'], vertical: ['Flowing', 'Broken'] },
    { name: 'Custom', horizontal: ['Geometric', 'Organic'], vertical: ['Complex', 'Simple'] },
];

/** UI preset label → resolver direction preset (FR-015 documented phrasings). */
export const PRESET_TO_DIRECTION: Record<VariationPreset, FormDirection['preset']> = {
    Expression: 'expression',
    Proportion: 'proportion',
    Massing: 'massing',
    'Edge Quality': 'edge-quality',
    'Symmetry & Balance': 'symmetry-balance',
    'Flow / Continuity': 'flow-continuity',
    Custom: 'custom',
};

/** Studio color palette presets (VariationPanel parity). */
export interface ColorPreset {
    name: string;
    colors: string[];
}

export const COLOR_PRESETS: ColorPreset[] = [
    { name: 'Modern Industrial', colors: ['#111111', '#52627b', '#9fa8d0', '#313236'] },
    { name: 'Soft Pink', colors: ['#f9e6eb', '#f7bac9', '#f29ab4', '#ef668c'] },
    { name: 'Autumn Harvest', colors: ['#851d1d', '#c29a58', '#4c2c1b', '#9f5b2c', '#ffebb2'] },
    { name: 'Midnight Oasis', colors: ['#102131', '#1c304b', '#466381', '#91a3ba', '#e7e8e2'] },
    { name: 'Coastal Breeze', colors: ['#d5f3f6', '#a4e3eb', '#86d7e2', '#4ac1d6', '#079ac2'] },
];

/** FR-014: exactly the configured count, no silent remap. */
export const VARIATION_COUNTS: VariationCount[] = [1, 2, 3, 4];
