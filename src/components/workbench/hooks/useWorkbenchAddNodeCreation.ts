import { useCallback } from 'react';
import type { RefObject } from 'react';

import type { WorkbenchNode } from '@/types';
import { resolveCenterFlowPoint } from '@/services/workbench/mediaUploadLogic';
import { planAddNodeCreation, type AddNodeKind } from './workbenchAddNodeCreationLogic';

interface UseWorkbenchAddNodeCreationOptions {
    flowWrapperRef: RefObject<HTMLDivElement | null>;
    screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
    addWorkbenchNode: (node: WorkbenchNode) => void;
    createOneShotNode: (
        node: Extract<WorkbenchNode, { type: 'text' | 'note' }>
    ) => void;
    /** Existing sketch-format flow (useWorkbenchFormatMenu); default 1:1 square. */
    createSketchWithFormat: (width: number, height: number) => void;
    /** Existing desktop image-upload flow (useWorkbenchMediaUpload). */
    onMediaUpload: () => void;
}

/**
 * US3 (T035): executes an add-node menu selection. Resolves the canvas center
 * in flow coordinates, routes through the pure planAddNodeCreation, and calls
 * the matching existing creation path so every pre-existing flow stays
 * reachable from the new menu.
 */
export function useWorkbenchAddNodeCreation({
    flowWrapperRef,
    screenToFlowPosition,
    addWorkbenchNode,
    createOneShotNode,
    createSketchWithFormat,
    onMediaUpload,
}: UseWorkbenchAddNodeCreationOptions) {
    const handleCreateNode = useCallback(
        (kind: AddNodeKind) => {
            const center = resolveCenterFlowPoint(
                flowWrapperRef.current?.getBoundingClientRect(),
                screenToFlowPosition
            );
            const plan = planAddNodeCreation(kind, center);

            switch (plan.kind) {
                case 'sketch':
                    // Reuse the existing sketch-format flow with the default
                    // 1:1 square. Note: createSketchWithFormat also switches to
                    // STUDIO view (pre-existing behavior of that action).
                    createSketchWithFormat(1024, 1024);
                    return;
                case 'media':
                    onMediaUpload();
                    return;
                case 'one-shot':
                    createOneShotNode(plan.node);
                    return;
                case 'add':
                    addWorkbenchNode(plan.node);
                    return;
            }
        },
        [
            addWorkbenchNode,
            createOneShotNode,
            createSketchWithFormat,
            flowWrapperRef,
            onMediaUpload,
            screenToFlowPosition,
        ]
    );

    return { handleCreateNode };
}
