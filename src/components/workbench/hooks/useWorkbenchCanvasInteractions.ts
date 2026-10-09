import { useCallback, useMemo } from 'react';
import type { useReactFlow } from '@xyflow/react';
import { readClipboardImage } from '@/services/clipboardImage';
import { useWorkbenchOneShotCreation } from './useWorkbenchOneShotCreation';
import { useWorkbenchFreehandEraser } from './useWorkbenchFreehandEraser';
import type { useWorkbench } from './useWorkbench';

interface WorkbenchCanvasInteractionOptions {
    screenToFlowPosition: ReturnType<typeof useReactFlow>['screenToFlowPosition'];
    workbench: ReturnType<typeof useWorkbench>;
    createOneShotNode: ReturnType<typeof useWorkbench>['actions']['createOneShotNode'];
    setSelection: (ids: string[]) => void;
    addImageFile: (file: File) => void;
}

export function useWorkbenchCanvasInteractions({
    screenToFlowPosition,
    workbench,
    createOneShotNode,
    setSelection,
    addImageFile,
}: WorkbenchCanvasInteractionOptions) {
    const { state, menus, handlers, actions } = workbench;
    const { contextMenu } = menus;
    const contextMenuNodes = useMemo(() => {
        if (!contextMenu?.nodeId) return [];
        if (state.selectedNodeIds.includes(contextMenu.nodeId)) {
            return state.workbenchNodes.filter((node) => state.selectedNodeIds.includes(node.id));
        }
        return state.workbenchNodes.filter((node) => node.id === contextMenu.nodeId);
    }, [contextMenu, state.selectedNodeIds, state.workbenchNodes]);

    const handleContextMenuPaste = useCallback(() => {
        if (!contextMenu) return;
        actions.pasteFromClipboard(screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y }));
    }, [actions.pasteFromClipboard, contextMenu, screenToFlowPosition]);

    const handleContextMenuPasteImage = useCallback(async () => {
        const file = await readClipboardImage();
        if (file) addImageFile(file);
    }, [addImageFile]);

    const { handlePaneClickWithTool, handleCanvasMouseDownForArrow, handleCanvasMouseUpForArrow } =
        useWorkbenchOneShotCreation({
            activeWorkbenchTool: state.activeWorkbenchTool,
            screenToFlowPosition,
            createOneShotNode,
            setSelection,
            handlePaneClick: handlers.handlePaneClick,
        });

    const { handleEraseAtPoint, onStrokeFinished, ERASER_SIZE } = useWorkbenchFreehandEraser({
        activeWorkbenchTool: state.activeWorkbenchTool,
        workbenchNodes: state.workbenchNodes,
        freehandColor: state.freehandColor,
        freehandStrokeWidth: state.freehandStrokeWidth,
        removeWorkbenchNode: actions.removeWorkbenchNode,
        addWorkbenchNode: actions.addWorkbenchNode,
        setSelection,
    });

    return {
        contextMenuNodes,
        handleContextMenuPaste,
        handleContextMenuPasteImage,
        handlePaneClickWithTool,
        handleCanvasMouseDownForArrow,
        handleCanvasMouseUpForArrow,
        handleEraseAtPoint,
        onStrokeFinished,
        eraserSize: ERASER_SIZE,
    };
}
