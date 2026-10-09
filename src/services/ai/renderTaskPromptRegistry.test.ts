/**
 * Feature 012 — prompt contract tests for `composeRenderTaskPrompt` (FR-005..FR-011).
 *
 * These tests pin the preservation clauses: any future template edit that
 * drops a clause fails here. Substrings/regexes are intentionally stable so
 * the contract is enforced across refactors (R7).
 */

import { describe, expect, it } from 'vitest';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import { composeRenderTaskPrompt } from './renderTaskPromptRegistry';

const MODIFY_ATTRIBUTES = ['geometry', 'proportions', 'components', 'camera', 'composition', 'lighting', 'background'];

describe('composeRenderTaskPrompt (FR-005..FR-011)', () => {
    describe('modify (FR-005)', () => {
        const request: RenderTaskRequest = { kind: 'modify', prompt: 'Change the lamp shade to matte black' };

        it('describes only the requested change', () => {
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toContain('Change the lamp shade to matte black');
        });

        it('always carries the preservation clause covering every unspecified attribute', () => {
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toMatch(/preserve/i);
            for (const attr of MODIFY_ATTRIBUTES) {
                expect(prompt.toLowerCase()).toContain(attr);
            }
        });

        it('negative prompt constrains against exactly those unauthorized changes', () => {
            const { negativePrompt } = composeRenderTaskPrompt(request);
            expect(negativePrompt).toBeTruthy();
            for (const attr of MODIFY_ATTRIBUTES) {
                expect(negativePrompt!.toLowerCase()).toContain(attr);
            }
        });

        it('names the resolved @-mention references when provided (R7)', () => {
            const withRef: RenderTaskRequest = { ...request, referenceImageId: 'img_1' };
            const { prompt } = composeRenderTaskPrompt(withRef, ['Arc Lamp']);
            expect(prompt).toContain('Arc Lamp');
        });
    });

    describe('instant-render (FR-006)', () => {
        const request: RenderTaskRequest = {
            kind: 'instant-render',
            prompt: 'A ceramic mug on a wooden table in a sunlit kitchen',
        };

        it('structures the scene into subject / environment / composition / camera / lighting / treatment', () => {
            const { prompt } = composeRenderTaskPrompt(request);
            // The user's words become the subject/scene core.
            expect(prompt).toContain('A ceramic mug on a wooden table in a sunlit kitchen');
            for (const section of ['subject', 'environment', 'composition', 'camera', 'lighting', 'treatment']) {
                expect(prompt.toLowerCase()).toContain(section);
            }
        });

        it('instructs preservation of the referenced product\u2019s recognizable geometry and key details', () => {
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toMatch(/preserve/i);
            expect(prompt.toLowerCase()).toMatch(/recognizable geometry/);
            expect(prompt.toLowerCase()).toMatch(/key detail/);
        });

        it('negative guards distortion, missing/duplicated components, malformed surfaces, text/watermarks', () => {
            const { negativePrompt } = composeRenderTaskPrompt(request);
            expect(negativePrompt).toBeTruthy();
            const neg = negativePrompt!.toLowerCase();
            expect(neg).toMatch(/distort/);
            expect(neg).toMatch(/missing|duplicat/);
            expect(neg).toMatch(/malform/);
            expect(neg).toMatch(/text|watermark/);
        });
    });

    describe('form-variate (FR-007, FR-015)', () => {
        const direction = (preset: 'balanced' | 'soft-sculpt' | 'geometric' | 'organic') => ({
            kind: 'form-variate',
            formDirection: { preset, magnitude: 0.6 },
        } as RenderTaskRequest);

        it.each(['balanced', 'soft-sculpt', 'geometric', 'organic'] as const)(
            '%s: controlled-edit phrasing with direction + magnitude + identity constraints',
            (preset) => {
                const { prompt } = composeRenderTaskPrompt(direction(preset));
                // Controlled edit, not free generation.
                expect(prompt.toLowerCase()).toMatch(/control/);
                // Magnitude is expressed as a bounded strength.
                expect(prompt).toMatch(/60\s*%/);
                // Same product concept identity constraint.
                expect(prompt.toLowerCase()).toMatch(/same product|identity/i);
            },
        );

        it('maps each preset to its documented direction phrasing', () => {
            const prompts = (['balanced', 'soft-sculpt', 'geometric', 'organic'] as const).map((preset) =>
                composeRenderTaskPrompt(direction(preset)).prompt.toLowerCase(),
            );
            // Preset-specific phrasings must be distinct from each other.
            expect(new Set(prompts).size).toBe(4);
        });

        it('includes axis labels when present', () => {
            const request: RenderTaskRequest = {
                kind: 'form-variate',
                formDirection: { preset: 'geometric', magnitude: 0.5, axisLabels: { top: 'taller', bottom: 'shorter' } },
            };
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toContain('taller');
            expect(prompt).toContain('shorter');
            expect(prompt.toLowerCase()).toMatch(/axis|direction/i);
        });

        it('negative prompt keeps results within the same product concept', () => {
            const { negativePrompt } = composeRenderTaskPrompt(direction('organic'));
            expect(negativePrompt).toBeTruthy();
            expect(negativePrompt!.toLowerCase()).toMatch(/different product|identity/);
        });
    });

    describe('color-variate (FR-008)', () => {
        const request: RenderTaskRequest = {
            kind: 'color-variate',
            palette: { name: 'Forest', swatches: ['#2d5a3d', '#c9a227'] },
        };

        it('instructs recoloring using only the specified palette and names every swatch', () => {
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt.toLowerCase()).toMatch(/recolor/);
            expect(prompt.toLowerCase()).toMatch(/only/);
            expect(prompt).toContain('#2d5a3d');
            expect(prompt).toContain('#c9a227');
        });

        it('constrains geometry and material preservation', () => {
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toMatch(/preserve/i);
            expect(prompt.toLowerCase()).toMatch(/geometr/);
            expect(prompt.toLowerCase()).toMatch(/material/);
        });

        it('negative excludes colors outside the palette and any geometry change', () => {
            const { negativePrompt } = composeRenderTaskPrompt(request);
            expect(negativePrompt).toBeTruthy();
            const neg = negativePrompt!.toLowerCase();
            expect(neg).toMatch(/outside|other color/);
            expect(neg).toMatch(/geometr/);
        });
    });

    describe('new-view (FR-009)', () => {
        it('names the target viewpoint explicitly', () => {
            const request: RenderTaskRequest = { kind: 'new-view', targetView: 'Rear Right 3/4 view' };
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toContain('Rear Right 3/4 view');
        });

        it('imposes strong geometry/component preservation incl. newly revealed surfaces', () => {
            const request: RenderTaskRequest = { kind: 'new-view', targetView: 'Top' };
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toMatch(/preserve/i);
            expect(prompt.toLowerCase()).toMatch(/geometr/);
            expect(prompt.toLowerCase()).toMatch(/component/);
            expect(prompt.toLowerCase()).toMatch(/newly revealed|revealed/i);
        });

        it('negative guards identity and surface continuity', () => {
            const request: RenderTaskRequest = { kind: 'new-view', targetView: 'Front' };
            const { negativePrompt } = composeRenderTaskPrompt(request);
            expect(negativePrompt).toBeTruthy();
            const neg = negativePrompt!.toLowerCase();
            expect(neg).toMatch(/geometr/);
            expect(neg).toMatch(/component/);
        });
    });

    describe('animate (FR-010)', () => {
        const request: RenderTaskRequest = { kind: 'animate', prompt: 'Slow 360° turntable rotation', duration: '4s' };

        it('describes only what changes over time, without re-describing the appearance', () => {
            const { prompt } = composeRenderTaskPrompt(request);
            expect(prompt).toContain('Slow 360° turntable rotation');
            expect(prompt.toLowerCase()).toMatch(/time|motion|temporal/i);
            // Appearance is pinned to the start frame, not re-described.
            expect(prompt.toLowerCase()).toMatch(/start frame/);
        });

        it('negative suppresses deformation, flicker, duplication and unintended camera movement', () => {
            const { negativePrompt } = composeRenderTaskPrompt(request);
            expect(negativePrompt).toBeTruthy();
            const neg = negativePrompt!.toLowerCase();
            expect(neg).toMatch(/deform/);
            expect(neg).toMatch(/flicker/);
            expect(neg).toMatch(/duplicat/);
            expect(neg).toMatch(/camera/);
        });
    });

    describe('extract (FR-018, FR-020)', () => {
        it('emits no generative prompt — extraction is analysis, not diffusion', () => {
            const result = composeRenderTaskPrompt({ kind: 'extract' });
            expect(result.prompt).toBe('');
            expect(result.negativePrompt).toBeUndefined();
        });
    });

    describe('purity (R7)', () => {
        it('is deterministic and does not mutate the request', () => {
            const request: RenderTaskRequest = { kind: 'modify', prompt: 'x' };
            const frozen = structuredClone(request);
            const first = composeRenderTaskPrompt(request);
            const second = composeRenderTaskPrompt(request);
            expect(second).toEqual(first);
            expect(request).toEqual(frozen);
        });
    });
});
