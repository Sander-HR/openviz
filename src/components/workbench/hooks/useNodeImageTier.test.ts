import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Sprint 3 Task 3.2: the hook owns the tier lifecycle — thumbnail first,
// preview after idle, full-res only above the zoom threshold. The preloader
// is injected so tests control decode timing (jsdom Images never load).
import { FULL_RES_ZOOM_THRESHOLD } from '@/services/workbench/nodeImageTiers';
import { useNodeImageTier, type IdleScheduler } from './useNodeImageTier';

/** Deterministic idle: runs the callback synchronously on schedule. */
const immediateIdle: IdleScheduler = (fn) => { fn(); return () => undefined; };

function makePreload() {
    const started: string[] = [];
    let resolveNext: (() => void) | null = null;
    const preload = vi.fn((url: string) => new Promise<void>((resolve) => {
        started.push(url);
        resolveNext = resolve;
    }));
    return {
        preload,
        started,
        decodeNext: async () => { await act(async () => { resolveNext?.(); resolveNext = null; }); },
    };
}

const tiers = { thumb: '/t.webp', preview: '/p.webp', full: '/f.jpg' };

describe('useNodeImageTier (Sprint 3 Task 3.2)', () => {
    it('paints the in-doc thumbnail first and starts no requests before idle', () => {
        const { preload } = makePreload();
        const { result } = renderHook(() => useNodeImageTier({ tiers, zoom: 1, preload }));
        expect(result.current).toBe('/t.webp');
        expect(preload).not.toHaveBeenCalled();
    });

    it('loads the preview after idle and swaps to it', async () => {
        const fake = makePreload();
        const { result } = renderHook(() => useNodeImageTier({ tiers, zoom: 1, preload: fake.preload, scheduleIdle: immediateIdle }));
        expect(fake.started).toEqual(['/p.webp']);
        expect(result.current).toBe('/t.webp'); // still on the thumbnail until decode
        await fake.decodeNext();
        expect(result.current).toBe('/p.webp');
    });

    it('never starts the preview twice', () => {
        const fake = makePreload();
        renderHook(({ zoom }) => useNodeImageTier({ tiers, zoom, preload: fake.preload, scheduleIdle: immediateIdle }), { initialProps: { zoom: 1 } });
        expect(fake.started).toEqual(['/p.webp']);
    });

    it('requests full-res only when zoom crosses the threshold, and keeps the placeholder until decode', async () => {
        const fake = makePreload();
        const { result, rerender } = renderHook(
            ({ zoom }) => useNodeImageTier({ tiers, zoom, preload: fake.preload }),
            { initialProps: { zoom: 1 } },
        );
        // At or below the threshold: full-res is never touched.
        rerender({ zoom: FULL_RES_ZOOM_THRESHOLD });
        expect(fake.started).not.toContain('/f.jpg');
        // Cross above it: full-res starts, card keeps showing the thumbnail…
        rerender({ zoom: FULL_RES_ZOOM_THRESHOLD + 0.01 });
        expect(fake.started).toContain('/f.jpg');
        expect(result.current).toBe('/t.webp');
        // …until the full image decodes, then it swaps.
        await fake.decodeNext();
        expect(result.current).toBe('/f.jpg');
    });

    it('drops back to the preview when zoom returns below the threshold', async () => {
        const fake = makePreload();
        const { result, rerender } = renderHook(
            ({ zoom }) => useNodeImageTier({ tiers, zoom, preload: fake.preload }),
            { initialProps: { zoom: 3 } },
        );
        await fake.decodeNext(); // full decodes
        expect(result.current).toBe('/f.jpg');
        rerender({ zoom: 1 });
        // Preview was never loaded in this scenario → back to the thumbnail.
        expect(result.current).toBe('/t.webp');
    });

    it('degrades without a preview tier (pre-Sprint-1 nodes)', () => {
        const fake = makePreload();
        const legacy = { thumb: '/f.jpg', full: '/f.jpg' };
        const { result, rerender } = renderHook(
            ({ zoom }) => useNodeImageTier({ tiers: legacy, zoom, preload: fake.preload }),
            { initialProps: { zoom: 1 } },
        );
        expect(result.current).toBe('/f.jpg');
        rerender({ zoom: 5 });
        // thumb === full here; decode and stay put.
        if (fake.started.length > 0) fake.decodeNext();
        expect(result.current).toBe('/f.jpg');
    });
});
