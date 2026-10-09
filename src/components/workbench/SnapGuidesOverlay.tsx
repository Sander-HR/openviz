import { memo } from 'react';
import type { FlowViewport } from './CursorOverlay';
import type { SnapGuideLine } from './hooks/nodeSnapLogic';
import type { WorkbenchSnapGuides } from './hooks/useWorkbenchCanvasProjection';

export interface SnapGuidesOverlayProps {
    /** Transient snap guide lines in flow (world) space. */
    guides: WorkbenchSnapGuides;
    /** Current React Flow viewport — converts world → screen coordinates. */
    viewport: FlowViewport;
}

/** Screen-space radius of the × endpoint marks on guides. */
const CROSS_RADIUS = 5;

function toScreenX(value: number, viewport: FlowViewport): number {
    return value * viewport.zoom + viewport.x;
}

function toScreenY(value: number, viewport: FlowViewport): number {
    return value * viewport.zoom + viewport.y;
}

/** Small × (cross) mark centered at a screen-space point. */
function CrossMark({ x, y }: { x: number; y: number }) {
    const d = CROSS_RADIUS;
    return (
        <g className="stroke-viz-accent" strokeWidth={1.5} strokeLinecap="round">
            <line x1={x - d} y1={y - d} x2={x + d} y2={y + d} />
            <line x1={x - d} y1={y + d} x2={x + d} y2={y - d} />
        </g>
    );
}

/** Guide segment: dashed line between two flow-space endpoints, × at both ends. */
function GuideSegment({ guide, viewport }: {
    guide: SnapGuideLine;
    viewport: FlowViewport;
}) {
    const from = guide.from;
    const to = guide.to;
    if (!from || !to) return null;

    const x1 = toScreenX(from.x, viewport);
    const y1 = toScreenY(from.y, viewport);
    const x2 = toScreenX(to.x, viewport);
    const y2 = toScreenY(to.y, viewport);

    return (
        <g>
            <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="stroke-viz-accent"
                strokeWidth={1.5}
                strokeDasharray="4 4"
            />
            <CrossMark x={x1} y={y1} />
            <CrossMark x={x2} y={y2} />
        </g>
    );
}

/**
 * Pointer-events-free overlay that renders the transient alignment guides shown
 * while a node (or group) is dragged or resized, matching the OpenViz workbench
 * canvas behavior. All in-threshold aligned lines are rendered simultaneously (capped
 * per axis by the snap logic). Center guides run from the moved center to the
 * target's center; edge guides span the union of both extents with × marks at
 * each endpoint. All coordinates are converted world → screen:
 * `screen = world × zoom + offset`.
 */
export const SnapGuidesOverlay = memo(function SnapGuidesOverlay({ guides, viewport }: SnapGuidesOverlayProps): JSX.Element {
    if (guides.xGuides.length === 0 && guides.yGuides.length === 0) return <></>;

    return (
        <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-hidden" aria-hidden="true">
            {guides.xGuides.map((guide, index) => (
                <GuideSegment key={`x-${index}`} guide={guide} viewport={viewport} />
            ))}
            {guides.yGuides.map((guide, index) => (
                <GuideSegment key={`y-${index}`} guide={guide} viewport={viewport} />
            ))}
        </svg>
    );
});
