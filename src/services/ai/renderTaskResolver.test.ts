/**
 * Feature 012 — render task resolver (T002).
 *
 * Per-kind mapping to `ResolvedRenderParameters`: workflow routing (FR-020),
 * aspect-ratio → multiple-of-16 dims (R5), fidelity→strength monotonic map
 * (FR-012), form magnitude→bounded strength band (FR-015), duration→frames/fps
 * (R1), seed uniqueness within a batch (FR-014), locked-seed ⇒ single output,
 * and `benchmarkStatus` provenance flag (FR-021).
 */

import { describe, expect, it } from 'vitest';
import type { RenderTaskRequest, VariationCount } from '@/types/renderTask.types';
import { resolveRenderTask } from './renderTaskResolver';

const ALL_KINDS: RenderTaskRequest['kind'][] = [
    'modify',
    'instant-render',
    'form-variate',
    'color-variate',
    'new-view',
    'animate',
    'extract',
];

/** Per-kind defaults so `baseRequest` yields a valid request for any kind. */
const KIND_DEFAULTS: Record<RenderTaskRequest['kind'], Partial<RenderTaskRequest>> = {
    modify: {},
    'instant-render': { aspectRatio: '1:1' },
    'form-variate': { variationCount: 2, formDirection: { preset: 'balanced', magnitude: 0.5 } },
    'color-variate': { variationCount: 2, palette: { swatches: ['#111111'] } },
    'new-view': { targetView: 'Rear' },
    animate: { duration: '2s' },
    extract: { extractKind: 'color', sampleBy: 'region' },
};

function baseRequest(overrides: Partial<RenderTaskRequest> = {}): RenderTaskRequest {
    const kind = overrides.kind ?? 'modify';
    // Per-kind defaults apply only to keys the caller did not pass explicitly, so an
    // explicit `undefined` (used by the validation tests) still clobbers the default.
    const base: Partial<RenderTaskRequest> = { prompt: 'make the lid matte black', referenceImageId: 'img-1' };
    for (const [key, value] of Object.entries(KIND_DEFAULTS[kind])) {
        if (!(key in overrides)) {
            (base as Record<string, unknown>)[key] = value;
        }
    }
    return { ...base, ...overrides, kind } as RenderTaskRequest;
}

describe('resolveRenderTask — workflow routing (FR-020)', () => {
    it.each([
        ['modify', 'edit'],
        ['form-variate', 'edit'],
        ['color-variate', 'edit'],
        ['new-view', 'edit'],
        ['instant-render', 'reference'],
        ['animate', 'video'],
        ['extract', 'extract'],
    ] as const)('routes %s to the %s workflow', (kind, expectedWorkflow) => {
        const resolved = resolveRenderTask(baseRequest({ kind }));
        expect(resolved.workflow).toBe(expectedWorkflow);
    });
});

describe('resolveRenderTask — aspect ratio → dims (R5)', () => {
    it.each([
        ['1:1', 1024, 1024],
        ['4:3', 1152, 864],
        ['3:4', 864, 1152],
        ['16:9', 1280, 720],
        ['9:16', 720, 1280],
        ['3:2', 1216, 816],
        ['2:3', 816, 1216],
    ] as const)('instant-render %s resolves to %i×%i (multiples of 16)', (ratio, width, height) => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'instant-render', prompt: 'a bottle', aspectRatio: ratio }));
        expect(resolved.width).toBe(width);
        expect(resolved.height).toBe(height);
        expect(width % 16).toBe(0);
        expect(height % 16).toBe(0);
    });

    it('treats a user-chosen ratio on an edit task as an explicit dims override', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'modify', aspectRatio: '4:3' }));
        expect(resolved.width).toBe(1152);
        expect(resolved.height).toBe(864);
    });

    it('carries NO width/height for edit tasks without a ratio (source image applies downstream)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'modify' }));
        expect(resolved.width).toBeUndefined();
        expect(resolved.height).toBeUndefined();
    });

    it('carries NO width/height for new-view tasks without a ratio', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'new-view', targetView: 'Rear' }));
        expect(resolved.width).toBeUndefined();
        expect(resolved.height).toBeUndefined();
    });

    it('leaves width/height unset for video (model-family preset applies downstream)', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'animate', prompt: 'orbit shot', duration: '2s' }));
        expect(resolved.width).toBeUndefined();
        expect(resolved.height).toBeUndefined();
    });
});

