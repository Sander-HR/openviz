import { useEffect, useRef, useState } from 'react';
import { FULL_RES_ZOOM_THRESHOLD, pickTier, type TierAvailability } from '@/services/workbench/nodeImageTiers';

/** Loads an image off-screen and resolves once decoded (browser-cached on success). */
export function preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image tier: ${url}`));
        img.src = url;
    });
}

/** Schedules a low-priority callback after the workbench is interactive. */
export type IdleScheduler = (callback: () => void) => () => void;

const defaultScheduleIdle: IdleScheduler = (callback) => {
    if (typeof window.requestIdleCallback === 'function') {
        const id = window.requestIdleCallback(() => callback());
        return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(callback, 0);
    return () => window.clearTimeout(timer);
};

export interface UseNodeImageTierInput {
    tiers: TierAvailability;
    /** Current React Flow viewport zoom (1 = 100%). */
    zoom: number;
    /** Test seam for the decode promise. */
    preload?: (url: string) => Promise<void>;
    /** Test seam for idle scheduling. */
    scheduleIdle?: IdleScheduler;
}

/**
 * Sprint 3 — progressive tier lifecycle for one image card:
 * - paints the in-doc thumbnail immediately (no extra requests before idle),
 * - after the workbench is interactive, low-priority-loads the preview tier
 *   and swaps it in once decoded,
 * - requests full-res ONLY when zoom crosses {@link FULL_RES_ZOOM_THRESHOLD};
 *   the card keeps its best loaded tier until the full image decodes.
 * Re-visits are free — the browser HTTP cache (immutable headers) serves
 * every tier from disk after first load.
 */
export function useNodeImageTier({ tiers, zoom, preload = preloadImage, scheduleIdle = defaultScheduleIdle }: UseNodeImageTierInput): string | null {
    const [previewLoaded, setPreviewLoaded] = useState(false);
    const [fullLoaded, setFullLoaded] = useState(false);
    const previewScheduledRef = useRef(false);

    // Preview: once per URL, after idle.
    useEffect(() => {
        if (!tiers.preview || previewLoaded || previewScheduledRef.current) return;
        previewScheduledRef.current = true;
        const cancel = scheduleIdle(() => {
            void preload(tiers.preview as string)
                .then(() => setPreviewLoaded(true))
                .catch(() => undefined); // decode failure: stay on the thumbnail
        });
        return cancel;
    }, [tiers.preview, previewLoaded, preload, scheduleIdle]);

    // Full-res: only while above the threshold.
    useEffect(() => {
        if (zoom <= FULL_RES_ZOOM_THRESHOLD || !tiers.full || fullLoaded) return;
        let cancelled = false;
        void preload(tiers.full)
            .then(() => {
                if (!cancelled) setFullLoaded(true);
            })
            .catch(() => undefined); // decode failure: keep the placeholder tier
        return () => {
            cancelled = true;
        };
    }, [zoom, tiers.full, fullLoaded, preload]);

    // New URLs (e.g. a re-render output) reset the lifecycle.
    useEffect(() => {
        setPreviewLoaded(false);
        setFullLoaded(false);
        previewScheduledRef.current = false;
    }, [tiers.thumb, tiers.preview, tiers.full]);

    return pickTier({ zoom, tiers, previewLoaded, fullLoaded });
}
