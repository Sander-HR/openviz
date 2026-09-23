import { useCallback, useRef } from 'react';

import type { ArrowWorkbenchNode, NoteWorkbenchNode, TextWorkbenchNode, WorkbenchToolType } from '@/types';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { generateUUID } from '@/utils/uuid';

interface UseWorkbenchOneShotCreationOptions {
    activeWorkbenchTool: WorkbenchToolType;
    screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
    createOneShotNode: (node: TextWorkbenchNode | NoteWorkbenchNode | ArrowWorkbenchNode) => void;
    handlePaneClick: () => void;
}

/**
 * One-shot creation handlers for arrow/text/note tools (FR-007, C-4.1–C-4.3).
 * Extracted from the workbench view so the payload-building logic is
 * testable without rendering the canvas (T012); the auto-switch to Select is
 * guaranteed by the atomic createOneShotNode store action (T006).
 */
export function useWorkbenchOneShotCreation({
    activeWorkbenchTool,
    screenToFlowPosition,
    createOneShotNode,
    handlePaneClick,
}: UseWorkbenchOneShotCreationOptions) {
    const arrowDragStartRef = useRef<{ x: number; y: number } | null>(null);

    const isPaneTarget = (target: EventTarget | null) =>
        target instanceof Element && target.closest('.react-flow__pane') !== null;

    const createTextOrNoteNodeAt = useCallback((tool: WorkbenchToolType, clientX: number, clientY: number) => {
        const flowPoint = screenToFlowPosition({ x: clientX, y: clientY });
        if (tool === 'text') {
            const textNode: TextWorkbenchNode = {
                id: generateUUID(),
                type: 'text',
                x: flowPoint.x - 120,
                y: flowPoint.y - 36,
                width: 240,
                height: 72,
                data: {
                    text: '',
                    fontSize: 24,
                    color: '#111827',
                },
            };
            createOneShotNode(textNode);
            return;
        }

        if (tool === 'note') {
            const noteNode: NoteWorkbenchNode = {
                id: generateUUID(),
                type: 'note',
                x: flowPoint.x - 110,
                y: flowPoint.y - 90,
                width: 220,
                height: 180,
                data: {
                    text: '',
                    colorVariant: 'yellow',
                },
            };
            createOneShotNode(noteNode);
        }
    }, [screenToFlowPosition, createOneShotNode]);

    const handlePaneClickWithTool = useCallback(
        (event: React.MouseEvent) => {
            handlePaneClick();
            if (activeWorkbenchTool === 'text' || activeWorkbenchTool === 'note') {
                createTextOrNoteNodeAt(activeWorkbenchTool, event.clientX, event.clientY);
            }
        },
        [activeWorkbenchTool, createTextOrNoteNodeAt, handlePaneClick]
    );

    const handleCanvasMouseDownForArrow = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!isPaneTarget(event.target)) {
                arrowDragStartRef.current = null;
                return;
            }

            if (activeWorkbenchTool !== 'arrow' || event.button !== 0) {
                arrowDragStartRef.current = null;
                return;
            }

            arrowDragStartRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        },
        [activeWorkbenchTool, screenToFlowPosition]
    );

    const handleCanvasMouseUpForArrow = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!isPaneTarget(event.target)) {
                return;
            }

            if (activeWorkbenchTool !== 'arrow' || !arrowDragStartRef.current) {
                return;
            }

            const start = arrowDragStartRef.current;
            const end = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            arrowDragStartRef.current = null;

            const deltaX = end.x - start.x;
            const deltaY = end.y - start.y;
            const distance = Math.hypot(deltaX, deltaY);
            const padding = 20;
            const minWidth = 120;
            const minHeight = 80;
            const width = Math.max(minWidth, Math.abs(deltaX) + padding * 2);
            const height = Math.max(minHeight, Math.abs(deltaY) + padding * 2);
            const x = Math.min(start.x, end.x) - padding;
            const y = Math.min(start.y, end.y) - padding;

            const normalizedStart =
                distance < 8 ? { x: 20, y: height - 20 } : { x: start.x - x, y: start.y - y };
            const normalizedEnd =
                distance < 8 ? { x: width - 20, y: 20 } : { x: end.x - x, y: end.y - y };

            const midX = (normalizedStart.x + normalizedEnd.x) / 2;
            const midY = (normalizedStart.y + normalizedEnd.y) / 2;
            const control = {
                x: midX + (normalizedStart.y - normalizedEnd.y) * 0.18,
                y: midY + (normalizedEnd.x - normalizedStart.x) * 0.18,
            };

            const arrowNode: ArrowWorkbenchNode = {
                id: generateUUID(),
                type: 'arrow',
                x,
                y,
                width,
                height,
                data: {
                    start: normalizedStart,
                    end: normalizedEnd,
                    control,
                    strokeColor: '#111827',
                    strokeWidth: 2,
                },
            };

            createOneShotNode(arrowNode);
            requestImmediateSceneSave();
        },
        [activeWorkbenchTool, screenToFlowPosition, createOneShotNode]
    );

    return {
        handlePaneClickWithTool,
        handleCanvasMouseDownForArrow,
        handleCanvasMouseUpForArrow,
    };
}
