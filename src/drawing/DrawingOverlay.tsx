import React, { RefObject, useCallback, useMemo, useRef, useState } from 'react';

import { useScreenToFlowPoint } from '@/flow/useCoordinateConversion';
import { Point, pointsToPath } from '@/drawing/strokeUtils';

interface DrawingOverlayProps {
    mode: 'draw' | 'erase' | null;
    wrapperRef: RefObject<HTMLElement | null>;
    onStrokeFinished: (points: Point[]) => void;
    onEraseAtPoint?: (point: Point) => void;
    previewColor?: string;
    previewOpacity?: number;
    previewSize?: number;
    eraserSize?: number;
}

const pointsToCenterlinePath = (points: Point[]): string => {
    if (points.length < 2) {
        return '';
    }

    const [firstPoint, ...remainingPoints] = points;
    return `M ${firstPoint.x} ${firstPoint.y} ${remainingPoints.map((point) => `L ${point.x} ${point.y}`).join(' ')}`;
};

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
    mode,
    wrapperRef,
    onStrokeFinished,
    onEraseAtPoint,
    previewColor = '#2563eb',
    previewOpacity = 0.45,
    previewSize = 16,
    eraserSize = 48,
}) => {
    const toFlowPoint = useScreenToFlowPoint(wrapperRef);
    const [isDrawing, setIsDrawing] = useState(false);
    const currentStrokeFlowPointsRef = useRef<Point[]>([]);
    const [currentStrokeScreenPoints, setCurrentStrokeScreenPoints] = useState<Point[]>([]);
    const [eraserStrokeScreenPoints, setEraserStrokeScreenPoints] = useState<Point[]>([]);

    const previewPath = useMemo(
        () => pointsToPath(currentStrokeScreenPoints, { size: previewSize }),
        [currentStrokeScreenPoints, previewSize]
    );
    const eraserPreviewPath = useMemo(
        () => pointsToCenterlinePath(eraserStrokeScreenPoints),
        [eraserStrokeScreenPoints]
    );

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!mode) {
                return;
            }

            const flowPoint = toFlowPoint({
                clientX: event.clientX,
                clientY: event.clientY,
            });

            if (!flowPoint) {
                return;
            }

            const bounds = event.currentTarget.getBoundingClientRect();
            const screenPoint = {
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
            };

            event.currentTarget.setPointerCapture(event.pointerId);
            setIsDrawing(true);
            if (mode === 'erase') {
                onEraseAtPoint?.(flowPoint);
                setEraserStrokeScreenPoints([screenPoint]);
                return;
            }

            currentStrokeFlowPointsRef.current = [flowPoint];
            setCurrentStrokeScreenPoints([screenPoint]);
        },
        [mode, onEraseAtPoint, toFlowPoint]
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!mode) {
                return;
            }

            const bounds = event.currentTarget.getBoundingClientRect();
            const screenPoint = {
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
            };

            if (!isDrawing) {
                return;
            }

            const flowPoint = toFlowPoint({
                clientX: event.clientX,
                clientY: event.clientY,
            });

            if (!flowPoint) {
                return;
            }

            if (mode === 'erase') {
                onEraseAtPoint?.(flowPoint);
                setEraserStrokeScreenPoints((previousPoints) => [...previousPoints, screenPoint]);
                return;
            }

            currentStrokeFlowPointsRef.current = [...currentStrokeFlowPointsRef.current, flowPoint];
            setCurrentStrokeScreenPoints((previousPoints) => [...previousPoints, screenPoint]);
        },
        [isDrawing, mode, onEraseAtPoint, toFlowPoint]
    );

    const finishStroke = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!isDrawing) {
                return;
            }

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }

            setIsDrawing(false);
            const strokePoints = currentStrokeFlowPointsRef.current;
            if (mode === 'draw' && strokePoints.length > 1) {
                onStrokeFinished(strokePoints);
            }

            currentStrokeFlowPointsRef.current = [];
            setCurrentStrokeScreenPoints([]);
            setEraserStrokeScreenPoints([]);
        },
        [isDrawing, mode, onStrokeFinished]
    );

    return (
        <div
            className={`absolute inset-0 z-10 ${mode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerLeave={(event) => {
                finishStroke(event);
            }}
        >
            <svg className="h-full w-full">
                {mode === 'draw' && previewPath ? (
                    <path d={previewPath} fill={previewColor} fillOpacity={previewOpacity} />
                ) : null}
                {mode === 'erase' && eraserPreviewPath ? (
                    <path
                        d={eraserPreviewPath}
                        fill="none"
                        stroke="#111827"
                        strokeOpacity={0.2}
                        strokeWidth={eraserSize}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ) : null}
            </svg>
        </div>
    );
};
