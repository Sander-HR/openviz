import React, { useMemo, useRef } from 'react';
import type { ArrowNodeAttachment, ArrowWorkbenchNode } from '@/types';
import { buildArrowPath, buildArrowheadPath } from '@/services/workbench/arrowGeometry';
import { cn } from '@/components/nodes/nodeUi';
import { FloatingArrowToolbar } from './FloatingArrowToolbar';

type FloatingArrowOverlayProps = {
    arrows: ArrowWorkbenchNode[];
    selectedNodeIds: string[];
    viewport: { x: number; y: number; zoom: number };
    wrapperRef: React.RefObject<HTMLDivElement | null>;
    onDataChange: (nodeId: string, data: Record<string, unknown>) => void;
    onTransientDataChange: (nodeId: string, data: Record<string, unknown>) => void;
    onGestureStart: (nodeId: string, kind: 'arrow-handle') => void;
    onGestureEnd: (cancelled?: boolean) => void;
    onSelect: (nodeId: string) => void;
};

type ScreenPoint = { x: number; y: number };

function closestPointOnNodeEdge(point: ScreenPoint, rect: DOMRect): ScreenPoint {
    const inside = point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    if (!inside) {
        return {
            x: Math.max(rect.left, Math.min(rect.right, point.x)),
            y: Math.max(rect.top, Math.min(rect.bottom, point.y)),
        };
    }

    const distances = [
        { distance: point.x - rect.left, result: { x: rect.left, y: point.y } },
        { distance: rect.right - point.x, result: { x: rect.right, y: point.y } },
        { distance: point.y - rect.top, result: { x: point.x, y: rect.top } },
        { distance: rect.bottom - point.y, result: { x: point.x, y: rect.bottom } },
    ];
    return distances.reduce((closest, candidate) => candidate.distance < closest.distance ? candidate : closest).result;
}

function snapToNodeEdge(point: ScreenPoint, currentArrowId: string): { point: ScreenPoint; attachment?: ArrowNodeAttachment } {
    const SNAP_DISTANCE = 24;
    let closest: { point: ScreenPoint; distance: number; attachment: ArrowNodeAttachment } | null = null;

    document.querySelectorAll<HTMLElement>('.react-flow__node').forEach((nodeElement) => {
        const nodeId = nodeElement.getAttribute('data-id');
        if (!nodeId || nodeId === currentArrowId || nodeId.startsWith('arrow-endpoint:')) return;

        const rect = nodeElement.getBoundingClientRect();
        const candidate = closestPointOnNodeEdge(point, rect);
        const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
        const horizontalOffset = rect.width > 0 ? (candidate.x - rect.left) / rect.width : 0.5;
        const verticalOffset = rect.height > 0 ? (candidate.y - rect.top) / rect.height : 0.5;
        const distances = [
            { side: 'left' as const, distance: Math.abs(candidate.x - rect.left), offset: verticalOffset },
            { side: 'right' as const, distance: Math.abs(candidate.x - rect.right), offset: verticalOffset },
            { side: 'top' as const, distance: Math.abs(candidate.y - rect.top), offset: horizontalOffset },
            { side: 'bottom' as const, distance: Math.abs(candidate.y - rect.bottom), offset: horizontalOffset },
        ];
        const edge = distances.reduce((best, item) => item.distance < best.distance ? item : best);
        if (distance <= SNAP_DISTANCE && (!closest || distance < closest.distance)) {
            closest = {
                point: candidate,
                distance,
                attachment: { nodeId, side: edge.side, offset: Math.max(0, Math.min(1, edge.offset)) },
            };
        }
    });

    const result = closest as { point: ScreenPoint; distance: number; attachment: ArrowNodeAttachment } | null;
    return result ? { point: result.point, attachment: result.attachment } : { point };
}

