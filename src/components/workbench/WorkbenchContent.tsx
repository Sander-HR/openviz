import React, { useCallback, useRef } from 'react';
import {
    ReactFlow,
    SelectionMode,
    applyNodeChanges,
    type NodeChange,
    type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useReactFlow } from '@xyflow/react';
import { useWorkbenchCanvasSetup } from './hooks/useWorkbenchCanvasSetup';
import { useWorkbenchCanvasProjection } from './hooks/useWorkbenchCanvasProjection';
import { useWorkbenchCanvasInteractions } from './hooks/useWorkbenchCanvasInteractions';
import { useWorkbenchCenterOnReturn } from './hooks/useWorkbenchCenterOnReturn';
import { useWorkbenchThemeStore } from '../../store/slices/workbenchThemeSlice';
import { WorkbenchChrome } from './WorkbenchChrome';
import { WorkbenchCursorLayer } from './WorkbenchCursorLayer';
import { NodeLockBadges } from './NodeLockBadges';
import { WorkbenchOverlayLayer } from './WorkbenchOverlayLayer';
import { WorkbenchConnectionLine } from '../nodes/WorkbenchConnectionLine';
import { FloatingArrowOverlay } from './FloatingArrowOverlay';
import { WorkbenchCanvasBackground } from './WorkbenchCanvasBackground';
import { CollabStatusChip } from './CollabStatusChip';
import { ComputePopover } from '@/components/product-design/ComputePopover';
import { DrawingOverlay } from '@/drawing/DrawingOverlay';
import { cn } from '@/lib/utils';
import type { WorkbenchNode } from '@/types';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { WORKBENCH_PAN_MOUSE_BUTTON } from './hooks/workbenchViewportGestures';
import { getFlowModeProps } from './hooks/workbenchModeProps';
import { nodeTypes, edgeTypes } from './workbenchNodeTypes';

