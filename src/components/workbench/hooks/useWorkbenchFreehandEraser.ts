import { useCallback } from 'react';

import type { FreehandNode as FreehandWorkbenchNode, WorkbenchNode, WorkbenchToolType } from '@/types';
import { getBoundingBox, pointsToPath, Point } from '@/drawing/strokeUtils';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { generateUUID } from '@/utils/uuid';

const ERASER_SIZE = 48;

interface UseWorkbenchFreehandEraserOptions {
    activeWorkbenchTool: WorkbenchToolType;
    workbenchNodes: WorkbenchNode[];
    freehandColor: string;
    freehandStrokeWidth: number;
    removeWorkbenchNode: (id: string) => void;
    addWorkbenchNode: (node: WorkbenchNode) => void;
    setActiveNodeId: (id: string | null) => void;
    setSelectedNodeIds: (ids: string[]) => void;
}

/**
 * Draw/eraser gesture handlers for the canvas overlay (FR-005, FR-006).
 * Sticky semantics: neither stroke completion nor erase gestures touch the
 * active tool (pinned by T017 store tests).
 */
export function useWorkbenchFreehandEraser({
    activeWorkbenchTool,
    workbenchNodes,
    freehandColor,
    freehandStrokeWidth,
    removeWorkbenchNode,
    addWorkbenchNode,
    setActiveNodeId,
    setSelectedNodeIds,
}: UseWorkbenchFreehandEraserOptions) {
    const handleEraseAtPoint = useCallback(
        (point: Point) => {
            if (activeWorkbenchTool !== 'eraser') {
                return;
            }

            const eraserRadius = ERASER_SIZE / 2;
            const intersectedFreehandNodeIds = workbenchNodes
                .filter((node) => node.type === 'freehand')
                .filter((node) => {
                    const strokePadding = Math.max(2, (node.data.strokeWidth ?? 0) / 2);
                    const minX = node.x - eraserRadius - strokePadding;
                    const minY = node.y - eraserRadius - strokePadding;
                    const maxX = node.x + (node.width ?? 0) + eraserRadius + strokePadding;
                    const maxY = node.y + (node.height ?? 0) + eraserRadius + strokePadding;

                    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
                })
                .map((node) => node.id);

            intersectedFreehandNodeIds.forEach((nodeId) => {
                removeWorkbenchNode(nodeId);
            });
        },
        [activeWorkbenchTool, removeWorkbenchNode, workbenchNodes]
    );

    const onStrokeFinished = useCallback(
        (points: Point[]) => {
            const boundingBox = getBoundingBox(points);
            if (!boundingBox) {
                return;
            }

            const normalizedPoints: Point[] = points.map((point) => ({
                x: point.x - boundingBox.minX,
                y: point.y - boundingBox.minY,
            }));
            const path = pointsToPath(normalizedPoints, { size: freehandStrokeWidth });

            if (!path.trim()) {
                return;
            }

            const width = Math.max(1, boundingBox.width);
            const height = Math.max(1, boundingBox.height);

            const freehandNode: FreehandWorkbenchNode = {
                id: generateUUID(),
                type: 'freehand',
                x: boundingBox.minX,
                y: boundingBox.minY,
                width,
                height,
                data: {
                    path,
                    width,
                    height,
                    color: freehandColor,
                    strokeWidth: freehandStrokeWidth,
                },
            };

            addWorkbenchNode(freehandNode);
            if (activeWorkbenchTool === 'draw') {
                setActiveNodeId(freehandNode.id);
                setSelectedNodeIds([freehandNode.id]);
            }
            requestImmediateSceneSave();
        },
        [activeWorkbenchTool, addWorkbenchNode, freehandColor, freehandStrokeWidth, setActiveNodeId, setSelectedNodeIds]
    );

    return { handleEraseAtPoint, onStrokeFinished, ERASER_SIZE };
}