export const FloatingArrowOverlay: React.FC<FloatingArrowOverlayProps> = ({
    arrows,
    selectedNodeIds,
    viewport,
    wrapperRef,
    onDataChange,
    onTransientDataChange,
    onGestureStart,
    onGestureEnd,
    onSelect,
}) => {
    const activeDrag = useRef<{ nodeId: string; point: 'start' | 'end' | 'control' } | null>(null);
    const visibleArrows = useMemo(() => arrows.filter((arrow) => arrow.data.temporary), [arrows]);

    const screenPoint = (arrow: ArrowWorkbenchNode, point: keyof ArrowWorkbenchNode['data']) => {
        const value = arrow.data[point];
        if (!value || typeof value !== 'object' || !('x' in value) || !('y' in value)) return { x: 0, y: 0 };
        return {
            x: (arrow.x + value.x) * viewport.zoom + viewport.x,
            y: (arrow.y + value.y) * viewport.zoom + viewport.y,
        };
    };

    const startDrag = (arrow: ArrowWorkbenchNode, point: 'start' | 'end' | 'control', event: React.PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        activeDrag.current = { nodeId: arrow.id, point };
        event.currentTarget.setPointerCapture(event.pointerId);
        onGestureStart(arrow.id, 'arrow-handle');

        const move = (moveEvent: PointerEvent) => {
            const wrapper = wrapperRef.current;
            const current = activeDrag.current;
            if (!wrapper || !current) return;
            const rect = wrapper.getBoundingClientRect();
            const snapped = snapToNodeEdge({ x: moveEvent.clientX, y: moveEvent.clientY }, arrow.id);
            const nextPoint = {
                x: (snapped.point.x - rect.left - viewport.x) / viewport.zoom - arrow.x,
                y: (snapped.point.y - rect.top - viewport.y) / viewport.zoom - arrow.y,
            };
            const update = onTransientDataChange ?? onDataChange;
            const attachmentKey = current.point === 'start' ? 'startAttachment' : current.point === 'end' ? 'endAttachment' : undefined;
            update(arrow.id, {
                [current.point]: nextPoint,
                ...(attachmentKey ? { [attachmentKey]: snapped.attachment } : {}),
            });
        };
        const end = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', cancel);
            activeDrag.current = null;
            onGestureEnd(false);
        };
        const cancel = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', cancel);
            activeDrag.current = null;
            onGestureEnd(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', cancel);
    };

    const selectArrow = (arrow: ArrowWorkbenchNode, event: React.PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(arrow.id);
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-10">
            <svg className="absolute inset-0 h-full w-full overflow-visible" aria-label="Floating arrows">
                {visibleArrows.map((arrow) => {
                    const start = screenPoint(arrow, 'start');
                    const end = screenPoint(arrow, 'end');
                    const control = screenPoint(arrow, 'control');
                    const direction = { x: end.x - control.x, y: end.y - control.y };
                    const selected = selectedNodeIds.includes(arrow.id);
                    return (
                        <g key={arrow.id} className={cn(selected && 'drop-shadow-[0_0_2px_#4C4CEF]')}>
                            <path
                                d={buildArrowPath(start, control, end)}
                                fill="none"
                                stroke="transparent"
                                strokeWidth={Math.max(18, arrow.data.strokeWidth + 12)}
                                strokeLinecap="round"
                                pointerEvents="stroke"
                                onPointerDown={(event) => selectArrow(arrow, event)}
                            />
                            <path d={buildArrowPath(start, control, end)} fill="none" stroke={arrow.data.strokeColor} strokeWidth={arrow.data.strokeWidth} strokeLinecap="round" pointerEvents="none" />
                            <path d={buildArrowheadPath(end, direction)} fill="none" stroke={arrow.data.strokeColor} strokeWidth={arrow.data.strokeWidth} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                        </g>
                    );
                })}
            </svg>
            {visibleArrows.flatMap((arrow) =>
                (['start', 'end', 'control'] as const).map((point) => {
                    const position = screenPoint(arrow, point);
                    return (
                        <div
                            key={`${arrow.id}-${point}`}
                            className={cn(
                                'nodrag pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-viz-bg shadow',
                                selectedNodeIds.includes(arrow.id)
                                    ? point === 'control' ? 'bg-viz-muted' : 'bg-viz-accent'
                                    : 'border-transparent bg-transparent shadow-none'
                            )}
                            style={{ left: position.x, top: position.y }}
                            onPointerDown={(event) => {
                                onSelect(arrow.id);
                                startDrag(arrow, point, event);
                            }}
                        />
                    );
                })
            )}
            {visibleArrows.filter((arrow) => selectedNodeIds.includes(arrow.id)).map((arrow) => {
                const start = screenPoint(arrow, 'start');
                const control = screenPoint(arrow, 'control');
                const end = screenPoint(arrow, 'end');
                // Place the toolbar at the visual midpoint of the quadratic
                // curve rather than anchoring it to an endpoint.
                const middle = {
                    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
                    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
                };
                // Move the toolbar away from the curve along its normal. The
                // toolbar is anchored by its bottom edge, so this leaves room
                // for the line, stroke width, and 16px endpoint handles.
                const tangent = {
                    x: end.x - start.x,
                    y: end.y - start.y,
                };
                const tangentLength = Math.hypot(tangent.x, tangent.y) || 1;
                let normal = {
                    x: -tangent.y / tangentLength,
                    y: tangent.x / tangentLength,
                };
                // Prefer the screen-up side so the toolbar grows away from
                // the arrow instead of into it. For a vertical line, use the
                // left side as the deterministic fallback.
                if (normal.y > 0 || (Math.abs(normal.y) < 0.01 && normal.x > 0)) {
                    normal = { x: -normal.x, y: -normal.y };
                }
                const toolbarOffset = Math.max(32, arrow.data.strokeWidth + 24);
                const toolbarPosition = {
                    left: middle.x + normal.x * toolbarOffset,
                    top: middle.y + normal.y * toolbarOffset,
                };
                return (
                    <FloatingArrowToolbar
                        key={`${arrow.id}-toolbar`}
                        color={arrow.data.strokeColor}
                        strokeWidth={arrow.data.strokeWidth}
                        onChange={(patch) => onDataChange(arrow.id, patch)}
                        style={toolbarPosition}
                    />
                );
            })}
        </div>
    );
};