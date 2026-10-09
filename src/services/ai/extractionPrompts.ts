/**
 * Feature 012 — T022 structured-analysis prompts for Extract (FR-018, R2).
 *
 * Pure prompt builders: one system contract per extraction kind plus a
 * user instruction that varies by sampling mode (`hierarchy` = top-level
 * product components, `region` = spatial regions). The vision model must
 * answer with a single JSON object matching
 * contracts/extraction-output.schema.json — analysis only, never pixels.
 */

export type ExtractionKind = 'color' | 'material' | 'parts';
export type ExtractionSampleBy = 'hierarchy' | 'region';

const KIND_CONTRACTS: Record<ExtractionKind, string> = {
    color: [
        'For each component include a "color" object with: "label" (short human name for the color),',
        '"hex" (approximate "#rrggbb"), and "confidence" (0-1). Hex values are approximate:',
        'the product refines them from pixels afterwards, so favour honest estimates over false precision.',
    ].join(' '),
    material: [
        'For each component include a "material" object with optional "category", "finish", "texture",',
        '"roughnessImpression", "metallicAppearance" (boolean), and "reflectivity", plus two arrays:',
        '"observations" (directly visible facts only) and "inferences" (educated guesses, clearly separated).',
    ].join(' '),
    parts: [
        'For each component include a "role" (its semantic function in the product, e.g. "counterweight")',
        'and keep single physical components whole — do not split one part into several entries.',
    ].join(' '),
};

export interface ExtractionPrompt {
    system: string;
    user: string;
}

export function buildExtractionPrompt(kind: ExtractionKind, sampleBy: ExtractionSampleBy): ExtractionPrompt {
    const unit = sampleBy === 'hierarchy' ? 'top-level product components' : 'spatial regions of the product';
    return {
        system: [
            'You are a product-image analysis engine. You analyze one product photograph and answer with',
            'ONLY a JSON object — no prose, no markdown fences — matching this shape:',
            '{"kind":"<kind>","sampleBy":"<hierarchy|region>","confidence":0-1,"components":[{"name":"...","region":{"x":0-1,"y":0-1,"w":>0-1,"h":>0-1}, ...}]}.',
            'Regions are normalized bounding boxes in 0-1 coordinates relative to the image.',
            `Analyze ${unit}; each component needs a "name" and a "region".`,
            KIND_CONTRACTS[kind],
            'Exclude background content entirely: never report the backdrop, floor, or scenery as a component.',
            'If the image is cluttered or not a product, lower "confidence" instead of inventing components.',
        ].join(' '),
        user:
            sampleBy === 'hierarchy'
                ? 'Identify the top-level physical components of the product in this image and report one entry per component.'
                : 'Divide the visible product into spatial regions and report one entry per region, naming what it shows.',
    };
}
