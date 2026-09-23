import type { ArrowWorkbenchNode } from '@/types';

/**
 * Pure arrow geometry math (research R3). Used by ArrowNode (rendering +
 * handle dragging) and the resize handler (C-5.2 normalization). No React,
 * no DOM — fully unit-testable.
 */

export interface ArrowPoint {
    x: number;
    y: number;
}

/** Quadratic Bézier path from start through control to end. */
export function buildArrowPath(start: ArrowPoint, control: ArrowPoint, end: ArrowPoint): string {
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
}

/** Two-segment arrowhead terminating at the end point (matches v1 rendering). */
export function buildArrowheadPath(end: ArrowPoint): string {
    return `M ${end.x - 12} ${end.y - 4} L ${end.x} ${end.y} L ${end.x - 4} ${end.y + 12}`;
}

/** Clamp a point into the node box [0,width] x [0,height]. */
export function clampPointToBox(point: ArrowPoint, width: number, height: number): ArrowPoint {
    return {
        x: Math.max(0, Math.min(width, point.x)),
        y: Math.max(0, Math.min(height, point.y)),
    };
}

/**
 * Re-scale arrow geometry when its node box is resized (C-5.2): every point
 * moves by the per-axis size ratio so the relative shape is preserved without
 * distortion. Invalid previous sizes leave the geometry untouched.
 */
export function normalizeArrowGeometry(
    data: ArrowWorkbenchNode['data'],
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number
): ArrowWorkbenchNode['data'] {
    const scaleX = Number.isFinite(oldWidth) && oldWidth > 0 ? newWidth / oldWidth : 1;
    const scaleY = Number.isFinite(oldHeight) && oldHeight > 0 ? newHeight / oldHeight : 1;

    return {
        ...data,
        start: { x: data.start.x * scaleX, y: data.start.y * scaleY },
        end: { x: data.end.x * scaleX, y: data.end.y * scaleY },
        control: { x: data.control.x * scaleX, y: data.control.y * scaleY },
    };
}
