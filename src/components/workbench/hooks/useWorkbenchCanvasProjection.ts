import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { useReactFlow, useViewport, type NodeChange, type Viewport } from '@xyflow/react';
import type { NodeLockState } from '@/types';
import { useWorkbenchGraph } from './useWorkbenchGraph';
import { useWorkbenchSelectionSync } from './useWorkbenchSelectionSync';
import { getCenteredWorkbenchViewport, getWorkbenchViewport, saveWorkbenchViewport } from './workbenchViewportPersistence';
import { buildSnapTargets, createResizeSnapState, filterOccludedNodes, findBestResizeSnap, findBestSnap, getGroupBounds, getNodeBounds, type NodeBounds, type ResizeSnapStateRef, type SnapGuideLine, type SnapTargetLines } from './nodeSnapLogic';
import type { useWorkbench } from './useWorkbench';

/** Screen-space distance within which a node line snaps to a static node's line. */
const SNAP_THRESHOLD_SCREEN_PX = 8;

/** Structural slice of a scene node needed to collect snap targets. */
interface SnapSourceNode {
    id: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number } | null;
    type?: string | null;
    zIndex?: number;
}

/**
 * Collects snap targets from scene nodes: skips dragged/locked/arrow nodes and
 * any node fully occluded by one rendered on top of it (so hidden nodes don't
 * produce guides). Resolves each survivor's bounds once.
 */
function collectSnapTargets(
    nodes: readonly SnapSourceNode[],
    isDragged: (id: string) => boolean,
    nodeLocks: Record<string, NodeLockState>,
): Parameters<typeof buildSnapTargets>[0] {
    const candidates = nodes.filter((node) => !isDragged(node.id) && !nodeLocks[node.id] && node.type !== 'arrowNode');
    return filterOccludedNodes(candidates).map((node) => ({
        id: node.id,
        position: node.position,
        width: node.measured?.width ?? node.width ?? 256,
        height: node.measured?.height ?? node.height ?? 256,
    }));
}

export interface WorkbenchSnapGuides {
    /** Vertical guides (x axis) currently rendered — all aligned lines, capped. */
    xGuides: SnapGuideLine[];
    /** Horizontal guides (y axis) currently rendered — all aligned lines, capped. */
    yGuides: SnapGuideLine[];
}

interface WorkbenchCanvasProjectionOptions {
    currentProjectId: string | null;
    sceneHydrated: boolean;
    flowWrapperRef: RefObject<HTMLDivElement | null>;
    draggingNodeIdsRef: MutableRefObject<Set<string>>;
    workbench: ReturnType<typeof useWorkbench>;
    nodeLocks: Record<string, NodeLockState>;
    isTransitioningToStudio: boolean;
    /** Shared live-resize snap state (written here, read by `handleResizeEnd`). */
    resizeSnapStateRef: ResizeSnapStateRef;
}

