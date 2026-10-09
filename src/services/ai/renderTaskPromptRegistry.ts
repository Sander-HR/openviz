/**
 * Feature 012 — per-task prompt / negative-prompt templates (FR-005..FR-011).
 *
 * Pure functions mirroring `stylePromptRegistry.ts`: given a task-level
 * request, return the exact backend prompt strings. Preservation clauses are
 * part of the contract and are always present; `renderTaskPromptRegistry.test.ts`
 * pins them with stable substrings so any template edit that drops a clause
 * fails the tests (R7). Template chips ("Make…", "Change…") stay client-side
 * and never appear here.
 */

import type { FormDirection, RenderTaskRequest } from '@/types/renderTask.types';

export interface ComposedRenderTaskPrompt {
    prompt: string;
    negativePrompt?: string;
}

/** FR-005 — every attribute a Modify task must keep untouched. */
const MODIFY_PRESERVATION =
    'Preserve the product\u2019s geometry, proportions, components, camera angle, composition, lighting and background exactly as in the reference image. Apply only the requested change.';

/** FR-005 — negative prompt constrains against exactly those unauthorized changes. */
const MODIFY_NEGATIVE =
    'changed geometry, altered proportions, replaced or added or removed components, camera movement, changed composition, changed lighting, different background, style shift, extra objects';

/** FR-006 — structural framing; the user's words become the subject core. */
const INSTANT_RENDER_SECTIONS: Array<{ label: string; text: (scene: string) => string }> = [
    { label: 'Subject', text: (scene) => scene },
    {
        label: 'Environment',
        text: () =>
            'Coherent context consistent with the subject, seamless studio or natural setting that supports the product.',
    },
    {
        label: 'Composition',
        text: () => 'Balanced framing with the product as the clear focal point; uncluttered negative space.',
    },
    {
        label: 'Camera',
        text: () => 'Stable eye-level product photography angle unless the description specifies otherwise.',
    },
    {
        label: 'Lighting',
        text: () => 'Soft, controlled studio lighting with physically plausible shadows and reflections.',
    },
    {
        label: 'Treatment',
        text: () => 'Crisp fine detail, accurate materials, polished commercial presentation.',
    },
];

/** FR-006 — preservation of the referenced product. */
const INSTANT_RENDER_PRESERVATION =
    'Preserve the referenced product\u2019s recognizable geometry and key details exactly as in the reference image.';

/** FR-006 — guards distortion, missing/duplicated components, malformed surfaces, text/watermarks. */
const INSTANT_RENDER_NEGATIVE =
    'product distortion, distorted surfaces, missing components, duplicated components, malformed surfaces, broken edges, warped proportions, unwanted text, watermarks, logo artifacts, low detail';

/** FR-015 — documented direction phrasings for the form presets. */
const FORM_PRESET_PHRASINGS: Record<FormDirection['preset'], string> = {
    balanced: 'a balanced refinement of the overall form',
    'soft-sculpt': 'a soft, organic sculpting of the silhouette and surface curvature',
    geometric: 'a more geometric, faceted reinterpretation of the form with crisper edges',
    organic: 'an organic, flowing deformation with smooth natural curves',
    expression: 'an expressive restatement of the overall character of the form',
    proportion: 'a re-proportioning of the silhouette dimensions of the form',
    massing: 'a shift in the massing and visual weight of the form',
    'edge-quality': 'a change in edge quality across the surfaces of the form',
    'symmetry-balance': 'a rebalancing of the symmetry and stability of the composition',
    'flow-continuity': 'a change in the flow and continuity of the surfaces of the form',
    custom: 'a form variation along the specified direction axes',
};

/** FR-007 — results must remain the same product concept. */
const FORM_IDENTITY_CONSTRAINT =
    'This is a controlled edit of this exact product, not free generation: keep the same product concept and identity \u2014 recognizable silhouette, component layout, materials and branding unchanged apart from the form direction.';

/** FR-007 — negative keeps results within the same product concept. */
const FORM_NEGATIVE =
    'different product concept, changed brand identity, added or removed components, distorted scale, changed materials, background changes, extra objects';

/** FR-008 — recolor with palette only; geometry/materials preserved. */
const COLOR_PRESERVATION =
    'Preserve the product\u2019s geometry, proportions and materials exactly as in the reference image; only surface colors change.';

/** FR-008 — negative excludes out-of-palette colors and any shape change. */
const COLOR_NEGATIVE =
    'colors outside the specified palette, other color tones, gradient shifts, geometry changes, proportion changes, material changes, component changes, background changes, text, watermarks';

/** FR-009 — strong geometry/component preservation incl. newly revealed surfaces. */
const NEW_VIEW_PRESERVATION =
    'Preserve the product\u2019s geometry, proportions and every component exactly; surfaces newly revealed by this viewpoint must continue the existing design consistently, with no new or missing parts.';

/** FR-009 — negative guards identity and surface continuity. */
const NEW_VIEW_NEGATIVE =
    'changed product identity, distorted geometry, missing or duplicated components, inconsistent surfaces, changed materials, different object, extra objects, text, watermarks';

