import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { useReactFlow, useViewport, type Viewport } from '@xyflow/react';
import type { NodeLockState } from '@/types';
import { useWorkbenchGraph } from './useWorkbenchGraph';
import { useWorkbenchSelectionSync } from './useWorkbenchSelectionSync';
import { getCenteredWorkbenchViewport, getWorkbenchViewport, saveWorkbenchViewport } from './workbenchViewportPersistence';
import type { useWorkbench } from './useWorkbench';

interface WorkbenchCanvasProjectionOptions {
    currentProjectId: string | null;
    sceneHydrated: boolean;
    flowWrapperRef: RefObject<HTMLDivElement | null>;
    draggingNodeIdsRef: MutableRefObject<Set<string>>;
    workbench: ReturnType<typeof useWorkbench>;
    nodeLocks: Record<string, NodeLockState>;
    isTransitioningToStudio: boolean;
}

export function useWorkbenchCanvasProjection({
    currentProjectId,
    sceneHydrated,
    flowWrapperRef,
    draggingNodeIdsRef,
    workbench,
    nodeLocks,
    isTransitioningToStudio,
}: WorkbenchCanvasProjectionOptions) {
    const { setViewport } = useReactFlow();
    const viewport = useViewport();
    const viewportInitializedForProjectRef = useRef<string | null>(null);
    const latestViewportRef = useRef<Viewport>(viewport);
    const { state, handlers, gesture, actions } = workbench;
    const { nodes, edges } = useWorkbenchGraph({
        workbenchNodes: state.workbenchNodes,
        connections: state.connections,
        removeConnection: handlers.removeConnection,
        nodeLocks,
        isTransitioningToStudio,
        handleSourceClick: handlers.handleSourceClick,
        handleResize: handlers.handleResize,
        handleResizeEnd: handlers.handleResizeEnd,
        handleTransientDataChange: handlers.handleTransientDataChange,
        handleGestureStart: handlers.handleGestureStart,
        handleGestureEnd: handlers.handleGestureEnd,
        handleDataChange: handlers.handleDataChange,
    });
    const [flowNodes, setFlowNodes] = useState(nodes);

    useEffect(() => {
        setFlowNodes((currentNodes) => {
            const draggingNodeIds = draggingNodeIdsRef.current;
            if (draggingNodeIds.size > 0) return currentNodes;

            const currentById = new Map(currentNodes.map((node) => [node.id, node]));
            let changed = currentNodes.length !== nodes.length;
            const nextNodes = nodes.map((node) => {
                const currentNode = currentById.get(node.id);
                if (!currentNode) {
                    changed = true;
                    return node;
                }

                const position = draggingNodeIds.has(node.id) ? currentNode.position : node.position;
                const selected = currentNode.selected;
                const positionChanged = currentNode.position.x !== position.x || currentNode.position.y !== position.y;
                const selectionChanged = selected !== undefined && selected !== node.selected;
                const externalNodeChanged = currentNode.type !== node.type
                    || currentNode.data !== node.data
                    || currentNode.style !== node.style
                    || currentNode.width !== node.width
                    || currentNode.height !== node.height
                    || currentNode.selectable !== node.selectable
                    || currentNode.draggable !== node.draggable;

                if (!positionChanged && !selectionChanged && !externalNodeChanged) return currentNode;
                changed = true;
                return { ...node, position, ...(selected !== undefined ? { selected } : {}) };
            });

            return changed ? nextNodes : currentNodes;
        });
    }, [draggingNodeIdsRef, nodes]);

    const { onSelectionChange, setSelection } = useWorkbenchSelectionSync({ setNodes: setFlowNodes });

    useEffect(() => {
        if (viewportInitializedForProjectRef.current !== currentProjectId) viewportInitializedForProjectRef.current = null;
    }, [currentProjectId]);

    useEffect(() => {
        if (!currentProjectId || !sceneHydrated || viewportInitializedForProjectRef.current === currentProjectId) return;
        const container = flowWrapperRef.current;
        if (!container) return;

        const savedViewport = getWorkbenchViewport(currentProjectId);
        const initialViewport = savedViewport ?? getCenteredWorkbenchViewport(
            nodes.map((node) => ({
                position: node.position,
                width: node.measured?.width ?? node.width,
                height: node.measured?.height ?? node.height,
            })),
            container.clientWidth,
            container.clientHeight,
        );
        latestViewportRef.current = initialViewport;
        setViewport(initialViewport, { duration: 0 });
        viewportInitializedForProjectRef.current = currentProjectId;
    }, [currentProjectId, flowWrapperRef, nodes, sceneHydrated, setViewport]);

    useEffect(() => {
        latestViewportRef.current = viewport;
    }, [viewport]);

    useEffect(() => {
        const persistViewport = () => saveWorkbenchViewport(currentProjectId, latestViewportRef.current);
        window.addEventListener('pagehide', persistViewport);
        return () => {
            persistViewport();
            window.removeEventListener('pagehide', persistViewport);
        };
    }, [currentProjectId]);

    const handleViewportMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, nextViewport: Viewport) => {
        latestViewportRef.current = nextViewport;
        if (viewportInitializedForProjectRef.current === currentProjectId) {
            saveWorkbenchViewport(currentProjectId, nextViewport);
        }
    }, [currentProjectId]);

    return {
        nodes,
        edges,
        flowNodes,
        setFlowNodes,
        viewport,
        onSelectionChange,
        setSelection,
        handleViewportMoveEnd,
        actions,
        gesture,
        state,
        handlers,
    };
}
