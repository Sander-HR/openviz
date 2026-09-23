import { describe, expect, it } from 'vitest';

// T011: pure arrow geometry (C-5.1 path updates, C-5.2 resize without distortion).
// Module under test: src/services/workbench/arrowGeometry.ts (T014 implements it).

describe('buildArrowPath', () => {
    it('produces a quadratic Bézier path from start through control to end', async () => {
        const { buildArrowPath } = await import('./arrowGeometry');
        const d = buildArrowPath({ x: 10, y: 20 }, { x: 50, y: 0 }, { x: 90, y: 30 });
        expect(d).toBe('M 10 20 Q 50 0 90 30');
    });
});

describe('buildArrowheadPath', () => {
    it('produces the two-segment arrowhead ending at the end point', async () => {
        const { buildArrowheadPath } = await import('./arrowGeometry');
        const d = buildArrowheadPath({ x: 90, y: 30 });
        expect(d).toBe('M 78 26 L 90 30 L 86 42');
    });
});

describe('clampPointToBox', () => {
    it('keeps interior points unchanged', async () => {
        const { clampPointToBox } = await import('./arrowGeometry');
        expect(clampPointToBox({ x: 10, y: 20 }, 100, 50)).toEqual({ x: 10, y: 20 });
    });

    it('clamps points outside the box to the edges', async () => {
        const { clampPointToBox } = await import('./arrowGeometry');
        expect(clampPointToBox({ x: -5, y: 999 }, 100, 50)).toEqual({ x: 0, y: 50 });
        expect(clampPointToBox({ x: 400, y: -3 }, 100, 50)).toEqual({ x: 100, y: 0 });
    });
});

describe('normalizeArrowGeometry (C-5.2)', () => {
    const baseData = {
        start: { x: 25, y: 35 },
        end: { x: 75, y: 15 },
        control: { x: 50, y: 10 },
        strokeColor: '#fff',
        strokeWidth: 3,
    };

    it('scales all three points by the size ratio on uniform resize', async () => {
        const { normalizeArrowGeometry } = await import('./arrowGeometry');
        const next = normalizeArrowGeometry(baseData, 100, 100, 200, 200);
        expect(next.start).toEqual({ x: 50, y: 70 });
        expect(next.end).toEqual({ x: 150, y: 30 });
        expect(next.control).toEqual({ x: 100, y: 20 });
    });

    it('applies per-axis ratios on non-uniform resize (no distortion of relative shape)', async () => {
        const { normalizeArrowGeometry } = await import('./arrowGeometry');
        // 100x50 -> 200x100: x doubles, y doubles
        const next = normalizeArrowGeometry(baseData, 100, 50, 200, 100);
        expect(next.start).toEqual({ x: 50, y: 70 });
        // A point at 25% of the width stays at 25% of the new width
        expect(next.start.x / 200).toBeCloseTo(0.25);
    });

    it('preserves non-geometry fields untouched', async () => {
        const { normalizeArrowGeometry } = await import('./arrowGeometry');
        const next = normalizeArrowGeometry(baseData, 100, 100, 150, 100);
        expect(next.strokeColor).toBe('#fff');
        expect(next.strokeWidth).toBe(3);
    });

    it('leaves geometry unchanged when the previous size is invalid', async () => {
        const { normalizeArrowGeometry } = await import('./arrowGeometry');
        const next = normalizeArrowGeometry(baseData, 0, 0, 200, 200);
        expect(next.start).toEqual(baseData.start);
        expect(next.end).toEqual(baseData.end);
        expect(next.control).toEqual(baseData.control);
    });

    it('handles shrinking as well as growing', async () => {
        const { normalizeArrowGeometry } = await import('./arrowGeometry');
        const next = normalizeArrowGeometry(baseData, 200, 200, 100, 100);
        expect(next.start).toEqual({ x: 12.5, y: 17.5 });
    });
});