export const WorkbenchContent: React.FC<{ active: boolean }> = ({ active }) => {
    const flowWrapperRef = useRef<HTMLDivElement>(null);
    const draggingNodeIdsRef = useRef<Set<string>>(new Set());
    const { setCenter, zoomIn, zoomOut, fitView, setViewport, screenToFlowPosition } = useReactFlow();
    const setup = useWorkbenchCanvasSetup({ active, flowWrapperRef, screenToFlowPosition });
    const { currentProjectId, sceneHydrated, viewMode, isTransitioningToStudio, collabSession } = setup;
    const { workbenchNodes, canUndoWorkbench, canRedoWorkbench, activeNodeId,
        selectedNodeIds, isDrawMode, activeWorkbenchTool, freehandColor, freehandStrokeWidth } = setup.workbench.state;
    const { contextMenu, setContextMenu, dropdownRef, basicBlocksMenu, sketchFormats } = setup.workbench.menus;
    const { handleNodesChange, handleConnect, onConnectStart, onConnectEnd,
        handleNodeDoubleClick, handleNodeContextMenu, handlePaneContextMenu,
        handleFormatSelect, handleBlockSelect, handleTransientDataChange,
        handleGestureStart, handleGestureEnd, handleDataChange } = setup.workbench.handlers;
    const { beginWorkbenchGesture, commitWorkbenchGesture } = setup.workbench.gesture;
    const { setActiveWorkbenchTool, setFreehandColor, setFreehandStrokeWidth,
        undoWorkbench, redoWorkbench, commitNodePositions } = setup.workbench.actions;
    const canvasTheme = useWorkbenchThemeStore((state) => state.canvasTheme);
    const nodeLocks = setup.nodeLocks;
    const presenceByUser = setup.presenceByUser;

    useWorkbenchCenterOnReturn({ viewMode, activeNodeId, workbenchNodes, projectId: currentProjectId, setCenter });

    const projection = useWorkbenchCanvasProjection({
        currentProjectId,
        sceneHydrated,
        flowWrapperRef,
        draggingNodeIdsRef,
        workbench: setup.workbench,
        nodeLocks,
        isTransitioningToStudio,
    });
    const interactions = useWorkbenchCanvasInteractions({
        screenToFlowPosition,
        workbench: setup.workbench,
        createOneShotNode: setup.createOneShotNode,
        setSelection: projection.setSelection,
        addImageFile: setup.mediaUpload.addImageFile,
    });

    const handleNodesChangeForFlow = useCallback((changes: NodeChange[]) => {
        type CanvasFlowNode = (typeof projection.nodes)[number];
        projection.setFlowNodes((currentNodes) => applyNodeChanges<CanvasFlowNode>(
            changes as NodeChange<CanvasFlowNode>[],
            currentNodes,
        ));
        handleNodesChange(changes);
    }, [handleNodesChange, projection.setFlowNodes]);

    const handleNodeDragStart = useCallback<OnNodeDrag>((_event, _node, draggedNodes) => {
        draggingNodeIdsRef.current = new Set(draggedNodes.map((node) => node.id));
        beginWorkbenchGesture('move', draggedNodes.map((node) => node.id));
    }, [beginWorkbenchGesture]);

    const handleNodeDragStop = useCallback<OnNodeDrag>((_event, _node, draggedNodes) => {
        commitNodePositions(draggedNodes.map((node) => ({ id: node.id, position: node.position })));
        draggingNodeIdsRef.current.clear();
        commitWorkbenchGesture();
        if (!collabSession.active) requestImmediateSceneSave();
    }, [collabSession.active, commitNodePositions, commitWorkbenchGesture]);

    const handleUndo = collabSession.active ? collabSession.undo : undoWorkbench;
    const handleRedo = collabSession.active ? collabSession.redo : redoWorkbench;
    const handleCanUndo = collabSession.active ? collabSession.canUndo : canUndoWorkbench;
    const handleCanRedo = collabSession.active ? collabSession.canRedo : canRedoWorkbench;
    const flowModeProps = getFlowModeProps(activeWorkbenchTool);
    const isDrawModeActive = activeWorkbenchTool === 'draw';
    const isEraserModeActive = activeWorkbenchTool === 'eraser';

    return (
        <div
            ref={flowWrapperRef}
            className={cn('relative w-full h-screen', canvasTheme === 'dark' ? 'bg-viz-bg' : 'bg-white',
                isTransitioningToStudio && 'pointer-events-none')}
            onMouseDown={interactions.handleCanvasMouseDownForArrow}
            onMouseUp={interactions.handleCanvasMouseUpForArrow}
        >
            <ReactFlow
                nodes={projection.flowNodes}
                edges={projection.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChangeForFlow}
                onSelectionChange={projection.onSelectionChange}
                onNodeDragStart={handleNodeDragStart}
                onNodeDragStop={handleNodeDragStop}
                onConnect={handleConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeContextMenu={handleNodeContextMenu}
                onPaneContextMenu={handlePaneContextMenu}
                onPaneClick={interactions.handlePaneClickWithTool}
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
                onMoveEnd={projection.handleViewportMoveEnd}
                connectionRadius={60}
                connectionLineComponent={WorkbenchConnectionLine}
            >
                <WorkbenchCanvasBackground />
            </ReactFlow>
            <FloatingArrowOverlay
                arrows={workbenchNodes.filter((node): node is Extract<WorkbenchNode, { type: 'arrow' }> => node.type === 'arrow')}
                selectedNodeIds={selectedNodeIds}
                viewport={projection.viewport}
                wrapperRef={flowWrapperRef}
                onDataChange={handleDataChange}
                onTransientDataChange={handleTransientDataChange}
                onGestureStart={handleGestureStart}
                onGestureEnd={handleGestureEnd}
                onSelect={(nodeId) => projection.setSelection([nodeId])}
            />
            <WorkbenchCursorLayer viewport={projection.viewport} />
            <NodeLockBadges nodes={projection.nodes} nodeLocks={nodeLocks} viewport={projection.viewport} />
            <WorkbenchOverlayLayer
                contextMenu={contextMenu}
                onCloseContextMenu={() => setContextMenu(null)}
                contextNodes={interactions.contextMenuNodes}
                onPaste={interactions.handleContextMenuPaste}
                onPasteImage={interactions.handleContextMenuPasteImage}
            />
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <ComputePopover />
                <CollabStatusChip
                    status={collabSession.status}
                    peers={presenceByUser}
                    onRetry={collabSession.retryWithFreshToken}
                    localPersistenceAvailable={collabSession.localPersistenceAvailable}
                    sessionActive={collabSession.active}
                />
            </div>
            <DrawingOverlay
                mode={isEraserModeActive ? 'erase' : isDrawModeActive || isDrawMode ? 'draw' : null}
                wrapperRef={flowWrapperRef}
                previewColor={freehandColor}
                previewSize={freehandStrokeWidth}
                eraserSize={interactions.eraserSize}
                onEraseAtPoint={interactions.handleEraseAtPoint}
                onStrokeFinished={interactions.onStrokeFinished}
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
                onMediaUpload={setup.mediaUpload.handleMediaUpload}
                onMediaUploadFromPhone={setup.mediaUpload.handleMediaUploadFromPhone}
                onCreateNode={setup.handleCreateNode}
                sketchFormats={sketchFormats}
                onFormatSelect={handleFormatSelect}
                mediaUploadInputRef={setup.mediaUpload.mediaUploadInputRef}
                onMediaUploadChange={setup.mediaUpload.handleMediaUploadChange}
                isPhoneUploadModalOpen={setup.mediaUpload.isPhoneUploadModalOpen}
                onClosePhoneUploadModal={setup.mediaUpload.closePhoneUploadModal}
                onPhoneUploadComplete={setup.mediaUpload.handlePhoneUploadComplete}
                zoomLevel={projection.viewport.zoom}
                onZoomIn={() => zoomIn({ duration: 300 })}
                onZoomOut={() => zoomOut({ duration: 300 })}
                onSetZoom={(targetZoom: number) => {
                    const cx = window.innerWidth / 2;
                    const cy = window.innerHeight / 2;
                    const flowX = (cx - projection.viewport.x) / projection.viewport.zoom;
                    const flowY = (cy - projection.viewport.y) / projection.viewport.zoom;
                    setViewport({ x: cx - flowX * targetZoom, y: cy - flowY * targetZoom, zoom: targetZoom }, { duration: 300 });
                }}
                onFitToScreen={() => fitView({ duration: 300 })}
                basicBlocksMenu={basicBlocksMenu}
                onBlockSelect={handleBlockSelect}
                sceneName={collabSession.active ? collabSession.sceneName : undefined}
                onRenameScene={collabSession.active ? collabSession.renameScene : undefined}
                isTransitioningToStudio={isTransitioningToStudio || !active}
            />
        </div>
    );
};
