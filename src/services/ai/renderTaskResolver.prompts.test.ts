/**
 * Feature 012 — render task resolver: numeric parameter mapping (T002 split).
 * Form magnitude band (FR-015), duration→frames/fps (R1), advanced defaults (R4)
 * and prompt composition (FR-005..FR-011, R7).
 */

import { describe, expect, it } from 'vitest';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import { resolveRenderTask } from './renderTaskResolver';

function baseRequest(overrides: Partial<RenderTaskRequest> = {}): RenderTaskRequest {
    const kind = overrides.kind ?? 'modify';
    const defaults: Record<string, unknown> = {
        'instant-render': { aspectRatio: '1:1' },
        'form-variate': { variationCount: 2, formDirection: { preset: 'balanced', magnitude: 0.5 } },
        'color-variate': { variationCount: 2, palette: { swatches: ['#111111'] } },
        'new-view': { targetView: 'Rear' },
        animate: { duration: '2s' },
        extract: { extractKind: 'color', sampleBy: 'region' },
    };
    const base: Record<string, unknown> = { prompt: 'make the lid matte black', referenceImageId: 'img-1' };
    for (const [key, value] of Object.entries(defaults[kind] ?? {})) {
        if (!(key in overrides)) base[key] = value;
    }
    return { ...base, ...overrides, kind } as RenderTaskRequest;
}

describe('resolveRenderTask — form magnitude → bounded band (FR-015)', () => {
    function formStrength(magnitude: number): number {
        const strength = resolveRenderTask(
            baseRequest({ kind: 'form-variate', variationCount: 2, formDirection: { preset: 'balanced', magnitude } }),
        ).strength;
        if (strength === null || strength === undefined) throw new Error('expected a resolved edit strength');
        return strength;
    }

    it('increases strength with magnitude (0 < 0.5 < 1)', () => {
        expect(formStrength(0)).toBeLessThan(formStrength(0.5));
        expect(formStrength(0.5)).toBeLessThan(formStrength(1));
    });

    it('stays within the bounded band [0.25, 0.70]', () => {
        for (const magnitude of [0, 0.25, 0.5, 0.75, 1]) {
            const strength = formStrength(magnitude);
            expect(strength).toBeGreaterThanOrEqual(0.25);
            expect(strength).toBeLessThanOrEqual(0.7);
        }
    });

    it('caps below full-redraw: max magnitude strength is strictly < 1', () => {
        expect(formStrength(1)).toBeLessThan(1);
    });

    it('clamps out-of-range magnitude into the band', () => {
        expect(formStrength(-0.5)).toBe(0.25);
        expect(formStrength(1.5)).toBe(0.7);
    });
});

describe('resolveRenderTask — duration → frames/fps (R1)', () => {
    it.each([
        ['2s', 48],
        ['4s', 96],
        ['8s', 192],
    ] as const)('maps %s to %i frames at the documented default fps', (duration, expectedFrames) => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'animate', prompt: 'orbit shot', duration }));
        expect(resolved.workflow).toBe('video');
        expect(resolved.numFrames).toBe(expectedFrames);
        expect(resolved.fps).toBe(24);
    });

    it('sets firstFrame from the reference and lastFrame to null when no end frame is given', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'animate', prompt: 'orbit shot', duration: '2s', referenceImageId: 'img_start' }));
        expect(resolved.firstFrame).toBe('img_start');
        expect(resolved.lastFrame).toBeNull();
    });

    it('sets lastFrame from the end frame when provided', () => {
        const resolved = resolveRenderTask(
            baseRequest({ kind: 'animate', prompt: 'orbit shot', duration: '2s', referenceImageId: 'img_start', endFrameImageId: 'img_end' }),
        );
        expect(resolved.firstFrame).toBe('img_start');
        expect(resolved.lastFrame).toBe('img_end');
    });
});

describe('resolveRenderTask — steps / guidance / resolution defaults (R4)', () => {
    it('uses image defaults (steps 30, guidance 4.0) for image workflows', () => {
        const resolved = resolveRenderTask(baseRequest());
        expect(resolved.steps).toBe(30);
        expect(resolved.guidance).toBe(4);
    });

    it('applies advanced overrides when present', () => {
        const resolved = resolveRenderTask(baseRequest({ advanced: { steps: 50, guidance: 6.5 } }));
        expect(resolved.steps).toBe(50);
        expect(resolved.guidance).toBe(6.5);
    });

    it('uses video defaults (steps 30, guidance 5.0) for animate', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'animate', prompt: 'orbit shot', duration: '2s' }));
        expect(resolved.steps).toBe(30);
        expect(resolved.guidance).toBe(5);
    });

    it('never emits dual-stage video guidance (no extra guidance field on the output)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'animate', prompt: 'orbit shot', duration: '2s' }));
        expect(Object.keys(resolved).sort()).toEqual(
            ['benchmarkStatus', 'firstFrame', 'fps', 'guidance', 'lastFrame', 'negativePrompt', 'numFrames', 'prompt', 'referenceResolution', 'seeds', 'steps', 'workflow'].sort(),
        );
    });

    it('defaults referenceResolution to 1024 and honors advanced overrides', () => {
        expect(resolveRenderTask(baseRequest()).referenceResolution).toBe(1024);
        expect(resolveRenderTask(baseRequest({ advanced: { referenceResolution: 512 } })).referenceResolution).toBe(512);
        expect(resolveRenderTask(baseRequest({ advanced: { referenceResolution: 2048 } })).referenceResolution).toBe(2048);
    });

    it('omits diffusion parameters for the extract workflow (no generative diffusion)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'extract', extractKind: 'color', sampleBy: 'region' }));
        expect(resolved.strength).toBeUndefined();
        expect(resolved.steps).toBeUndefined();
        expect(resolved.guidance).toBeUndefined();
        expect(resolved.referenceResolution).toBeUndefined();
    });
});

describe('resolveRenderTask — prompt composition (FR-005..FR-011, R7)', () => {
    it.each([
        ['modify', 'make the lid matte black'],
        ['instant-render', 'a ceramic pour-over kettle on a pedestal'],
        ['animate', 'slow orbit around the product'],
    ] as const)('embeds the user prompt in the template for %s', (kind, prompt) => {
        expect(resolveRenderTask(baseRequest({ kind, prompt })).prompt).toContain(prompt);
    });

    it('carries the modify preservation clause and negative constraints (FR-005)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'modify' }));
        expect(resolved.prompt.toLowerCase()).toContain('preserve');
        expect(resolved.negativePrompt).toBeTruthy();
    });

    it('names the target view explicitly for new-view (FR-009)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'new-view', targetView: 'Rear' }));
        expect(resolved.prompt).toContain('Rear');
        expect(resolved.negativePrompt).toBeTruthy();
    });

    it('emits an empty prompt pair for extract (analysis, not diffusion)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'extract', extractKind: 'parts', sampleBy: 'hierarchy' }));
        expect(resolved.prompt).toBe('');
        expect(resolved.negativePrompt).toBeNull();
    });

    it.each([
        ['modify'],
        ['instant-render'],
        ['form-variate'],
        ['color-variate'],
        ['new-view'],
        ['animate'],
    ] as const)('sets a non-null negativePrompt for %s', (kind) => {
        expect(resolveRenderTask(baseRequest({ kind })).negativePrompt).toBeTruthy();
    });

    it('resolves @-mention reference names into the prompt (R7)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'modify' }), { referenceNames: ['Arc Lamp'] });
        expect(resolved.prompt).toContain('Arc Lamp');
    });
});
