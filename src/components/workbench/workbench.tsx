import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ReactFlow,
    NodeTypes,
    EdgeTypes,
    ReactFlowProvider,
    useReactFlow,
    useViewport,
    SelectionMode,
    OnNodeDrag,
    applyNodeChanges,
    type NodeChange,
    type Viewport,
    useStoreApi,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ImageNode } from '../nodes/ImageNode';
import { VideoNode } from '../nodes/VideoNode';
import { AnimateNode } from '../nodes/AnimateNode';
import { RenderNode } from '../nodes/RenderNode';
import { ModifyNode } from '../nodes/ModifyNode';
import { FreehandNode } from '../nodes/FreehandNode';
import { ArrowNode } from '../nodes/ArrowNode';
import { TextNode } from '../nodes/TextNode';
import { NoteNode } from '../nodes/NoteNode';
import { MediaNode } from '../nodes/MediaNode';
import { VariateNode } from '../nodes/VariateNode';
import { NewViewNode } from '../nodes/NewViewNode';
import { ExtractNode } from '../nodes/ExtractNode';
import { SectionNode } from '../nodes/SectionNode';
import { CustomEdge } from '../nodes/CustomEdge';
import { WorkbenchChrome } from './WorkbenchChrome';
import { useWorkbench } from './hooks/useWorkbench';
import { useWorkbenchCollabSession } from './hooks/useWorkbenchCollabSession';
import { useStore } from '../../store/useStore';
import { useAutoSaveScene } from '../../hooks/useAutoSaveScene';
import { useWorkbenchCenterOnReturn } from './hooks/useWorkbenchCenterOnReturn';
import { useWorkbenchOneShotCreation } from './hooks/useWorkbenchOneShotCreation';
import { useWorkbenchAddNodeCreation } from './hooks/useWorkbenchAddNodeCreation';
import { getFlowModeProps } from './hooks/workbenchModeProps';
import { useWorkbenchFreehandEraser } from './hooks/useWorkbenchFreehandEraser';
import { useWorkbenchMediaUpload } from './hooks/useWorkbenchMediaUpload';
import { useResizeObserverWarningSuppression } from './hooks/useResizeObserverWarningSuppression';
import { useWorkbenchGraph } from './hooks/useWorkbenchGraph';
import { useCollabPresencePublisher } from './hooks/useCollabPresencePublisher';
import { useSceneStream } from './hooks/useSceneStream';
import { CollabStatusChip } from './CollabStatusChip';
import { ComputePopover } from '@/components/product-design/ComputePopover';
import { CursorOverlay } from './CursorOverlay';
import { NodeLockBadges } from './NodeLockBadges';
import { WorkbenchOverlayLayer } from './WorkbenchOverlayLayer';
import { useShallow } from 'zustand/react/shallow';
import { WorkbenchConnectionLine } from '../nodes/WorkbenchConnectionLine';
import { FloatingArrowOverlay } from './FloatingArrowOverlay';
import { WorkbenchCanvasBackground } from './WorkbenchCanvasBackground';
import { useWorkbenchThemeStore } from '../../store/slices/workbenchThemeSlice';
import { DrawingOverlay } from '@/drawing/DrawingOverlay';
import { cn } from '@/lib/utils';
import type { WorkbenchNode } from '@/types';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { WORKBENCH_PAN_MOUSE_BUTTON } from './hooks/workbenchViewportGestures';
import {
    getCenteredWorkbenchViewport,
    getWorkbenchViewport,
    saveWorkbenchViewport,
} from './hooks/workbenchViewportPersistence';
import { readClipboardImage } from '@/services/clipboardImage';
import { startImageCanvasTransition } from '@/services/workbench/imageCanvasTransition';
import { useWorkbenchSelectionSync, type SelectionSyncSetNodes } from './hooks/useWorkbenchSelectionSync';

const nodeTypes: NodeTypes = {
    imageNode: ImageNode,
    videoNode: VideoNode,
    animateNode: AnimateNode,
    renderNode: RenderNode,
    modifyNode: ModifyNode,
    freehandNode: FreehandNode,
    arrowNode: ArrowNode,
    textNode: TextNode,
    noteNode: NoteNode,
    mediaNode: MediaNode,
    variateNode: VariateNode,
    newViewNode: NewViewNode,
    extractNode: ExtractNode,
    sectionNode: SectionNode,
};

const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