/** FR-010 — temporal-only framing; appearance stays as in the start frame. */
const ANIMATE_APPEARANCE_PIN =
    'Describe only what changes over time (subject motion, camera motion, temporal progression). Do not re-describe the product\u2019s appearance; it stays exactly as in the start frame.';

/** FR-010 — suppress deformation, flicker, duplication, unintended camera movement. */
const ANIMATE_NEGATIVE =
    'deformation of the product, morphing shapes, flickering, component duplication, unintended camera movement, changing lighting, background changes, text, watermarks';

function joinParts(parts: Array<string | undefined>): string {
    return parts.filter((p): p is string => Boolean(p && p.trim())).join('\n');
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function formatMagnitude(magnitude: number): string {
    return `${Math.round(clamp01(magnitude) * 100)}%`;
}

/** FR-015 — documented direction phrasing for a form-variate preset. */
export function getFormDirectionPhrasing(preset: FormDirection['preset']): string {
    return FORM_PRESET_PHRASINGS[preset];
}

function formatAxisLabels(labels: FormDirection['axisLabels']): string | undefined {
    if (!labels) return undefined;
    const parts = (['top', 'bottom', 'left', 'right'] as const)
        .map((axis) => labels[axis])
        .filter((v): v is string => Boolean(v && v.trim()));
    if (!parts.length) return undefined;
    return `Direction axes: ${parts.join(', ')}.`;
}

function composeModifyPrompt(request: RenderTaskRequest, referenceNames?: string[]): ComposedRenderTaskPrompt {
    const subject = referenceNames?.length ? ` on the ${referenceNames.join(', ')}` : '';
    const change = request.prompt?.trim() || 'the requested change';
    return {
        prompt: joinParts([`Apply only this change${subject}: ${change}`, MODIFY_PRESERVATION]),
        negativePrompt: MODIFY_NEGATIVE,
    };
}

function composeInstantRenderPrompt(request: RenderTaskRequest): ComposedRenderTaskPrompt {
    const scene = request.prompt?.trim() || 'the referenced product';
    const sections = INSTANT_RENDER_SECTIONS.map(({ label, text }) => `${label}: ${text(scene)}`);
    return {
        prompt: joinParts([...sections, INSTANT_RENDER_PRESERVATION]),
        negativePrompt: INSTANT_RENDER_NEGATIVE,
    };
}

function composeFormVariatePrompt(request: RenderTaskRequest): ComposedRenderTaskPrompt {
    const direction = request.formDirection;
    const phrasing = getFormDirectionPhrasing(direction?.preset ?? 'balanced');
    const magnitude = formatMagnitude(direction?.magnitude ?? 0.5);
    return {
        prompt: joinParts([
            `Create a controlled edit of this exact product at a bounded strength of ${magnitude}: ${phrasing}.`,
            formatAxisLabels(direction?.axisLabels),
            FORM_IDENTITY_CONSTRAINT,
        ]),
        negativePrompt: FORM_NEGATIVE,
    };
}

function composeColorVariatePrompt(request: RenderTaskRequest): ComposedRenderTaskPrompt {
    const palette = request.palette;
    const swatches = palette?.swatches ?? [];
    const paletteName = palette?.name ? ` (\u201c${palette.name}\u201d)` : '';
    return {
        prompt: joinParts([
            `Recolor this product using only the following color palette${paletteName}: ${swatches.join(', ')}. No colors outside this palette may appear on the product.`,
            COLOR_PRESERVATION,
        ]),
        negativePrompt: COLOR_NEGATIVE,
    };
}

function composeNewViewPrompt(request: RenderTaskRequest): ComposedRenderTaskPrompt {
    const view = request.targetView ?? 'the requested view';
    return {
        prompt: joinParts([`Render the ${view} of this exact product.`, NEW_VIEW_PRESERVATION]),
        negativePrompt: NEW_VIEW_NEGATIVE,
    };
}

function composeAnimatePrompt(request: RenderTaskRequest): ComposedRenderTaskPrompt {
    const motion = request.prompt?.trim() || 'the requested temporal progression';
    return {
        prompt: joinParts([`Over time: ${motion}`, ANIMATE_APPEARANCE_PIN]),
        negativePrompt: ANIMATE_NEGATIVE,
    };
}

/**
 * Build the backend prompt pair for one render task (FR-005..FR-011).
 * `referenceNames` are the resolved @-mention names (R7) — chips stay client-side.
 * `extract` returns an empty pair: extraction is analysis, not diffusion.
 */
export function composeRenderTaskPrompt(
    request: RenderTaskRequest,
    referenceNames?: string[],
): ComposedRenderTaskPrompt {
    switch (request.kind) {
        case 'modify':
            return composeModifyPrompt(request, referenceNames);
        case 'instant-render':
            return composeInstantRenderPrompt(request);
        case 'form-variate':
            return composeFormVariatePrompt(request);
        case 'color-variate':
            return composeColorVariatePrompt(request);
        case 'new-view':
            return composeNewViewPrompt(request);
        case 'animate':
            return composeAnimatePrompt(request);
        case 'extract':
            return { prompt: '' };
    }
}