describe('resolveRenderTask — fidelity → strength (FR-012)', () => {
    const SAMPLES = [0, 0.05, 0.1, 0.25, 0.4, 0.5, 0.65, 0.8, 0.9, 1];

    it('maps fidelity monotonically: higher fidelity ⇒ lower-or-equal strength', () => {
        const strengths = SAMPLES.map(
            (fidelity) => resolveRenderTask(baseRequest({ referenceFidelity: fidelity })).strength!,
        );
        for (let i = 1; i < strengths.length; i += 1) {
            expect(strengths[i]).toBeLessThanOrEqual(strengths[i - 1]);
        }
    });

    it('maps lower fidelity to strictly higher strength across sampled values', () => {
        for (let i = 0; i < SAMPLES.length - 1; i += 1) {
            const lowFidelityStrength = resolveRenderTask(baseRequest({ referenceFidelity: SAMPLES[i] })).strength!;
            const highFidelityStrength = resolveRenderTask(
                baseRequest({ referenceFidelity: SAMPLES[i + 1] }),
            ).strength!;
            expect(lowFidelityStrength).toBeGreaterThan(highFidelityStrength);
        }
    });

    it('keeps strength within [0, 1]', () => {
        for (const fidelity of SAMPLES) {
            const strength = resolveRenderTask(baseRequest({ referenceFidelity: fidelity })).strength;
            expect(strength).toBeGreaterThanOrEqual(0);
            expect(strength).toBeLessThanOrEqual(1);
        }
    });

    it('clamps out-of-range fidelity into [0, 1] strength', () => {
        expect(resolveRenderTask(baseRequest({ referenceFidelity: -0.5 })).strength).toBe(0.85);
        expect(resolveRenderTask(baseRequest({ referenceFidelity: 1.5 })).strength).toBe(0);
    });

    it('defaults to strong source preservation (low strength) when fidelity is unspecified', () => {
        const strength = resolveRenderTask(baseRequest()).strength;
        expect(strength).toBeGreaterThanOrEqual(0);
        expect(strength).toBeLessThan(0.15);
    });

    it('applies the same monotonic fidelity map to color-variate edit strength', () => {
        const low = resolveRenderTask(
            baseRequest({ kind: 'color-variate', variationCount: 2, referenceFidelity: 0.3 }),
        ).strength!;
        const high = resolveRenderTask(
            baseRequest({ kind: 'color-variate', variationCount: 2, referenceFidelity: 0.8 }),
        ).strength!;
        expect(low).toBeGreaterThan(high);
    });
});

describe('resolveRenderTask — seeds (FR-014, R6)', () => {
    it.each([1, 2, 3, 4] as const)('produces exactly %i unique seeds for a variation batch', (count) => {
        let next = 1000;
        const resolved = resolveRenderTask(
            baseRequest({ kind: 'form-variate', variationCount: count }),
            { randomSeedGenerator: () => (next += 7919) },
        );
        expect(resolved.seeds).toHaveLength(count);
        expect(new Set(resolved.seeds).size).toBe(count);
    });

    it('uses a single seed for non-variation kinds', () => {
        const resolved = resolveRenderTask(baseRequest());
        expect(resolved.seeds).toHaveLength(1);
    });

    it('locked seed ⇒ exactly one output with that exact seed', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'modify', seed: 42 }));
        expect(resolved.seeds).toEqual([42]);
    });

    it('rejects a locked seed combined with a multi-output batch (R6)', () => {
        expect(() => resolveRenderTask(baseRequest({ kind: 'form-variate', variationCount: 4, seed: 7 }))).toThrow(/seed/i);
    });

    it('generates unique seeds with real randomness across several batches', () => {
        for (const count of [1, 2, 3, 4] as const) {
            for (let batch = 0; batch < 5; batch += 1) {
                const resolved = resolveRenderTask(baseRequest({ kind: 'color-variate', variationCount: count }));
                expect(resolved.seeds).toHaveLength(count);
                expect(new Set(resolved.seeds).size).toBe(count);
            }
        }
    });

    it('keeps generated seeds within the 32-bit unsigned range', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'form-variate', variationCount: 4 }));
        for (const seed of resolved.seeds) {
            expect(Number.isInteger(seed)).toBe(true);
            expect(seed).toBeGreaterThanOrEqual(0);
            expect(seed).toBeLessThanOrEqual(4294967295);
        }
    });

    it('uses the default Math.random-based generator when none is injected', () => {
        const resolved = resolveRenderTask(baseRequest({ kind: 'form-variate', variationCount: 4 }));
        expect(resolved.seeds).toHaveLength(4);
        expect(new Set(resolved.seeds).size).toBe(4);
    });
});

