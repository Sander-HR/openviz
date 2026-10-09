import { describe, expect, it } from 'vitest';
import { FULL_RES_ZOOM_THRESHOLD, pickTier } from './nodeImageTiers';

const tiers = { thumb: '/t.webp', preview: '/p.webp', full: '/f.jpg' };

describe('pickTier (Sprint 3 Task 3.2)', () => {
    it('shows the in-doc thumbnail first — no other tier before it is loaded', () => {
        expect(pickTier({ zoom: 1, tiers })).toBe('/t.webp');
        expect(pickTier({ zoom: 0.5, tiers })).toBe('/t.webp');
    });

    it('swaps to the preview once it has decoded (any zoom at or below the threshold)', () => {
        expect(pickTier({ zoom: 1, tiers, previewLoaded: true })).toBe('/p.webp');
        // Boundary: exactly 2.0 is still the preview tier — full-res is > 2.0 only.
        expect(pickTier({ zoom: FULL_RES_ZOOM_THRESHOLD, tiers, previewLoaded: true })).toBe('/p.webp');
    });

    it('requests full-res only above the threshold, keeping the loaded placeholder until it decodes', () => {
        // Above threshold but full not decoded yet → keep the best LOADED tier (no blank flicker).
        expect(pickTier({ zoom: 2.01, tiers, previewLoaded: true })).toBe('/p.webp');
        expect(pickTier({ zoom: 3, tiers, previewLoaded: true, fullLoaded: true })).toBe('/f.jpg');
    });

    it('degrades without errors when tiers are missing (pre-Sprint-1 nodes)', () => {
        // No preview tier at all: thumb until full decodes above threshold.
        expect(pickTier({ zoom: 1, tiers: { thumb: '/t.webp', preview: null, full: '/f.jpg' } })).toBe('/t.webp');
        expect(pickTier({ zoom: 4, tiers: { thumb: '/t.webp', preview: null, full: '/f.jpg' }, fullLoaded: true })).toBe('/f.jpg');
        // Legacy node where thumbnail IS the full source.
        expect(pickTier({ zoom: 1, tiers: { thumb: '/f.jpg', full: '/f.jpg' } })).toBe('/f.jpg');
        expect(pickTier({ zoom: 9, tiers: { thumb: '/f.jpg', full: '/f.jpg' }, fullLoaded: true })).toBe('/f.jpg');
    });

    it('returns null when nothing is available', () => {
        expect(pickTier({ zoom: 1, tiers: {} })).toBeNull();
    });
});
