import { useCallback, useRef, useState } from 'react';
import { Node, OnNodesChange } from '@xyflow/react';

import { WorkbenchNode } from '@/types';

import { normalizeArrowGeometry } from '@/services/workbench/arrowGeometry';
import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { BasicBlocksMenuState } from './useWorkbenchBlockCreation';
import { useStore } from '@/store/useStore';

type ContextMenuState = { x: number; y: number; nodeId: string | null } | null;

type UseWorkbenchNodeHandlersOptions = {
    workbenchNodes: WorkbenchNode[];
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
    const workbenchNodesRef = useRef(workbenchNodes);
    workbenchNodesRef.current = workbenchNodes;

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        const currentNodes = workbenchNodesRef.current;

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
                const movedNode = currentNodes.find((node) => node.id === change.id);
                const movedPosition = change.position;
                if (!movedPosition) return;
                updateWorkbenchNodeTransient(change.id, {
                    x: movedPosition.x,
                    y: movedPosition.y,
                });

                // Temporary attached arrows are uncommon during a normal node
                // drag. Walk only those arrows and update them directly instead
                // of rebuilding the complete node array and an id map per
                // pointer event.
                for (const node of currentNodes) {
                    if (node.type !== 'arrow' || !node.data.temporary || !movedNode) continue;
                    const updates: { start?: { x: number; y: number }; end?: { x: number; y: number } } = {};
                    (['start', 'end'] as const).forEach((point) => {
                        const attachment = node.data[point === 'start' ? 'startAttachment' : 'endAttachment'];
                        if (!attachment || attachment.nodeId !== change.id) return;
                        const width = movedNode.width ?? 0;
                        const height = movedNode.height ?? 0;
                        const local = attachment.side === 'left'
                            ? { x: 0, y: attachment.offset * height }
                            : attachment.side === 'right'
                                ? { x: width, y: attachment.offset * height }
                                : attachment.side === 'top'
                                    ? { x: attachment.offset * width, y: 0 }
                                    : { x: attachment.offset * width, y: height };
                        updates[point] = { x: movedPosition.x - node.x + local.x, y: movedPosition.y - node.y + local.y };
                    });
                    if (Object.keys(updates).length > 0) {
                        updateWorkbenchNodeTransient(node.id, { data: { ...node.data, ...updates } });
                    }
                }
            }
            // Dimension changes are handled by onResizeEnd in nodes - not here
            // This prevents flooding Zustand during drag operations
            else if (change.type === 'remove') {
                removeWorkbenchNode(change.id);
            }
        });
    }, [removeWorkbenchNode, updateWorkbenchNodeTransient]);

    const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
        if (isRemotelyLocked(node.id)) return;
        const workbenchNode = workbenchNodesRef.current.find((n) => n.id === node.id);
        // Uploaded images use the `media` node shape so their object URL can be
        // released when the node is deleted. They are still editable images,
        // so treat them like project image nodes when opening the editor.
        if (workbenchNode?.type === 'image' || workbenchNode?.type === 'media') {
            openNodeInStudio(node.id);
        }
    }, [openNodeInStudio]);

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    }, []);

    const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY, nodeId: null });
    }, []);

    const handlePaneClick = useCallback(() => {
        setActiveNodeId(null);
        setBasicBlocksMenu(null);
    }, [setActiveNodeId, setBasicBlocksMenu]);

    const handleSourceClick = useCallback((nodeId: string) => {
        const sourceNode = workbenchNodesRef.current.find((n) => n.id === nodeId);
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
    }, [setBasicBlocksMenu]);

    const handleResize = useCallback((nodeId: string, width: number, height: number, x?: number, y?: number) => {
        if (isRemotelyLocked(nodeId)) return;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
        }

        const node = workbenchNodesRef.current.find((n) => n.id === nodeId);
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
    }, [beginWorkbenchGesture, updateWorkbenchNodeTransient]);

    const handleResizeEnd = useCallback((nodeId: string, width: number, height: number, x?: number, y?: number) => {
        handleResize(nodeId, width, height, x, y);
        commitWorkbenchGesture();
        requestImmediateSceneSave();
    }, [commitWorkbenchGesture, handleResize]);

    const handleTransientDataChange = useCallback((nodeId: string, data: Record<string, unknown>) => {
        if (isRemotelyLocked(nodeId)) return;
        const node = workbenchNodesRef.current.find((candidate) => candidate.id === nodeId);
        if (!node || !('data' in node)) {
            return;
        }

        updateWorkbenchNodeTransient(nodeId, {
            data: {
                ...(node.data as Record<string, unknown>),
                ...data,
            },
        } as Partial<WorkbenchNode>);
    }, [updateWorkbenchNodeTransient]);

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
        const node = workbenchNodesRef.current.find((n) => n.id === nodeId);
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
    }, [updateWorkbenchNode]);

    return {
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
    };
}
