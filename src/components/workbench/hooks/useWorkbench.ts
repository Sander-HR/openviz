import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useReactFlow } from '@xyflow/react';
import type { WorkbenchNode } from '@/types';

import { sketchFormats, useWorkbenchFormatMenu } from './useWorkbenchFormatMenu';
import { useWorkbenchKeyboardShortcuts } from './useWorkbenchKeyboardShortcuts';
import { useWorkbenchStore } from './useWorkbenchStore';
import { useWorkbenchPointerTracking } from './useWorkbenchPointerTracking';
import { useWorkbenchConnectionHandlers } from './useWorkbenchConnectionHandlers';
import { useWorkbenchBlockCreation } from './useWorkbenchBlockCreation';
import { useWorkbenchNodeHandlers } from './useWorkbenchNodeHandlers';
import type { SceneNodeJson } from '@/types/collab.types';
import type { SceneDocCommands } from '@/services/collab/sceneDocCommands';

/**
 * Optional undo/redo routing (collaboration mode): when a shared session is
 * active the toolbar and keyboard shortcuts must drive the Yjs UndoManager
 * instead of the local store history.
 */
export interface UseWorkbenchOptions {
    enabled?: boolean;
    undoAction?: () => void;
    redoAction?: () => void;
    commands?: SceneDocCommands | null;
    /** US3 (ui-translation §6): `I` starts the image upload flow directly. */
    onUploadImage?: () => void;
    /** US3 (ui-translation §6): `/` opens the phone-upload flow. */
    onUploadFromPhone?: () => void;
    /** Called after a studio-capable node is installed in the editor state. */
    onOpenNodeInStudio?: (id: string) => void | Promise<void>;
}

