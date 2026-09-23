import { useCallback, useRef, useState } from 'react';
import {
    Node,
    NodeChange,
    OnNodesChange,
    applyNodeChanges,
} from '@xyflow/react';

import { WorkbenchNode } from '@/types';

import { normalizeArrowGeometry } from '@/services/workbench/arrowGeometry';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { buildFlowNodes } from './workbenchNodeSizing';
import { BasicBlocksMenuState } from './useWorkbenchBlockCreation';
import { useStore } from '@/store/useStore';

type ContextMenuState = { x: number; y: number; nodeId: string } | null;

type UseWorkbenchNodeHandlersOptions = {
    workbenchNodes: WorkbenchNode[];
    selectedNodeIds: string[];
    setSelectedNodeIds: (ids: string[]) => void;
    updateWorkbenchNode: (id: string, updates: Partial<WorkbenchNode>) => void;
    updateWorkbenchNodeTransient: (id: string, updates: Partial<WorkbenchNode>) => void;
    beginWorkbenchGesture: (kind: 'move' | 'resize' | 'arrow-handle', affectedNodeIds?: string[]) => void;
    commitWorkbenchGesture: () => void;
    cancelWorkbenchGesture: () => void;
    removeWorkbenchNode: (id?: string) => void;
    openNodeInStudio: (id: string) => void;
    setActiveNodeId: (id: string | null) => void;
    setBasicBlocksMenu: (value: BasicBlocksMenuState) => void;
};

/**
 * Remote soft-lock guard (spec FR-015): `nodeLocks` only ever contains locks
 * held by OTHER clients, so a hit means this session must not mutate the node.
 * Read at call time — lock state changes without re-rendering these handlers.
 */
const isRemotelyLocked = (nodeId: string): boolean => Boolean(useStore.getState().nodeLocks[nodeId]);

