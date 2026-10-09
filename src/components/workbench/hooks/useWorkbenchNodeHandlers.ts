import { useCallback, useRef, useState } from 'react';
import { Node, OnNodesChange } from '@xyflow/react';

import { WorkbenchNode } from '@/types';

import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import { BasicBlocksMenuState } from './useWorkbenchBlockCreation';
import { useStore } from '@/store/useStore';
import type { SceneDocCommands } from '@/services/collab/sceneDocCommands';
import { buildNodeFieldDiff, buildNodeFieldPatches, getNodeResizeUpdates } from './workbenchNodeCommandLogic';
import type { ResizeSnapStateRef } from './nodeSnapLogic';

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
    commands?: SceneDocCommands | null;
    /** Shared live-resize snap state — the last correction is folded into the commit. */
    resizeSnapStateRef?: ResizeSnapStateRef;
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
    commands,
    resizeSnapStateRef,
}: UseWorkbenchNodeHandlersOptions) {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
    const resizingNodeIdsRef = useRef<Set<string>>(new Set());
    const workbenchNodesRef = useRef(workbenchNodes);
    workbenchNodesRef.current = workbenchNodes;

    const handleNodesChange: OnNodesChange = useCallback((changes) => {
        const currentNodes = workbenchNodesRef.current;
        const hasPositionChange = changes.some((change) => change.type === 'position');
        const currentNodesById = hasPositionChange
            ? new Map(currentNodes.map((node) => [node.id, node]))
            : null;
        const temporaryArrowsByNodeId = new Map<string, Set<WorkbenchNode>>();

        // A multi-node drag emits one position change per selected node. Build
        // the attachment index once instead of scanning every node for every
        // change; temporary arrows are the only position side effect here.
        if (hasPositionChange) {
            for (const node of currentNodes) {
                if (node.type !== 'arrow') continue;
                if (!node.data.temporary) continue;
                for (const point of ['start', 'end'] as const) {
                    const attachment = node.data[point === 'start' ? 'startAttachment' : 'endAttachment'];
                    if (!attachment) continue;
                    const arrows = temporaryArrowsByNodeId.get(attachment.nodeId) ?? new Set<WorkbenchNode>();
                    arrows.add(node);
                    temporaryArrowsByNodeId.set(attachment.nodeId, arrows);
                }
            }
        }

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
                const movedNode = currentNodesById?.get(change.id);
                const movedPosition = change.position;
                if (!movedPosition || !movedNode) return;
                for (const node of temporaryArrowsByNodeId.get(change.id) ?? []) {
                    if (node.type !== 'arrow') continue;
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
                    if (updates.start || updates.end) {
                        updateWorkbenchNodeTransient(node.id, { data: { ...node.data, ...updates } });
                    }
                }
            }
            // Dimension changes are handled by onResizeEnd in nodes - not here
            // This prevents flooding Zustand during drag operations
            else if (change.type === 'remove') {
                if (commands?.deleteNode(change.id)) removeWorkbenchNode(change.id);
                else if (!commands) removeWorkbenchNode(change.id);
            }
        });
    }, [commands, removeWorkbenchNode, updateWorkbenchNodeTransient]);

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
        const node = workbenchNodesRef.current.find((candidate) => candidate.id === nodeId);
        if (!node) return;
        const updates = getNodeResizeUpdates(node, width, height, x, y);
        if (!updates) return;

        beginWorkbenchGesture('resize', [nodeId]);
        updateWorkbenchNodeTransient(nodeId, updates);
    }, [beginWorkbenchGesture, updateWorkbenchNodeTransient]);

    const handleResizeEnd = useCallback((nodeId: string, width: number, height: number, x?: number, y?: number) => {
        const node = workbenchNodesRef.current.find((candidate) => candidate.id === nodeId);
        // Fold the last applied snap correction in so the committed geometry
        // matches what was rendered. `onResizeEnd` fires with RAW values before
        // React Flow's final dimensions change, so the projection's shared state
        // is the only place the corrected geometry is available here.
        const snapState = resizeSnapStateRef?.current;
        // Only trust the stored correction when it was computed from exactly the
        // raw geometry `onResizeEnd` reports (defensive: a mismatch would mean a
        // stale gesture state — commit raw rather than an unknown offset).
        const correctedRaw = snapState?.correctedRaw ?? null;
        const rawMatched = correctedRaw !== null && correctedRaw.width === width
            && correctedRaw.height === height
            && correctedRaw.x === (x ?? correctedRaw.x)
            && correctedRaw.y === (y ?? correctedRaw.y);
        const corrected = snapState && snapState.nodeId === nodeId && rawMatched ? snapState.corrected : null;
        const commitWidth = corrected ? corrected.width : width;
        const commitHeight = corrected ? corrected.height : height;
        // Only pass a corrected edge position when that edge actually moved —
        // otherwise the node keeps its existing x/y (avoids redundant patches).
        const commitX = corrected && snapState?.anchor?.x ? corrected.x : x;
        const commitY = corrected && snapState?.anchor?.y ? corrected.y : y;
        handleResize(nodeId, commitWidth, commitHeight, commitX, commitY);
        const updates = node ? getNodeResizeUpdates(node, commitWidth, commitHeight, commitX, commitY) : null;
        if (commands && updates) commands.updateNodeFields(nodeId, buildNodeFieldPatches(updates));
        commitWorkbenchGesture();
        if (!commands) requestImmediateSceneSave();
    }, [commands, commitWorkbenchGesture, handleResize, resizeSnapStateRef]);

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
        if (commands) {
            const state = useStore.getState();
            const gesture = state.activeWorkbenchGesture;
            for (const nodeId of gesture?.affectedNodeIds ?? []) {
                const previous = gesture?.startSnapshot.workbenchNodes.find((node) => node.id === nodeId);
                const current = state.workbenchNodes.find((node) => node.id === nodeId);
                if (previous && current) commands.updateNodeFields(nodeId, buildNodeFieldDiff(previous, current));
            }
        }
        commitWorkbenchGesture();
        if (!commands) requestImmediateSceneSave();
    }, [cancelWorkbenchGesture, commands, commitWorkbenchGesture]);

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

        if (commands) {
            commands.updateNodeFields(nodeId, buildNodeFieldPatches({ data }));
            return;
        }
        updateWorkbenchNode(nodeId, updates);
    }, [commands, updateWorkbenchNode]);

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
