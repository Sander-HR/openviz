/**
 * Feature 006 (OpenViz Workbench UI) — client-only state shapes.
 * Source of truth: specs/006-openviz-workbench-ui/data-model.md
 */

// FR-015 — canvas theme preference (per-user, localStorage; not scene data)
export type CanvasTheme = 'light' | 'dark'; // default 'light'

// FR-016 — Smart Dropper absorbed attributes (exactly one per capture)
export type AbsorbedAttributeType = 'style' | 'color' | 'environment';

export interface AbsorbedAttribute {
    id: string;
    type: AbsorbedAttributeType;
    /** Selected image node the attribute was captured from. */
    sourceNodeId: string;
    /** Ordered hex list — present only when `type === 'color'`. */
    palette?: string[];
    /** Epoch ms. */
    capturedAt: number;
}

// FR-010 — export modal options (transient; 2k = 2048px, 4k = 3840px longest edge)
export type ExportFormat = 'jpeg' | 'png';
export type ExportScaling = 'original' | '2k' | '4k';

export interface ExportOptions {
    /** Selected assets; empty → Export disabled with reason. */
    assetIds: string[];
    format: ExportFormat; // default 'png'
    /** 0–100, applies to jpeg only. */
    quality: number;
    scaling: ExportScaling; // default 'original'
}

// US5 — new node-type settings (data-model.md "WorkbenchNode (extended)")
export type ViewName =
    | 'Front'
    | 'Front Right 3/4 view'
    | 'Front Left 3/4 view'
    | 'Bottom Front Left 3/4 view'
    | 'Bottom Front Right 3/4 view'
    | 'Left'
    | 'Bottom Rear Left 3/4 view'
    | 'Rear Left 3/4 view'
    | 'Rear Right 3/4 view'
    | 'Top'
    | 'Rear'
    | 'Right'
    | 'Bottom'
    | 'Bottom Rear Right 3/4 view';

export const VIEW_NAMES: readonly ViewName[] = [
    'Front',
    'Front Right 3/4 view',
    'Front Left 3/4 view',
    'Bottom Front Left 3/4 view',
    'Bottom Front Right 3/4 view',
    'Left',
    'Bottom Rear Left 3/4 view',
    'Rear Left 3/4 view',
    'Rear Right 3/4 view',
    'Top',
    'Rear',
    'Right',
    'Bottom',
    'Bottom Rear Right 3/4 view',
] as const;

export type VaryMode = 'form' | 'color' | 'both';
export type BackgroundHandling = 'transparent' | 'keep';
