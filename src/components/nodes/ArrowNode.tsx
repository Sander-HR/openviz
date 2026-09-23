import React, { useMemo, useRef } from 'react';
import { NodeResizer } from '@xyflow/react';

import { ArrowWorkbenchNode } from '@/types';
import {
    buildArrowheadPath,
    buildArrowPath,
    clampPointToBox,
} from '@/services/workbench/arrowGeometry';

interface ArrowNodeData extends ArrowWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
    onTransientDataChange?: (nodeId: string, data: Record<string, unknown>) => void;
    onGestureStart?: (nodeId: string, kind: 'move' | 'resize' | 'arrow-handle') => void;
    onGestureEnd?: (cancelled?: boolean) => void;
}

interface ArrowNodeProps {
    id: string;
    data: ArrowNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

export const ArrowNode: React.FC<ArrowNodeProps> = ({ id, data, selected, width, height }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const nodeWidth = Number.isFinite(width) && (width as number) > 0 ? (width as number) : 220;
    const nodeHeight = Number.isFinite(height) && (height as number) > 0 ? (height as number) : 140;
    const strokeColor = data.data?.strokeColor ?? '#111827';
    const strokeWidth = Number.isFinite(data.data?.strokeWidth) ? Math.max(1, data.data.strokeWidth) : 2;
    const geometry = useMemo(() => {
        const start = clampPointToBox(data.data?.start ?? { x: 12, y: nodeHeight - 12 }, nodeWidth, nodeHeight);
        const end = clampPointToBox(data.data?.end ?? { x: nodeWidth - 16, y: 16 }, nodeWidth, nodeHeight);
        const control = clampPointToBox(
            data.data?.control ?? { x: nodeWidth / 2, y: nodeHeight / 2 },
            nodeWidth,
            nodeHeight
        );
        return { start, end, control };
    }, [data.data, nodeHeight, nodeWidth]);

    const updatePointDrag = (point: 'start' | 'end' | 'control', event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const pointerId = event.pointerId;
        event.currentTarget.setPointerCapture(pointerId);
        data.onGestureStart?.(id, 'arrow-handle');

        const onPointerMove = (moveEvent: PointerEvent) => {
            const container = containerRef.current;
            if (!container) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const nextPoint = clampPointToBox(
                {
                    x: moveEvent.clientX - rect.left,
                    y: moveEvent.clientY - rect.top,
                },
                nodeWidth,
                nodeHeight
            );

            const updateData = data.onTransientDataChange ?? data.onDataChange;
            updateData?.(id, {
                [point]: nextPoint,
            });
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
            data.onGestureEnd?.(false);
        };
        const onPointerCancel = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
            data.onGestureEnd?.(true);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
    };

    return (
        <div ref={containerRef} className="relative h-full w-full rounded-lg border border-transparent bg-transparent">
            <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${nodeWidth} ${nodeHeight}`} role="img" aria-label="Arrow node">
                <path
                    d={buildArrowPath(geometry.start, geometry.control, geometry.end)}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                <path
                    d={buildArrowheadPath(geometry.end)}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {selected && (
                <>
                    <div
                        className="nodrag absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-white bg-blue-500 shadow"
                        style={{ left: geometry.start.x, top: geometry.start.y }}
                        onPointerDown={(event) => updatePointDrag('start', event)}
                    />
                    <div
                        className="nodrag absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-white bg-blue-500 shadow"
                        style={{ left: geometry.end.x, top: geometry.end.y }}
                        onPointerDown={(event) => updatePointDrag('end', event)}
                    />
                    <div
                        className="nodrag absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-white bg-amber-400 shadow"
                        style={{ left: geometry.control.x, top: geometry.control.y }}
                        onPointerDown={(event) => updatePointDrag('control', event)}
                    />
                </>
            )}

            <NodeResizer
                isVisible={selected}
                minWidth={80}
                minHeight={60}
                color="#ffffff"
                handleStyle={{
                    width: 12,
                    height: 12,
                    backgroundColor: '#ffffff',
                    borderColor: '#6366f1',
                    borderWidth: '2px',
                    borderRadius: 3,
                }}
                onResizeEnd={(_event, resizeParams) => {
                    const newWidth = Number.isFinite(resizeParams.width) ? resizeParams.width : nodeWidth;
                    const newHeight = Number.isFinite(resizeParams.height) ? resizeParams.height : nodeHeight;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;

                    if (newWidth > 0 && newHeight > 0) {
                        data.onResizeEnd?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
            />
        </div>
    );
};
