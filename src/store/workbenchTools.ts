import type { WorkbenchToolType } from '@/types';

/**
 * Single source of truth for workbench tool semantics (research R1).
 * Consumed by the zustand workbench slice and the keyboard-shortcut hook —
 * never duplicate this knowledge elsewhere.
 */

export const TOOL_SHORTCUT_MAP: Record<string, WorkbenchToolType> = {
    v: 'select',
    d: 'draw',
    e: 'eraser',
    a: 'arrow',
    t: 'text',
    n: 'note',
    m: 'media',
};

/** Tools that stay active across actions until explicitly switched (FR-006). */
export const STICKY_TOOLS: ReadonlySet<WorkbenchToolType> = new Set<WorkbenchToolType>([
    'draw',
    'eraser',
]);

/** Tools that auto-switch back to Select after creating one item (FR-007). */
export const ONE_SHOT_TOOLS: ReadonlySet<WorkbenchToolType> = new Set<WorkbenchToolType>([
    'arrow',
    'text',
    'note',
    'media',
]);

export function isStickyTool(tool: WorkbenchToolType): boolean {
    return STICKY_TOOLS.has(tool);
}

export function isOneShotTool(tool: WorkbenchToolType): boolean {
    return ONE_SHOT_TOOLS.has(tool);
}