export function useWorkbenchNodeHandlers({
    workbenchNodes,
    selectedNodeIds,
    setSelectedNodeIds,
    updateWorkbenchNode,
    updateWorkbenchNodeTransient,
    beginWorkbenchGesture,
    commitWorkbenchGesture,
    cancelWorkbenchGesture,
    removeWorkbenchNode,
    openNodeInStudio,
    setActiveNodeId,
    setBasicBlocksMenu,
}: UseWorkbenchNodeHandlersOptions) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const resizingNodeIdsRef = useRef<Set<string>>(new Set());

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        const flowNodes = buildFlowNodes(workbenchNodes, selectedNodeIds);
        applyNodeChanges(changes as NodeChange[], flowNodes);
        const nextSelectedNodeIds = new Set(selectedNodeIds);

        changes.forEach((change) => {
            if (change.type === 'dimensions') {
                if (change.resizing) {
                    resizingNodeIdsRef.current.add(change.id);
                } else {
                    resizingNodeIdsRef.current.delete(change.id);
                }
            } else if (change.type === 'position' && change.position) {
                if (resizingNodeIdsRef.current.has(change.id)) {
                    return;
                }
                updateWorkbenchNodeTransient(change.id, {
                    x: change.position.x,
                    y: change.position.y,
                });
            }
            // Dimension changes are handled by onResizeEnd in nodes - not here
            // This prevents flooding Zustand during drag operations
            else if (change.type === 'remove') {
                removeWorkbenchNode(change.id);
            } else if (change.type === 'select') {
                // Defense in depth for FR-015: per-node `selectable=false`
                // already blocks selection in React Flow; never re-add a
                // remotely locked node through a programmatic change either.
                if (change.selected && isRemotelyLocked(change.id)) {
                    return;
                }
                if (change.selected) {
                    nextSelectedNodeIds.add(change.id);
                } else {
                    nextSelectedNodeIds.delete(change.id);
                }
            }
        });

        const nextSelection = [...nextSelectedNodeIds];
        if (nextSelection.length !== selectedNodeIds.length || nextSelection.some((id) => !selectedNodeIds.includes(id))) {
            setSelectedNodeIds(nextSelection);
        }
    }, [updateWorkbenchNodeTransient, removeWorkbenchNode, setSelectedNodeIds, selectedNodeIds, workbenchNodes]);

    const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
        if (isRemotelyLocked(node.id)) return;
        const workbenchNode = workbenchNodes.find((n) => n.id === node.id);
        // Uploaded images use the `media` node shape so their object URL can be
        // released when the node is deleted. They are still editable images,
        // so treat them like project image nodes when opening the editor.
        if (workbenchNode?.type === 'image' || workbenchNode?.type === 'media') {
            openNodeInStudio(node.id);
        }
    }, [workbenchNodes, openNodeInStudio]);

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    }, []);

    const handlePaneClick = useCallback(() => {
        setActiveNodeId(null);
        setSelectedNodeIds([]);
        setBasicBlocksMenu(null);
    }, [setActiveNodeId, setBasicBlocksMenu, setSelectedNodeIds]);

    const handleSourceClick = useCallback((nodeId: string) => {
        const sourceNode = workbenchNodes.find((n) => n.id === nodeId);
        if (sourceNode) {
            const rect = document.querySelector(`[data-id="${nodeId}"]`)?.getBoundingClientRect();
            if (rect) {
                setBasicBlocksMenu({
                    visible: true,
                    x: rect.right + 15,
                    y: rect.top + rect.height / 2,
                    sourceNodeId: nodeId,
                });
            }
        }
    }, [workbenchNodes, setBasicBlocksMenu]);

    const handleResize = useCallback((nodeId: string, width: number, height: number, x?: number, y?: number) => {
        if (isRemotelyLocked(nodeId)) return;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }

        const node = workbenchNodes.find((n) => n.id === nodeId);
        if (!node) {
            return;
        }

        beginWorkbenchGesture('resize', [nodeId]);
        const xUpdate = Number.isFinite(x) ? x : undefined;
        const yUpdate = Number.isFinite(y) ? y : undefined;
        let updates: Partial<WorkbenchNode>;

        if (node.type === 'arrow') {
            const currentWidth = Number.isFinite(node.width) && (node.width as number) > 0 ? (node.width as number) : width;
            const currentHeight = Number.isFinite(node.height) && (node.height as number) > 0 ? (node.height as number) : height;
            updates = {
                width,
                height,
                data: normalizeArrowGeometry(node.data, currentWidth, currentHeight, width, height),
                ...(xUpdate !== undefined ? { x: xUpdate } : {}),
                ...(yUpdate !== undefined ? { y: yUpdate } : {}),
            };
        } else if ((node.type === 'image' || node.type === 'video') && node.project?.canvas) {
            const canvasWidth = node.project.canvas.width;
            if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) {
                updates = { width, height };
            } else {
                const scale = width / canvasWidth;
                if (!Number.isFinite(scale) || scale <= 0) {
                    return;
                }
                updates = { scale, width, height };
            }
            updates = {
                ...updates,
                ...(xUpdate !== undefined ? { x: xUpdate } : {}),
                ...(yUpdate !== undefined ? { y: yUpdate } : {}),
            };
        } else {
            updates = {
                width,
                height,
                ...(xUpdate !== undefined ? { x: xUpdate } : {}),
                ...(yUpdate !== undefined ? { y: yUpdate } : {}),
            };
        }

        updateWorkbenchNodeTransient(nodeId, updates);
    }, [beginWorkbenchGesture, updateWorkbenchNodeTransient, workbenchNodes]);

    const handleResizeEnd = useCallback((nodeId: string, width: number, height: number, x?: number, y?: number) => {
        handleResize(nodeId, width, height, x, y);
        commitWorkbenchGesture();
        requestImmediateSceneSave();
    }, [commitWorkbenchGesture, handleResize]);

    const handleTransientDataChange = useCallback((nodeId: string, data: Record<string, unknown>) => {
        if (isRemotelyLocked(nodeId)) return;
        const node = workbenchNodes.find((candidate) => candidate.id === nodeId);
        if (!node || !('data' in node)) {
            return;
        }

        updateWorkbenchNodeTransient(nodeId, {
            data: {
                ...(node.data as Record<string, unknown>),
                ...data,
            },
        } as Partial<WorkbenchNode>);
    }, [updateWorkbenchNodeTransient, workbenchNodes]);

    const handleGestureStart = useCallback((nodeId: string, kind: 'move' | 'resize' | 'arrow-handle') => {
        beginWorkbenchGesture(kind, [nodeId]);
    }, [beginWorkbenchGesture]);

    const handleGestureEnd = useCallback((cancelled = false) => {
        if (cancelled) {
            // Cancellation restores the transaction start snapshot and deliberately
            // does not request a persistence flush.
            cancelWorkbenchGesture();
            return;
        }
        commitWorkbenchGesture();
        requestImmediateSceneSave();
    }, [cancelWorkbenchGesture, commitWorkbenchGesture]);

    const handleDataChange = useCallback((nodeId: string, data: Record<string, unknown>) => {
        if (isRemotelyLocked(nodeId)) return;
        const node = workbenchNodes.find((n) => n.id === nodeId);
        if (!node || !('data' in node)) {
            return;
        }

        const updates = {
            data: {
                ...(node.data as Record<string, unknown>),
                ...data,
            },
        } as Partial<WorkbenchNode>;

        updateWorkbenchNode(nodeId, updates);
    }, [updateWorkbenchNode, workbenchNodes]);

    return {
        contextMenu,
        setContextMenu,
        handleNodesChange,
        handleNodeDoubleClick,
        handleNodeContextMenu,
        handlePaneClick,
        handleSourceClick,
        handleResize,
        handleResizeEnd,
        handleTransientDataChange,
        handleGestureStart,
        handleGestureEnd,
        handleDataChange,
    };
}
