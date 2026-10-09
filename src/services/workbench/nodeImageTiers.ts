/**
 * Sprint 3 — progressive image tiers for workbench cards.
 *
 * Three tiers exist per uploaded image (generated at upload, Task 1.2):
 * `thumb` (≤512px, stored in the scene doc as `project.thumbnail`),
 * `preview` (≤1024px, `project.previewUrl`) and `full` (the original,
 * kept on the Studio layer). The card paints the thumbnail immediately —
 * it is already in the document — then upgrades as higher tiers decode.
 */

/** Full-res is only worth its bytes above this React Flow zoom level (>200%). */
export const FULL_RES_ZOOM_THRESHOLD = 2.0;

export interface TierAvailability {
    /** ≤512px thumbnail — present on every refs-only node (in-doc). */
    thumb?: string | null;
    /** ≤1024px preview variant; absent on pre-Sprint-1 nodes. */
    preview?: string | null;
    /** Full-resolution source (Studio layer image / original upload). */
    full?: string | null;
}

export interface PickTierInput {
    zoom: number;
    tiers: TierAvailability;
    /** Preview finished decoding in the background. */
    previewLoaded?: boolean;
    /** Full-res finished decoding (only ever requested above the threshold). */
    fullLoaded?: boolean;
}

/**
 * Chooses which tier URL to display right now. A tier is only shown after it
 * has decoded — until then the best LOADED lower tier stays on screen, so a
 * zoom into full-res never blanks the card. Degrades gracefully when tiers
 * are missing (e.g. pre-Sprint-1 render-output nodes with thumb = full).
 */
export function pickTier({ zoom, tiers, previewLoaded = false, fullLoaded = false }: PickTierInput): string | null {
    if (zoom > FULL_RES_ZOOM_THRESHOLD && fullLoaded && tiers.full) return tiers.full;
    if (previewLoaded && tiers.preview) return tiers.preview;
    return tiers.thumb ?? tiers.preview ?? tiers.full ?? null;
}