export function useWorkbenchCanvasProjection({
    currentProjectId,
    sceneHydrated,
    flowWrapperRef,
    draggingNodeIdsRef,
    workbench,
    nodeLocks,
    isTransitioningToStudio,
    resizeSnapStateRef,
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
    /** Last committed (rendered) geometry. Used to capture a resize's start bounds: by the time our change handler runs on a frame, React Flow has already applied that frame's raw size to its internal store, so the store can no longer be trusted as "before this frame". */
    const flowNodesRef = useRef(flowNodes);

    // --- Drag-time snap guides (OpenViz node alignment) ---------------------
    // React Flow v12 recomputes drag positions from the pointer on every
    // mousemove and emits them as position NodeChanges, so snapping is applied
    // by correcting those changes in `handleNodesChangeWithSnap` (the only
    // supported interception point). Guides are transient UI state — they never
    // touch node data or the store (spec 009 FR-005/FR-006).
    const snapTargetsRef = useRef<SnapTargetLines[]>([]);
    /** Sizes of the currently dragged nodes, cached at drag start (hot-path free). */
    const draggedSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map());
    /**
     * Last correction applied to the live drag. The committed position on drag
     * stop must add this back in, because React Flow reports the raw pointer
     * position (pre-correction) in `onNodeDragStop`.
     */
    const snapDeltaRef = useRef({ x: 0, y: 0 });
    /** Mirrors the last published guides so we skip setState on unchanged frames. */
    const snapGuidesRef = useRef<WorkbenchSnapGuides>({ xGuides: [], yGuides: [] });
    const [snapGuides, setSnapGuides] = useState<WorkbenchSnapGuides>({ xGuides: [], yGuides: [] });

    /** Publishes guides only when they actually changed (avoids per-frame setState). */
    const publishSnapGuides = useCallback((next: WorkbenchSnapGuides) => {
        const previous = snapGuidesRef.current;
        const sameGuide = (a: SnapGuideLine | undefined, b: SnapGuideLine | undefined) =>
            a?.value === b?.value && a?.kind === b?.kind
            && a?.from?.x === b?.from?.x && a?.from?.y === b?.from?.y
            && a?.to?.x === b?.to?.x && a?.to?.y === b?.to?.y;
        const sameList = (a: SnapGuideLine[], b: SnapGuideLine[]) =>
            a.length === b.length && a.every((guide, i) => sameGuide(guide, b[i]));
        if (sameList(previous.xGuides, next.xGuides) && sameList(previous.yGuides, next.yGuides)) {
            return;
        }
        snapGuidesRef.current = next;
        setSnapGuides(next);
    }, []);

    /** Id of the node currently being resized (for sync-effect protection). */
    const resizingNodeIdRef = useRef<string | null>(null);

    /** Prepares snap targets + dragged sizes. Call on node drag start. */
    const prepareNodeSnap = useCallback((draggedIds: Iterable<string>) => {
        const dragging = new Set(draggedIds);
        const sizes = new Map<string, { width: number; height: number }>();
        for (const node of nodes) {
            if (dragging.has(node.id)) {
                sizes.set(node.id, { width: node.measured?.width ?? node.width ?? 256, height: node.measured?.height ?? node.height ?? 256 });
            }
        }
        snapTargetsRef.current = buildSnapTargets(collectSnapTargets(nodes, (id) => dragging.has(id), nodeLocks));
        draggedSizesRef.current = sizes;
        snapDeltaRef.current = { x: 0, y: 0 };
        publishSnapGuides({ xGuides: [], yGuides: [] });
    }, [nodes, nodeLocks, publishSnapGuides]);

    const clearNodeSnap = useCallback(() => {
        snapTargetsRef.current = [];
        draggedSizesRef.current = new Map();
        snapDeltaRef.current = { x: 0, y: 0 };
        resizingNodeIdRef.current = null;
        resizeSnapStateRef.current = createResizeSnapState();
        publishSnapGuides({ xGuides: [], yGuides: [] });
    }, [publishSnapGuides, resizeSnapStateRef]);

    /** Final correction to fold into the committed position on drag stop. */
    const getSnapDelta = useCallback(() => ({ ...snapDeltaRef.current }), []);

    /**
     * Intercepts drag position changes and resize dimension changes and adds the
     * snap correction. Returns the (possibly corrected) changes to apply; passes
     * through untouched when nothing is being dragged/resized or no target
     * exists. Corrected copies are emitted instead of mutating RF's internal
     * change objects.
     */
    const handleNodesChangeWithSnap = useCallback((changes: NodeChange[]): NodeChange[] => {
        type DragPositionChange = Extract<NodeChange, { type: 'position' }> & { position: { x: number; y: number } };
        type ResizeDimensionChange = Extract<NodeChange, { type: 'dimensions' }> & { resizing: boolean; dimensions: { width: number; height: number } };

        // --- Resize path (single active resizer) ---------------------------
        let resizeChange: ResizeDimensionChange | null = null;
        let resizePositionChange: DragPositionChange | null = null;
        for (const change of changes) {
            if (change.type === 'dimensions' && typeof change.resizing === 'boolean') {
                resizeChange = change as ResizeDimensionChange;
            } else if (change.type === 'position' && change.position !== undefined && resizeChange && change.id === resizeChange.id) {
                // XYResizer emits a position change alongside dimensions when the
                // top/left edge moves (raw x is carried for top-edge resizes).
                resizePositionChange = change as DragPositionChange;
            }
        }

        if (resizeChange && resizeChange.resizing === false) {
            // Final frame: XYResizer emits only a dimensions change here (no position).
            // Fold the last stored correction in so the rendered node lands where it
            // snapped, then reset — `handleResizeEnd` reads this state for the commit.
            const state = resizeSnapStateRef.current;
            if (state.nodeId === resizeChange.id && state.corrected) {
                const corrected = state.corrected;
                resizingNodeIdRef.current = null;
                publishSnapGuides({ xGuides: [], yGuides: [] });
                return changes.map((change): NodeChange =>
                    // `add` changes carry no `id`; check the discriminant first so TS narrows.
                    change.type === 'dimensions' && change.id === resizeChange.id && change.dimensions
                        ? { ...change, dimensions: { width: corrected.width, height: corrected.height } }
                        : change,
                );
            }
            resizingNodeIdRef.current = null;
            publishSnapGuides({ xGuides: [], yGuides: [] });
            return changes;
        }

        if (resizeChange && resizeChange.resizing !== false) {
            const state = resizeSnapStateRef.current;
            const nodeId = resizeChange.id;
            const rawW = resizeChange.dimensions.width;
            const rawH = resizeChange.dimensions.height;
            const positionMovedX = resizePositionChange ? resizePositionChange.position.x : null;
            const positionMovedY = resizePositionChange ? resizePositionChange.position.y : null;

            if (state.nodeId !== nodeId) {
                // First frame of a new resize: capture start geometry from the last
                // committed bounds (the RF internal store already holds this frame's
                // raw size by the time we run, so it can't be trusted as "before").
                const flowNode = flowNodesRef.current.find((node) => node.id === nodeId);
                const start = flowNode ? getNodeBounds(flowNode) : null;
                state.nodeId = nodeId;
                state.start = start;
                state.targets = buildSnapTargets(collectSnapTargets(nodes, (id) => id === nodeId, nodeLocks));
                state.anchor = { x: false, y: false };
                state.axes = { x: false, y: false };
                state.lastRaw = null;
                state.correctedRaw = null;
                state.corrected = null;
                resizingNodeIdRef.current = nodeId;
            }

            const start = state.start;
            // Capture the mutable fields in locals — TS won't narrow `state.anchor`/
            // `state.axes` across mutations through the ref object.
            const anchor = state.anchor;
            const axes = state.axes;
            if (start && anchor && axes) {
                // Anchor inference: a position change in the batch means the left/top
                // edge is moving. Axis inference: a dimension differing from start
                // means that axis is changing size. Both flip false→true monotonically.
                if (resizePositionChange) {
                    if (positionMovedX !== null && start.x !== positionMovedX) anchor.x = true;
                    if (positionMovedY !== null && start.y !== positionMovedY) anchor.y = true;
                }
                if (rawW !== start.width) axes.x = true;
                if (rawH !== start.height) axes.y = true;

                const rawX = resizePositionChange ? positionMovedX ?? start.x : start.x;
                const rawY = resizePositionChange ? positionMovedY ?? start.y : start.y;
                const rawBounds: NodeBounds = { x: rawX, y: rawY, width: rawW, height: rawH };

                // Skip re-snap when the raw geometry is unchanged (XYResizer updates
                // its prevValues to the raw value each frame, so a no-op pointer move
                // would otherwise accumulate corrections).
                const lastRaw = state.lastRaw;
                const changed = !lastRaw || lastRaw.x !== rawX || lastRaw.y !== rawY || lastRaw.width !== rawW || lastRaw.height !== rawH;
                if (changed) {
                    state.lastRaw = rawBounds;
                    const zoom = latestViewportRef.current.zoom || 1;
                    const result = findBestResizeSnap(rawBounds, anchor, axes, state.targets, SNAP_THRESHOLD_SCREEN_PX / zoom);
                    // A frame with no in-threshold match clears any prior correction so
                    // the committed geometry falls back to raw (no stale snap).
                    state.correctedRaw = rawBounds;
                    state.corrected = { x: result.x ?? rawX, y: result.y ?? rawY, width: result.width ?? rawW, height: result.height ?? rawH };
                    publishSnapGuides({ xGuides: result.xGuides, yGuides: result.yGuides });
                }

                const corrected = state.corrected;
                if (corrected) {
                    return changes.map((change): NodeChange => {
                        if (change.type === 'add' || change.id !== nodeId) return change;
                        if (change.type === 'position' && change.position !== undefined) {
                            // Only correct position when an edge actually moved (the raw
                            // x is stale for top-edge resizes, so guard on anchor.x).
                            const cx = anchor.x ? corrected.x : change.position.x;
                            const cy = anchor.y ? corrected.y : change.position.y;
                            if (cx === change.position.x && cy === change.position.y) return change;
                            return { ...change, position: { x: cx, y: cy } };
                        }
                        if (change.type === 'dimensions' && change.dimensions) {
                            return { ...change, dimensions: { width: corrected.width, height: corrected.height } };
                        }
                        return change;
                    });
                }
            }
        }

        // --- Drag path ------------------------------------------------------
        const draggingIds = draggingNodeIdsRef.current;
        if (draggingIds.size === 0 || snapTargetsRef.current.length === 0) return changes;

        let positionChanges: DragPositionChange[] | null = null;
        for (const change of changes) {
            // `position` is optional on the union (absent at drag end); only live moves carry it.
            if (change.type === 'position' && change.position !== undefined && draggingIds.has(change.id)) {
                (positionChanges ??= []).push(change as DragPositionChange);
            }
        }
        if (!positionChanges || positionChanges.length === 0) return changes;

        const boundsList = positionChanges.map((change) => {
            const size = draggedSizesRef.current.get(change.id);
            return { x: change.position.x, y: change.position.y, width: size?.width ?? 256, height: size?.height ?? 256 };
        });
        const groupBounds = getGroupBounds(boundsList);
        if (!groupBounds) return changes;

        const zoom = latestViewportRef.current.zoom || 1;
        // React Flow always emits the raw pointer position on every drag frame
        // (it never reads our correction back into its drag items), so the delta
        // is computed fresh from these raw bounds each frame — no accumulation.
        const result = findBestSnap(groupBounds, snapTargetsRef.current, SNAP_THRESHOLD_SCREEN_PX / zoom);
        snapDeltaRef.current = { x: result.deltaX, y: result.deltaY };
        publishSnapGuides({ xGuides: result.xGuides, yGuides: result.yGuides });

        if (result.deltaX === 0 && result.deltaY === 0) return changes;
        const snapChangedIds = new Set(positionChanges.map((change) => change.id));
        return changes.map((change): NodeChange => {
            if (change.type !== 'position' || !snapChangedIds.has(change.id) || change.position === undefined) return change;
            return { ...change, position: { x: change.position.x + result.deltaX, y: change.position.y + result.deltaY } };
        });
    }, [draggingNodeIdsRef, nodes, nodeLocks, publishSnapGuides, resizeSnapStateRef]);

    /** Last committed (rendered) geometry — updated after every render so resize-start capture reads the pre-frame bounds. */
    useEffect(() => {
        flowNodesRef.current = flowNodes;
    }, [flowNodes]);

    useEffect(() => {
        setFlowNodes((currentNodes) => {
            const draggingNodeIds = draggingNodeIdsRef.current;
            if (draggingNodeIds.size > 0) return currentNodes;

            // While a node is being resized, the store holds RAW sizes (written by
            // the node's onResize callback before our correction lands). The
            // corrected geometry lives in flowNodes — don't let a store recompute
            // overwrite it mid-gesture.
            const resizingNodeId = resizingNodeIdRef.current;

            const currentById = new Map(currentNodes.map((node) => [node.id, node]));
            let changed = currentNodes.length !== nodes.length;
            const nextNodes = nodes.map((node) => {
                const currentNode = currentById.get(node.id);
                if (!currentNode) {
                    changed = true;
                    return node;
                }

                if (node.id === resizingNodeId) return currentNode;

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
        // Node alignment (drag-time snap guides)
        prepareNodeSnap,
        clearNodeSnap,
        handleNodesChangeWithSnap,
        getSnapDelta,
        snapGuides,
    };
}
