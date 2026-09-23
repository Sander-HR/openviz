import React, { useCallback, useRef } from 'react';
import {
    ReactFlow,
    Background,
    NodeTypes,
    EdgeTypes,
    BackgroundVariant,
    ReactFlowProvider,
    useReactFlow,
    useViewport,
    SelectionMode,
    OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ImageNode } from '../nodes/ImageNode';
import { VideoNode } from '../nodes/VideoNode';
import { AnimateNode } from '../nodes/AnimateNode';
import { RenderNode } from '../nodes/RenderNode';
import { FreehandNode } from '../nodes/FreehandNode';
import { ArrowNode } from '../nodes/ArrowNode';
import { TextNode } from '../nodes/TextNode';
import { NoteNode } from '../nodes/NoteNode';
import { MediaNode } from '../nodes/MediaNode';
import { CustomEdge } from '../nodes/CustomEdge';
import { WorkbenchChrome } from './WorkbenchChrome';
import { useWorkbench } from './hooks/useWorkbench';
import { useWorkbenchCollabSession } from './hooks/useWorkbenchCollabSession';
import { useStore } from '../../store/useStore';
import { useAutoSaveScene } from '../../hooks/useAutoSaveScene';
import { useWorkbenchCenterOnReturn } from './hooks/useWorkbenchCenterOnReturn';
import { useWorkbenchOneShotCreation } from './hooks/useWorkbenchOneShotCreation';
import { getFlowModeProps } from './hooks/workbenchModeProps';
import { useWorkbenchContextMenuActions } from './hooks/useWorkbenchContextMenuActions';
import { useWorkbenchFreehandEraser } from './hooks/useWorkbenchFreehandEraser';
import { useWorkbenchMediaUpload } from './hooks/useWorkbenchMediaUpload';
import { useResizeObserverWarningSuppression } from './hooks/useResizeObserverWarningSuppression';
import { useWorkbenchGraph } from './hooks/useWorkbenchGraph';
import { useCollabPresencePublisher } from './hooks/useCollabPresencePublisher';
import { useSceneStream } from './hooks/useSceneStream';
import { CollabStatusChip } from './CollabStatusChip';
import { CursorOverlay } from './CursorOverlay';
import { NodeLockBadges } from './NodeLockBadges';
import { useShallow } from 'zustand/react/shallow';
import { WorkbenchConnectionLine } from '../nodes/WorkbenchConnectionLine';
import { DrawingOverlay } from '@/drawing/DrawingOverlay';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { WORKBENCH_PAN_MOUSE_BUTTON } from './hooks/workbenchViewportGestures';

const nodeTypes: NodeTypes = {
    imageNode: ImageNode,
    videoNode: VideoNode,
    animateNode: AnimateNode,
    renderNode: RenderNode,
    freehandNode: FreehandNode,
    arrowNode: ArrowNode,
    textNode: TextNode,
    noteNode: NoteNode,
    mediaNode: MediaNode,
};

const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

