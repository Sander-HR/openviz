import { useViewport } from '@xyflow/react';

import { useStore } from '@/store/useStore';
import type { WorkbenchNode } from '@/types';

/**
 * Overlay anchoring math for the floating workbench overlays (ui-translation §5).
 *
 * Screen position = node.positionAbsolute × viewport transform, recomputed on
 * every `useViewport()` change — no per-frame rAF. Panels anchor BELOW their
 * node by default (8px gap) and flip ABOVE when the panel bottom would exceed
 * container height − 16px; horizontal position clamps to [16px, width − 16px].
 */

export interface ViewportLike {
    x: number;
    y: number;
    zoom: number;
}

/** Flow-space bounds of the anchor node (positionAbsolute + measured size). */
export interface OverlayAnchor {
    nodeId: string;
    flowX: number;
    flowY: number;
    width: number;
    height: number;
}

export interface SizeLike {
    width: number;
    height: number;
}

export interface OverlayPosition {
    /** Left edge of the panel in screen (wrapper) coordinates. */
    left: number;
    /** Top edge of the panel in screen (wrapper) coordinates. */
    top: number;
    /** True when the panel was flipped above the node to avoid overflow. */
    flipped: boolean;
}

const EDGE_MARGIN = 16;
const ANCHOR_GAP = 8;

/**
 * Maps a flow-space anchor through the viewport transform into screen
 * coordinates for a panel of `panelSize`, applying the §5 collision rules.
 */
export function computeOverlayPosition(
    anchor: OverlayAnchor,
    viewport: ViewportLike,
    panelSize: SizeLike,
    containerSize: SizeLike,
): OverlayPosition {
    const screenX = (anchor.flowX + anchor.width / 2) * viewport.zoom + viewport.x;
    const screenTop = anchor.flowY * viewport.zoom + viewport.y;

    const belowTop = screenTop + ANCHOR_GAP;
    const flipped = belowTop + panelSize.height > containerSize.height - EDGE_MARGIN;
    const top = flipped ? screenTop - ANCHOR_GAP - panelSize.height : belowTop;

    const left = Math.min(
        Math.max(screenX - panelSize.width / 2, EDGE_MARGIN),
        Math.max(EDGE_MARGIN, containerSize.width - EDGE_MARGIN - panelSize.width),
    );

    return { left, top, flipped };
}

/** Structural minimum the anchor resolution needs (ids only). */
export interface OverlayAnchorStoreState {
    workbenchNodes: ReadonlyArray<Pick<WorkbenchNode, 'id'>>;
    selectedNodeIds: readonly string[];
    activeNodeId: string | null;
}

/**
 * Only the **active** (last-clicked) node anchors a toolbar/panel (§5). Falls
 * back to the last selected node when no active id is recorded.
 */
export function resolveAnchorNodeId(state: OverlayAnchorStoreState): string | null {
    if (state.selectedNodeIds.length === 0) return null;
    if (state.activeNodeId && state.selectedNodeIds.includes(state.activeNodeId)) {
        return state.activeNodeId;
    }
    return state.selectedNodeIds[state.selectedNodeIds.length - 1] ?? null;
}

export interface OverlayAnchorResult {
    nodeId: string;
    /** Screen x of the node's top-center (wrapper coordinates). */
    screenX: number;
    /** Screen y of the node's top edge (wrapper coordinates). */
    screenY: number;
    width: number;
    height: number;
}

/**
 * Resolves the anchor node for floating overlays and exposes its top-center in
 * screen coordinates. Re-renders on viewport changes via `useViewport()` and on
 * selection changes via the store subscription. Returns null when nothing is
 * selected.
 */
export function useOverlayAnchoring(): OverlayAnchorResult | null {
    const workbenchNodes = useStore((state) => state.workbenchNodes);
    const selectedNodeIds = useStore((state) => state.selectedNodeIds);
    const activeNodeId = useStore((state) => state.activeNodeId);
    const viewport = useViewport();

    const anchorId = resolveAnchorNodeId({ workbenchNodes, selectedNodeIds, activeNodeId });
    if (!anchorId) return null;

    const node = workbenchNodes.find((candidate) => candidate.id === anchorId);
    if (!node) return null;

    const width = node.width ?? 280;
    const height = node.height ?? 160;

    return {
        nodeId: node.id,
        screenX: (node.x + width / 2) * viewport.zoom + viewport.x,
        screenY: node.y * viewport.zoom + viewport.y,
        width,
        height,
    };
}