const WorkbenchContent: React.FC<{ active: boolean }> = ({ active }) => {
    const flowWrapperRef = useRef<HTMLDivElement>(null);
    const viewportInitializedForProjectRef = useRef<string | null>(null);
    const { setCenter, getNode, zoomIn, zoomOut, fitView, setViewport, screenToFlowPosition } = useReactFlow();
    const reactFlowStore = useStoreApi();
    const setFlowNodes = useCallback<SelectionSyncSetNodes>((payload) => {
        const flowState = reactFlowStore.getState();
        const nextNodes = typeof payload === 'function' ? payload(flowState.nodes) : payload;
        flowState.setNodes(nextNodes);
    }, [reactFlowStore]);
    const getFlowNodes = useCallback(() => reactFlowStore.getState().nodes, [reactFlowStore]);
    const { onSelectionChange, setSelection } = useWorkbenchSelectionSync({
        setNodes: setFlowNodes,
        getNodes: getFlowNodes,
    });
    const router = useRouter();
    const studioTransitionActiveRef = useRef(false);
    const [isTransitioningToStudio, setIsTransitioningToStudio] = useState(false);
    const viewport = useViewport();
    const latestViewportRef = useRef<Viewport>(viewport);
    const {
        viewMode,
        currentProjectId,
        createOneShotNode,
        createSketchWithFormat,
    } = useStore(
        useShallow((state) => ({
            viewMode: state.viewMode,
            currentProjectId: state.currentProjectId,
            createOneShotNode: state.createOneShotNode,
            createSketchWithFormat: state.createSketchWithFormat,
        }))
    );
    const sceneHydrated = useStore((state) => state.sceneHydrated);

    useEffect(() => {
        if (currentProjectId) {
            router.prefetch(`/projects/${currentProjectId}/studio`);
        }
    }, [currentProjectId, router]);

    const openNodeInStudioWithTransition = useCallback(async (nodeId: string) => {
        if (studioTransitionActiveRef.current) return;

        const node = getNode(nodeId);
        const container = flowWrapperRef.current;
        if (!node || !currentProjectId) {
            if (currentProjectId) router.push(`/projects/${currentProjectId}/studio`);
            return;
        }

        // The route and Studio project can switch immediately even if React
        // Flow has not measured the node yet. Measurement is only needed for
        // the optional zoom handoff.
        if (!container) {
            useStore.getState().openNodeInStudio(nodeId);
            router.push(`/projects/${currentProjectId}/studio`);
            return;
        }

        const width = node.measured?.width ?? node.width ?? 0;
        const height = node.measured?.height ?? node.height ?? 0;
        if (width <= 0 || height <= 0) {
            useStore.getState().openNodeInStudio(nodeId);
            router.push(`/projects/${currentProjectId}/studio`);
            return;
        }

        studioTransitionActiveRef.current = true;
        setIsTransitioningToStudio(true);
        const targetZoom = Math.max(
            0.1,
            Math.min(20, Math.min(container.clientWidth / width, container.clientHeight / height))
        );

        useStore.getState().openNodeInStudio(nodeId);
        const workbenchNode = useStore.getState().workbenchNodes.find((candidate) => candidate.id === nodeId);
        if (workbenchNode?.type === 'image' || workbenchNode?.type === 'video') {
            const drawable = document.querySelector(`[data-workbench-drawable="${nodeId}"]`);
            if (drawable instanceof HTMLElement) {
                startImageCanvasTransition(drawable, workbenchNode.project);
            }
        }

        try {
            void setCenter(
                node.position.x + width / 2,
                node.position.y + height / 2,
                { zoom: targetZoom, duration: 350 }
            );
        } finally {
            window.setTimeout(() => router.push(`/projects/${currentProjectId}/studio`), 40);
            window.setTimeout(() => {
                studioTransitionActiveRef.current = false;
                setIsTransitioningToStudio(false);
            }, 400);
        }
    }, [currentProjectId, getNode, router, setCenter]);
    
    useAutoSaveScene(currentProjectId);
    useSceneStream(currentProjectId, active);
    const collabSession = useWorkbenchCollabSession();

    // US3 (T035): media upload flows are declared before useWorkbench so the
    // I / keyboard shortcuts can route into them (ui-translation §6).
    const {
        mediaUploadInputRef,
        isPhoneUploadModalOpen,
        closePhoneUploadModal,
        handleMediaUpload,
        handleMediaUploadFromPhone,
        handlePhoneUploadComplete,
        handleMediaUploadChange,
        addImageFile,
    } = useWorkbenchMediaUpload({
        flowWrapperRef,
        screenToFlowPosition,
        makeOneShotNode: createOneShotNode,
    });

    // Awareness-derived collaboration state (US2): presence chips, remote
    // cursors and soft-lock badges. References only change when the slice
    // re-projects an awareness snapshot.
    const nodeLocks = useStore((state) => state.nodeLocks);
    const remoteCursors = useStore((state) => state.remoteCursors);
    const presenceByUser = useStore((state) => state.presenceByUser);

    // Publish this client's user/cursor/soft-lock set to the room and release
    // local selections of nodes another client has locked (spec FR-015).
    useCollabPresencePublisher({
        provider: collabSession.provider,
        userId: collabSession.userId,
        userName: collabSession.userName,
        containerRef: flowWrapperRef,
        toWorld: screenToFlowPosition,
    });

    useResizeObserverWarningSuppression();

    const {
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
            dropdownRef,
            basicBlocksMenu,
            sketchFormats,
        },
        handlers: {
            handleFormatSelect,
            handleNodesChange,
            handleConnect,
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
            beginWorkbenchGesture,
            commitWorkbenchGesture,
        },
        actions: {
            pasteFromClipboard,
            removeWorkbenchNode,
            setActiveWorkbenchTool,
            addWorkbenchNode,
            setFreehandColor,
            setFreehandStrokeWidth,
            undoWorkbench,
            redoWorkbench,
            commitNodePositions,
        },
    } = useWorkbench({
        enabled: active,
        ...(collabSession.active
            ? { undoAction: collabSession.undo, redoAction: collabSession.redo }
            : {}),
        // US3 (ui-translation §6): I / keyboard shortcuts route into the
        // existing media upload flows.
        onUploadImage: handleMediaUpload,
        onUploadFromPhone: handleMediaUploadFromPhone,
        onOpenNodeInStudio: openNodeInStudioWithTransition,
    });

    // US3 (T035): add-node menu routing — canvas-center creation for every
    // non-legacy kind; sketch/media reuse the existing flows.
    const { handleCreateNode } = useWorkbenchAddNodeCreation({
        flowWrapperRef,
        screenToFlowPosition,
        addWorkbenchNode,
        createOneShotNode,
        createSketchWithFormat,
        onMediaUpload: handleMediaUpload,
    });

    // In collaboration mode the Yjs UndoManager owns history (SC-005): the
    // toolbar and Cmd/Ctrl+Z drive it instead of the local store history.
    const handleUndo = collabSession.active ? collabSession.undo : undoWorkbench;
    const handleRedo = collabSession.active ? collabSession.redo : redoWorkbench;
    const handleCanUndo = collabSession.active ? collabSession.canUndo : canUndoWorkbench;
    const handleCanRedo = collabSession.active ? collabSession.canRedo : canRedoWorkbench;
    useWorkbenchCenterOnReturn({ viewMode, activeNodeId, workbenchNodes, projectId: currentProjectId, setCenter });
    const { nodes, edges } = useWorkbenchGraph({
        workbenchNodes,
        connections,
        nodeLocks,
        isTransitioningToStudio,
        handleSourceClick,
        handleResize,
        handleResizeEnd,
        handleTransientDataChange,
        handleGestureStart,
        handleGestureEnd,
        handleDataChange,
    });

    useEffect(() => {
        if (viewportInitializedForProjectRef.current !== currentProjectId) {
            viewportInitializedForProjectRef.current = null;
        }
    }, [currentProjectId]);

    useEffect(() => {
        if (!currentProjectId || !sceneHydrated || viewportInitializedForProjectRef.current === currentProjectId) {
            return;
        }

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
    }, [currentProjectId, nodes, sceneHydrated, setViewport]);

    useEffect(() => {
        latestViewportRef.current = viewport;
    }, [viewport]);

    useEffect(() => {
        const persistViewport = () => {
            saveWorkbenchViewport(currentProjectId, latestViewportRef.current);
        };

        window.addEventListener('pagehide', persistViewport);
        return () => {
            persistViewport();
            window.removeEventListener('pagehide', persistViewport);
        };
    }, [currentProjectId]);

    const handleViewportMoveEnd = useCallback(
        (_event: MouseEvent | TouchEvent | null, nextViewport: Viewport) => {
            latestViewportRef.current = nextViewport;
            if (viewportInitializedForProjectRef.current === currentProjectId) {
                saveWorkbenchViewport(currentProjectId, nextViewport);
            }
        },
        [currentProjectId]
    );

    // US2: the right-click menu is the data-driven "more" menu (T031) rendered
    // by the overlay layer; it acts on the whole selection when the clicked
    // node is selected, otherwise on the single node.
    const contextMenuNodes = React.useMemo<WorkbenchNode[]>(() => {
        if (!contextMenu) return [];
        if (!contextMenu.nodeId) return [];
        if (selectedNodeIds.includes(contextMenu.nodeId)) {
            return workbenchNodes.filter((node) => selectedNodeIds.includes(node.id));
        }
        return workbenchNodes.filter((node) => node.id === contextMenu.nodeId);
    }, [contextMenu, selectedNodeIds, workbenchNodes]);

    const handleContextMenuPaste = useCallback(() => {
        if (!contextMenu) return;
        pasteFromClipboard(screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y }));
    }, [contextMenu, pasteFromClipboard, screenToFlowPosition]);

    const handleContextMenuPasteImage = useCallback(async () => {
        const file = await readClipboardImage();
        if (file) addImageFile(file);
    }, [addImageFile]);

    // FR-007: one-shot creation is an atomic store action (T006) — the view
    // only builds the node payload; select + tool switch happen in one update.
    const { handlePaneClickWithTool, handleCanvasMouseDownForArrow, handleCanvasMouseUpForArrow } =
        useWorkbenchOneShotCreation({
            activeWorkbenchTool,
            screenToFlowPosition,
            createOneShotNode,
            setSelection,
            handlePaneClick,
        });

    const { handleEraseAtPoint, onStrokeFinished, ERASER_SIZE } = useWorkbenchFreehandEraser({
        activeWorkbenchTool,
        workbenchNodes,
        freehandColor,
        freehandStrokeWidth,
        removeWorkbenchNode,
        addWorkbenchNode,
        setSelection,
    });

    const handleNodesChangeForFlow = useCallback((changes: NodeChange[]) => {
        const flowState = reactFlowStore.getState();
        flowState.setNodes(applyNodeChanges(changes, flowState.nodes));
        handleNodesChange(changes);
    }, [handleNodesChange, reactFlowStore]);

    const handleNodeDragStart = useCallback<OnNodeDrag>(
        (_event, _node, nodes) => {
            beginWorkbenchGesture('move', nodes.map((draggedNode) => draggedNode.id));
        },
        [beginWorkbenchGesture]
    );

    // When a node drag finishes (mouse released), commit the complete final
    // state and sync it immediately so a reload never shows stale state.
    const handleNodeDragStop = useCallback<OnNodeDrag>(
        (_event, _node, draggedNodes) => {
            commitNodePositions(draggedNodes.map((draggedNode) => ({
                id: draggedNode.id,
                position: draggedNode.position,
            })));
            commitWorkbenchGesture();
            requestImmediateSceneSave();
        },
        [commitNodePositions, commitWorkbenchGesture]
    );

    // FR-015: canvas theme (light default / dark optional), restyled in place.
    const canvasTheme = useWorkbenchThemeStore((state) => state.canvasTheme);

    const isDrawModeActive = activeWorkbenchTool === 'draw';
    const isEraserModeActive = activeWorkbenchTool === 'eraser';
    // C-3.1/C-3.2: mode-derived React Flow props from the pure contract fn (T018).
    const flowModeProps = getFlowModeProps(activeWorkbenchTool);

    return (
        <div
            ref={flowWrapperRef}
            className={cn(
                'relative w-full h-screen',
                canvasTheme === 'dark' ? 'bg-viz-bg' : 'bg-white',
                isTransitioningToStudio && 'pointer-events-none'
            )}
            onMouseDown={handleCanvasMouseDownForArrow}
            onMouseUp={handleCanvasMouseUpForArrow}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChangeForFlow}
                onSelectionChange={onSelectionChange}
                onNodeDragStart={handleNodeDragStart}
                onNodeDragStop={handleNodeDragStop}
                onConnect={handleConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeContextMenu={handleNodeContextMenu}
                onPaneContextMenu={handlePaneContextMenu}
                onPaneClick={handlePaneClickWithTool}
                deleteKeyCode={['Backspace', 'Delete']}
                selectionMode={SelectionMode.Partial}
                selectionOnDrag={flowModeProps.selectionOnDrag}
                selectionKeyCode="Shift"
                multiSelectionKeyCode="Shift"
                panOnDrag={[WORKBENCH_PAN_MOUSE_BUTTON]}
                panOnScroll={true}
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                elementsSelectable={flowModeProps.elementsSelectable}
                nodesDraggable={flowModeProps.nodesDraggable}
                nodesConnectable={flowModeProps.nodesConnectable}
                snapToGrid={true}
                snapGrid={[5, 5]}
                minZoom={0.1}
                maxZoom={20}
                onMoveEnd={handleViewportMoveEnd}
                connectionRadius={60}
                connectionLineComponent={WorkbenchConnectionLine}
            >
                <WorkbenchCanvasBackground />
            </ReactFlow>
            <FloatingArrowOverlay
                arrows={workbenchNodes.filter((node): node is Extract<WorkbenchNode, { type: 'arrow' }> => node.type === 'arrow')}
                selectedNodeIds={selectedNodeIds}
                viewport={viewport}
                wrapperRef={flowWrapperRef}
                onDataChange={handleDataChange}
                onTransientDataChange={handleTransientDataChange}
                onGestureStart={handleGestureStart}
                onGestureEnd={handleGestureEnd}
                onSelect={(nodeId) => {
                    setSelection([nodeId]);
                }}
            />
            {/* Awareness overlays (US2): remote cursors + soft-lock badges. */}
            <CursorOverlay remoteCursors={remoteCursors} viewport={viewport} />
            <NodeLockBadges nodes={nodes} nodeLocks={nodeLocks} viewport={viewport} />
            {/* Floating selection toolbar + more menu (US2, ui-translation §5). */}
            <WorkbenchOverlayLayer
                contextMenu={contextMenu}
                onCloseContextMenu={() => setContextMenu(null)}
                contextNodes={contextMenuNodes}
                onPaste={handleContextMenuPaste}
                onPasteImage={handleContextMenuPasteImage}
            />
            {/* Collab session state (US3, SC-004). The PresenceIndicator chips
                are intentionally not rendered — the component is kept for a
                possible return (US2/SC-003). */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <ComputePopover />
                <CollabStatusChip status={collabSession.status} peers={presenceByUser} />
            </div>
            <DrawingOverlay
                mode={isEraserModeActive ? 'erase' : isDrawModeActive || isDrawMode ? 'draw' : null}
                wrapperRef={flowWrapperRef}
                previewColor={freehandColor}
                previewSize={freehandStrokeWidth}
                eraserSize={ERASER_SIZE}
                onEraseAtPoint={handleEraseAtPoint}
                onStrokeFinished={onStrokeFinished}
            />
            <WorkbenchChrome
                dropdownRef={dropdownRef}
                activeTool={activeWorkbenchTool}
                freehandColor={freehandColor}
                freehandStrokeWidth={freehandStrokeWidth}
                onSelectTool={setActiveWorkbenchTool}
                onFreehandColorChange={setFreehandColor}
                onFreehandStrokeWidthChange={setFreehandStrokeWidth}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={handleCanUndo}
                canRedo={handleCanRedo}
                onMediaUpload={handleMediaUpload}
                onMediaUploadFromPhone={handleMediaUploadFromPhone}
                onCreateNode={handleCreateNode}
                sketchFormats={sketchFormats}
                onFormatSelect={handleFormatSelect}
                mediaUploadInputRef={mediaUploadInputRef}
                onMediaUploadChange={handleMediaUploadChange}
                isPhoneUploadModalOpen={isPhoneUploadModalOpen}
                onClosePhoneUploadModal={closePhoneUploadModal}
                onPhoneUploadComplete={handlePhoneUploadComplete}
                zoomLevel={viewport.zoom}
                onZoomIn={() => zoomIn({ duration: 300 })}
                onZoomOut={() => zoomOut({ duration: 300 })}
                // §3.5 zoom presets: zoom about the screen center.
                onSetZoom={(targetZoom: number) => {
                    const cx = window.innerWidth / 2;
                    const cy = window.innerHeight / 2;
                    const flowX = (cx - viewport.x) / viewport.zoom;
                    const flowY = (cy - viewport.y) / viewport.zoom;
                    setViewport({ x: cx - flowX * targetZoom, y: cy - flowY * targetZoom, zoom: targetZoom }, { duration: 300 });
                }}
                onFitToScreen={() => fitView({ duration: 300 })}
                basicBlocksMenu={basicBlocksMenu}
                onBlockSelect={handleBlockSelect}
                isTransitioningToStudio={isTransitioningToStudio || !active}
            />
        </div>
    );
};

export const Workbench: React.FC<{ active?: boolean }> = ({ active = true }) => {
    return (
        <ReactFlowProvider>
            <WorkbenchContent active={active} />
        </ReactFlowProvider>
    );
};