const WorkbenchContent: React.FC = () => {
    const flowWrapperRef = useRef<HTMLDivElement>(null);
    const { setCenter, zoomIn, zoomOut, fitView, setViewport, screenToFlowPosition } = useReactFlow();
    const viewport = useViewport();
    const { viewMode, currentProjectId } = useStore(
        useShallow((state) => ({
            viewMode: state.viewMode,
            currentProjectId: state.currentProjectId,
        }))
    );
    
    useAutoSaveScene(currentProjectId);
    useSceneStream(currentProjectId);
    const collabSession = useWorkbenchCollabSession();

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
            reorderWorkbenchNode,
            copyToClipboard,
            pasteFromClipboard,
            duplicateWorkbenchNode,
            removeWorkbenchNode,
            setActiveWorkbenchTool,
            setActiveNodeId,
            setSelectedNodeIds,
            addWorkbenchNode,
            createOneShotNode,
            setFreehandColor,
            setFreehandStrokeWidth,
            undoWorkbench,
            redoWorkbench,
        },
    } = useWorkbench(
        collabSession.active
            ? { undoAction: collabSession.undo, redoAction: collabSession.redo }
            : undefined
    );

    // In collaboration mode the Yjs UndoManager owns history (SC-005): the
    // toolbar and Cmd/Ctrl+Z drive it instead of the local store history.
    const handleUndo = collabSession.active ? collabSession.undo : undoWorkbench;
    const handleRedo = collabSession.active ? collabSession.redo : redoWorkbench;
    const handleCanUndo = collabSession.active ? collabSession.canUndo : canUndoWorkbench;
    const handleCanRedo = collabSession.active ? collabSession.canRedo : canRedoWorkbench;
    useWorkbenchCenterOnReturn({ viewMode, activeNodeId, workbenchNodes, setCenter });
    const { nodes, edges } = useWorkbenchGraph({
        workbenchNodes,
        connections,
        selectedNodeIds,
        nodeLocks,
        handleSourceClick,
        handleResize,
        handleResizeEnd,
        handleTransientDataChange,
        handleGestureStart,
        handleGestureEnd,
        handleDataChange,
    });

    const contextMenuActions = useWorkbenchContextMenuActions({
        contextMenu,
        reorderWorkbenchNode,
        copyToClipboard,
        pasteFromClipboard,
        duplicateWorkbenchNode,
        removeWorkbenchNode,
    });

    // FR-007: one-shot creation is an atomic store action (T006) — the view
    // only builds the node payload; select + tool switch happen in one update.
    const { handlePaneClickWithTool, handleCanvasMouseDownForArrow, handleCanvasMouseUpForArrow } =
        useWorkbenchOneShotCreation({
            activeWorkbenchTool,
            screenToFlowPosition,
            createOneShotNode,
            handlePaneClick,
        });

    const { handleEraseAtPoint, onStrokeFinished, ERASER_SIZE } = useWorkbenchFreehandEraser({
        activeWorkbenchTool,
        workbenchNodes,
        freehandColor,
        freehandStrokeWidth,
        removeWorkbenchNode,
        addWorkbenchNode,
        setActiveNodeId,
        setSelectedNodeIds,
    });

    const {
        mediaUploadInputRef,
        isPhoneUploadModalOpen,
        closePhoneUploadModal,
        handleMediaUpload,
        handleMediaUploadFromPhone,
        handlePhoneUploadComplete,
        handleMediaUploadChange,
    } = useWorkbenchMediaUpload({
        flowWrapperRef,
        screenToFlowPosition,
        makeOneShotNode: createOneShotNode,
    });

    const handleNodeDragStart = useCallback<OnNodeDrag>(
        (_event, _node, nodes) => {
            beginWorkbenchGesture('move', nodes.map((draggedNode) => draggedNode.id));
        },
        [beginWorkbenchGesture]
    );

    // When a node drag finishes (mouse released), commit the complete final
    // state and sync it immediately so a reload never shows stale state.
    const handleNodeDragStop = useCallback<OnNodeDrag>(
        () => {
            commitWorkbenchGesture();
            requestImmediateSceneSave();
        },
        [commitWorkbenchGesture]
    );

    const isDrawModeActive = activeWorkbenchTool === 'draw';
    const isEraserModeActive = activeWorkbenchTool === 'eraser';
    // C-3.1/C-3.2: mode-derived React Flow props from the pure contract fn (T018).
    const flowModeProps = getFlowModeProps(activeWorkbenchTool);

    return (
        <div
            ref={flowWrapperRef}
            className="relative w-full h-screen bg-white"
            onMouseDown={handleCanvasMouseDownForArrow}
            onMouseUp={handleCanvasMouseUpForArrow}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChange}
                onNodeDragStart={handleNodeDragStart}
                onNodeDragStop={handleNodeDragStop}
                onConnect={handleConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeContextMenu={handleNodeContextMenu}
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
                fitView
                minZoom={0.1}
                maxZoom={2}
                connectionRadius={60}
                connectionLineComponent={WorkbenchConnectionLine}
            >
                <Background id='smalldots' variant={BackgroundVariant.Dots} gap={12} size={1} color="#c6cfdb" />
                <Background id="fatdots" color="#a0afc3" variant={BackgroundVariant.Dots} gap={56} size={1.1} />
            </ReactFlow>
            {/* Awareness overlays (US2): remote cursors + soft-lock badges. */}
            <CursorOverlay remoteCursors={remoteCursors} viewport={viewport} />
            <NodeLockBadges nodes={nodes} nodeLocks={nodeLocks} viewport={viewport} />
            {/* Collab session state (US3, SC-004). The PresenceIndicator chips
                are intentionally not rendered — the component is kept for a
                possible return (US2/SC-003). */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
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
                onResetZoom={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })}
                onFitToScreen={() => fitView({ duration: 300 })}
                contextMenu={contextMenu}
                onCloseContextMenu={() => setContextMenu(null)}
                contextMenuActions={contextMenuActions}
                basicBlocksMenu={basicBlocksMenu}
                onBlockSelect={handleBlockSelect}
            />
        </div>
    );
};

export const Workbench: React.FC = () => {
    return (
        <ReactFlowProvider>
            <WorkbenchContent />
        </ReactFlowProvider>
    );
};
