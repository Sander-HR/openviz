import { describe, expect, it } from 'vitest';
import { analyzeRegionColors, buildPixelBuffer, type PixelBuffer } from '@/services/ai/colorAnalysis';
import type { ExtractionRegion } from '@/types/renderTask.types';

/** Solid-color buffer: every pixel is `rgb`. */
function solid(width: number, height: number, rgb: [number, number, number]): PixelBuffer {
    return buildPixelBuffer(width, height, () => ({ r: rgb[0], g: rgb[1], b: rgb[2], a: 255 }));
}

describe('colorAnalysis.analyzeRegionColors — deterministic region sampling (T023, SC-007)', () => {
    it('returns the exact hex of a solid-color region with confidence ~1', () => {
        const buffer = solid(64, 64, [255, 0, 0]);
        const result = analyzeRegionColors(buffer, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
        expect(result.hex).toBe('#ff0000');
        expect(result.confidence).toBeGreaterThan(0.95);
        expect(result.sampledPixels).toBeGreaterThan(0);
    });

    it('reports the dominant cluster when a region is two-colored', () => {
        // Left half blue, right half green; the region covers both halves.
        const buffer = buildPixelBuffer(100, 50, (x) => (x < 50 ? { r: 0, g: 0, b: 255, a: 255 } : { r: 0, g: 255, b: 0, a: 255 }));
        const result = analyzeRegionColors(buffer, { x: 0, y: 0, w: 1, h: 1 });
        // Both clusters are equal-sized; the winner must be one of them and confidence ~0.5.
        expect(['#0000ff', '#00ff00']).toContain(result.hex);
        expect(result.confidence).toBeGreaterThan(0.4);
        expect(result.confidence).toBeLessThan(0.6);
    });

    it('ignores fully transparent pixels when clustering', () => {
        // Opaque red center, transparent border; the region spans the whole image.
        const buffer = buildPixelBuffer(32, 32, (x, y) => {
            const inside = x >= 8 && x < 24 && y >= 8 && y < 24;
            return inside ? { r: 10, g: 20, b: 30, a: 255 } : { r: 0, g: 0, b: 0, a: 0 };
        });
        const result = analyzeRegionColors(buffer, { x: 0, y: 0, w: 1, h: 1 });
        expect(result.hex).toBe('#0a141e');
        expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('returns zero confidence and a null hex when no opaque pixels are sampled', () => {
        const buffer = buildPixelBuffer(16, 16, () => ({ r: 0, g: 0, b: 0, a: 0 }));
        const result = analyzeRegionColors(buffer, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
        expect(result.hex).toBeNull();
        expect(result.confidence).toBe(0);
        expect(result.sampledPixels).toBe(0);
    });

    it('clamps out-of-range region boxes to the image bounds', () => {
        const buffer = solid(32, 32, [0, 128, 255]);
        const result = analyzeRegionColors(buffer, { x: -0.5, y: -0.5, w: 2, h: 2 });
        expect(result.hex).toBe('#0080ff');
        expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('is reproducible: identical buffers yield identical results', () => {
        const region: ExtractionRegion = { x: 0.2, y: 0.3, w: 0.4, h: 0.5 };
        const a = analyzeRegionColors(solid(48, 48, [200, 160, 120]), region);
        const b = analyzeRegionColors(solid(48, 48, [200, 160, 120]), region);
        expect(a).toEqual(b);
    });

    it('reports the dominant cluster hexes in descending share order', () => {
        // 75% white / 25% black checker by columns.
        const buffer = buildPixelBuffer(80, 40, (x) => (x < 60 ? { r: 255, g: 255, b: 255, a: 255 } : { r: 0, g: 0, b: 0, a: 255 }));
        const result = analyzeRegionColors(buffer, { x: 0, y: 0, w: 1, h: 1 });
        expect(result.dominantHexes[0]).toBe('#ffffff');
        expect(result.dominantHexes[1]).toBe('#000000');
    });
});