describe('resolveRenderTask — benchmarkStatus provenance (FR-021)', () => {
    it.each(ALL_KINDS)('defaults to "starting" for %s', (kind) => {
        expect(resolveRenderTask(baseRequest({ kind })).benchmarkStatus).toBe('starting');
    });

    it('honors an explicit validated override', () => {
        const resolved = resolveRenderTask(baseRequest(), { benchmarkStatus: 'validated' });
        expect(resolved.benchmarkStatus).toBe('validated');
    });
});

describe('resolveRenderTask — validation (data-model.md §Validation rules)', () => {
    it('rejects a missing reference image with a field-level error', () => {
        expect(() => resolveRenderTask({ kind: 'modify', prompt: 'x' } as RenderTaskRequest)).toThrow(/reference/i);
        expect(() => resolveRenderTask(baseRequest({ kind: 'extract', extractKind: 'color', sampleBy: 'region', referenceImageId: undefined }))).toThrow(
            /reference/i,
        );
    });

    it('rejects an empty prompt where required (modify/instant-render/animate)', () => {
        expect(() => resolveRenderTask(baseRequest({ kind: 'modify', prompt: '   ' }))).toThrow(/prompt/i);
        expect(() => resolveRenderTask(baseRequest({ kind: 'animate', duration: '2s', prompt: undefined } as RenderTaskRequest))).toThrow(
            /prompt/i,
        );
    });

    it('allows a missing prompt for color-variate/extract/new-view', () => {
        expect(resolveRenderTask(baseRequest({ kind: 'color-variate', variationCount: 2, palette: { swatches: ['#111111'] } })).prompt).toBeTruthy();
        expect(resolveRenderTask(baseRequest({ kind: 'new-view', targetView: 'Front' })).prompt).toBeTruthy();
    });

    it('rejects a locked seed combined with a multi-output batch (R6)', () => {
        expect(() =>
            resolveRenderTask(baseRequest({ kind: 'form-variate', variationCount: 4, seed: 7 })),
        ).toThrow(/seed/i);
    });

    it('rejects an invalid variation count at the runtime boundary', () => {
        expect(() =>
            resolveRenderTask(
                baseRequest({ kind: 'color-variate', variationCount: 5 as unknown as VariationCount, palette: { swatches: ['#111111'] } }),
            ),
        ).toThrow(/variation/i);
    });

    it('rejects a non-preset aspect ratio at the runtime boundary', () => {
        expect(() => resolveRenderTask(baseRequest({ kind: 'instant-render', prompt: 'x', aspectRatio: '21:9' as '1:1' }))).toThrow(
            /aspect/i,
        );
    });

    it('rejects new-view without a target view (FR-016)', () => {
        expect(() => resolveRenderTask(baseRequest({ kind: 'new-view', targetView: undefined } as RenderTaskRequest))).toThrow(/view/i);
    });
});

describe('resolveRenderTask — purity', () => {
    it('is deterministic for identical inputs with an injected generator', () => {
        const request = baseRequest({ kind: 'form-variate', variationCount: 4 });
        // Deterministic counter-based generator (unique, so the batch resolves).
        const makeGenerator = () => {
            let next = 1;
            return () => (next += 97);
        };
        const first = resolveRenderTask(request, { randomSeedGenerator: makeGenerator() });
        const second = resolveRenderTask(request, { randomSeedGenerator: makeGenerator() });
        expect(second).toEqual(first);
    });

    it('reflects the injected generator in the resolved seeds', () => {
        let calls = 0;
        const resolved = resolveRenderTask(baseRequest({ kind: 'form-variate', variationCount: 2 }), {
            randomSeedGenerator: () => 100 + (calls += 1),
        });
        expect(resolved.seeds).toEqual([101, 102]);
    });
});