export const useWorkbench = (options?: UseWorkbenchOptions) => {
    const {
        workbenchNodes,
        currentProjectId,
        connections,
        canUndoWorkbench,
        canRedoWorkbench,
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        commitWorkbenchNodePositions,
        beginWorkbenchGesture,
        commitWorkbenchGesture,
        cancelWorkbenchGesture,
        addWorkbenchNode,
        createOneShotNode,
        removeWorkbenchNode,
        duplicateWorkbenchNode,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        openNodeInStudio,
        activeNodeId,
        setActiveNodeId,
        selectedNodeIds,
        setSelectedNodeIds,
        addConnection,
        removeConnection: removeConnectionFromStore,
        createSketchWithFormat,
        isDrawMode,
        activeWorkbenchTool,
        setDrawMode,
        toggleDrawMode,
        setActiveWorkbenchTool,
        freehandColor,
        setFreehandColor,
        freehandStrokeWidth,
        setFreehandStrokeWidth,
        undoLastFreehandNode,
        undoWorkbench,
        redoWorkbench,
    } = useWorkbenchStore();
    const commitNodePositions = useCallback((positions: Array<{ id: string; position: { x: number; y: number } }>) => {
        if (options?.commands) {
            const moves = positions.map(({ id, position }) => ({ id, x: position.x, y: position.y }));
            options.commands.moveNodes(moves);
            for (const move of moves) updateWorkbenchNodeTransient(move.id, { x: move.x, y: move.y });
            return;
        }
        commitWorkbenchNodePositions(positions.map(({ id, position }) => ({
            id,
            x: position.x,
            y: position.y,
        })));
    }, [commitWorkbenchNodePositions, options?.commands, updateWorkbenchNodeTransient]);

    const router = useRouter();

    const openNodeInStudioAndNavigate = useCallback((id: string) => {
        if (options?.onOpenNodeInStudio) {
            void options.onOpenNodeInStudio(id);
            return;
        }

        openNodeInStudio(id);
        if (currentProjectId) {
            router.push(`/projects/${currentProjectId}/studio`);
        }
    }, [currentProjectId, openNodeInStudio, options?.onOpenNodeInStudio, router]);

    const addNode = useCallback((node: WorkbenchNode) => {
        if (options?.commands) options.commands.createNode(node as unknown as SceneNodeJson);
        else addWorkbenchNode(node);
    }, [addWorkbenchNode, options?.commands]);

    const createOneShot = useCallback((node: Parameters<typeof createOneShotNode>[0]) => {
        if (!options?.commands) {
            createOneShotNode(node);
            return;
        }
        if (!options.commands.createNode(node as unknown as SceneNodeJson)) return;
        setActiveNodeId(node.id);
        setSelectedNodeIds([node.id]);
        setActiveWorkbenchTool('select');
    }, [createOneShotNode, options?.commands, setActiveNodeId, setActiveWorkbenchTool, setSelectedNodeIds]);

    const removeNode = useCallback((id?: string) => {
        if (!options?.commands) {
            removeWorkbenchNode(id);
            return;
        }
        removeWorkbenchNode(id);
    }, [options?.commands, removeWorkbenchNode]);

    const { showFormatDropdown, setShowFormatDropdown, dropdownRef, handleFormatSelect } =
        useWorkbenchFormatMenu({ createSketchWithFormat });

    const { createConnection, handleConnect, removeConnection, onConnectStart, onConnectEnd } = useWorkbenchConnectionHandlers({
        workbenchNodes,
        connections,
        commands: options?.commands,
        removeConnectionFromStore,
        addConnection,
    });

    const { basicBlocksMenu, setBasicBlocksMenu, handleBlockSelect } = useWorkbenchBlockCreation({
        workbenchNodes,
        addWorkbenchNode: addNode,
        addConnection: createConnection,
    });

    const {
        contextMenu,
        setContextMenu,
        handleNodesChange,
        handleNodeDoubleClick,
        handleNodeContextMenu,
        handlePaneContextMenu,
        handlePaneClick,
        handleSourceClick,
        handleResize,
        handleResizeEnd,
        handleTransientDataChange,
        handleGestureStart,
        handleGestureEnd,
        handleDataChange,
    } = useWorkbenchNodeHandlers({
        workbenchNodes,
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        beginWorkbenchGesture,
        commitWorkbenchGesture,
        cancelWorkbenchGesture,
        removeWorkbenchNode,
        openNodeInStudio: openNodeInStudioAndNavigate,
        setActiveNodeId,
        setBasicBlocksMenu,
        commands: options?.commands,
    });

    const { screenToFlowPosition, getViewport, setViewport, zoomIn, zoomOut, fitView } = useReactFlow();
    const { getMousePosition } = useWorkbenchPointerTracking();

    const panViewport = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        const viewport = getViewport();
        const step = 80;
        const delta = {
            up: { x: 0, y: step },
            down: { x: 0, y: -step },
            left: { x: step, y: 0 },
            right: { x: -step, y: 0 },
        }[direction];
        setViewport({ x: viewport.x + delta.x, y: viewport.y + delta.y, zoom: viewport.zoom });
    }, [getViewport, setViewport]);

    const zoomTo100 = useCallback(() => {
        const viewport = getViewport();
        setViewport({ x: viewport.x, y: viewport.y, zoom: 1 });
    }, [getViewport, setViewport]);

    const resetView = useCallback(() => {
        setViewport({ x: 0, y: 0, zoom: 1 });
    }, [setViewport]);

    const clearSelection = useCallback(() => {
        setSelectedNodeIds([]);
        setActiveNodeId(null);
        setContextMenu(null);
        setBasicBlocksMenu(null);
    }, [setActiveNodeId, setBasicBlocksMenu, setContextMenu, setSelectedNodeIds]);

    useWorkbenchKeyboardShortcuts({
        enabled: options?.enabled ?? true,
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode: removeNode,
        reorderWorkbenchNode,
        activeNodeId,
        selectedNodeIds,
        screenToFlowPosition,
        getMousePosition,
        setActiveWorkbenchTool,
        undoWorkbench: options?.undoAction ?? undoWorkbench,
        redoWorkbench: options?.redoAction ?? redoWorkbench,
        panViewport,
        zoomIn: () => zoomIn({ duration: 0 }),
        zoomOut: () => zoomOut({ duration: 0 }),
        fitView: () => fitView({ duration: 0 }),
        resetView,
        zoomTo100,
        clearSelection,
        onUploadImage: options?.onUploadImage ?? (() => {}),
        onUploadFromPhone: options?.onUploadFromPhone ?? (() => {}),
    });

    return {
        state: {
            workbenchNodes,
            connections,
            canUndoWorkbench,
            canRedoWorkbench,
            activeNodeId,
            selectedNodeIds,
            isDrawMode,
            activeWorkbenchTool,
            freehandColor,
            freehandStrokeWidth,
        },
        menus: {
            contextMenu,
            setContextMenu,
            showFormatDropdown,
            setShowFormatDropdown,
            dropdownRef,
            basicBlocksMenu,
            sketchFormats,
        },
        handlers: {
            handleFormatSelect,
            handleNodesChange,
            handleConnect,
            removeConnection,
            onConnectStart,
            onConnectEnd,
            handleNodeDoubleClick,
            handleNodeContextMenu,
            handlePaneContextMenu,
            handlePaneClick,
            handleSourceClick,
            handleBlockSelect,
            handleResize,
            handleResizeEnd,
            handleTransientDataChange,
            handleGestureStart,
            handleGestureEnd,
            handleDataChange,
        },
        gesture: {
            updateWorkbenchNodeTransient,
            beginWorkbenchGesture,
            commitWorkbenchGesture,
            cancelWorkbenchGesture,
        },
        actions: {
            reorderWorkbenchNode,
            copyToClipboard,
            pasteFromClipboard,
            duplicateWorkbenchNode,
            removeWorkbenchNode: removeNode,
            setDrawMode,
            toggleDrawMode,
            setActiveWorkbenchTool,
            setActiveNodeId,
            setSelectedNodeIds,
            addWorkbenchNode: addNode,
            createOneShotNode: createOneShot,
            setFreehandColor,
            setFreehandStrokeWidth,
            undoLastFreehandNode,
            undoWorkbench,
            redoWorkbench,
            commitNodePositions,
        },
    };
};
