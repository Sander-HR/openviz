/**
 * Pure drag-time snapping math for workbench node alignment (workbench design).
 *
 * While a node (or a group of nodes) is dragged, its bounding box produces
 * candidate lines (left / center-x / right and top / center-y / bottom). Each
 * candidate is compared against the same lines of every static node; the best
 * match per axis within a threshold yields a correction delta to apply to all
 * dragged nodes plus the guide-line coordinates to render.
 *
 * This module is dependency-free on purpose: it must stay cheap enough to run
 * on every drag frame (spec 009 FR-005 hot-path budget).
 */

export interface NodeBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Minimal structural shape of a React Flow node for bounds resolution. */
export interface SnapNodeLike {
    id: string;
    position: { x: number; y: number };
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number } | null;
}

/** Precomputed snap lines for one static node (built once per drag start). */
export interface SnapTargetLines {
    /** Vertical lines in flow space: [left, centerX, right]. */
    vertical: number[];
    /** Horizontal lines in flow space: [top, centerY, bottom]. */
    horizontal: number[];
    /** Full bounds of the target node (for resolving guide endpoints). */
    bounds: NodeBounds;
}

export type SnapGuideKind = 'edge' | 'center';

/** Vertical or horizontal guide line in flow (world) space. */
export interface SnapGuideLine {
    /** Coordinate of the matched static node's line in flow space. */
    value: number;
    kind: SnapGuideKind;
    /** Segment start (flow space). Center guides: corrected drag center → target center. Edge guides: the snapped node's two corners on the line. */
    from?: { x: number; y: number };
    /** Segment end (flow space). */
    to?: { x: number; y: number };
}

export interface SnapResult {
    /** Flow-space correction to add to every dragged node's position.x. */
    deltaX: number;
    /** Flow-space correction to add to every dragged node's position.y. */
    deltaY: number;
    /** Vertical guide lines to render (one per aligned line on the x axis). */
    xGuides: SnapGuideLine[];
    /** Horizontal guide lines to render (one per aligned line on the y axis). */
    yGuides: SnapGuideLine[];
}

/** Corrected geometry + guides for a single-node resize. */
export interface ResizeSnapResult {
    /** Corrected left edge (only set when the left edge moves, i.e. anchor.x). */
    x?: number;
    /** Corrected width (always set when the horizontal axis is being resized). */
    width?: number;
    /** Corrected top edge (only set when the top edge moves, i.e. anchor.y). */
    y?: number;
    /** Corrected height (always set when the vertical axis is being resized). */
    height?: number;
    xGuides: SnapGuideLine[];
    yGuides: SnapGuideLine[];
}

/** Which edges move during a resize. `x` = left edge moves, `y` = top edge moves. */
export interface ResizeAnchor {
    x: boolean;
    y: boolean;
}

/**
 * Which axes are actually changing size (from the dimension change's
 * `setAttributes`). A pure top-edge resize only changes height, so its width
 * axis must not be considered for snapping even though an anchor exists.
 */
export interface ResizeAxes {
    x: boolean;
    y: boolean;
}

const NO_SNAP: SnapResult = { deltaX: 0, deltaY: 0, xGuides: [], yGuides: [] };

/** Bounded number of guide lines rendered per axis (keeps the overlay DOM small). */
const MAX_GUIDES_PER_AXIS = 3;

/**
 * Resolves a node's bounds in flow space. Prefers React Flow's measured size
 * (post-mount truth) and falls back to the explicit width/height set by
 * `useWorkbenchGraph`, then to the shared 256px default.
 */
export function getNodeBounds(node: SnapNodeLike): NodeBounds {
    const width = node.measured?.width ?? node.width ?? 256;
    const height = node.measured?.height ?? node.height ?? 256;
    return { x: node.position.x, y: node.position.y, width, height };
}

/** Bounding box enclosing every given bounds (single item returns itself). */
export function getGroupBounds(boundsList: NodeBounds[]): NodeBounds | null {
    if (boundsList.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const bounds of boundsList) {
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Candidate lines for one axis of a bounds: edges plus center. */
export function getCandidateLines(bounds: NodeBounds): { vertical: number[]; horizontal: number[] } {
    return {
        vertical: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
        horizontal: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height],
    };
}

/** Precomputes snap lines for every static node (call once per drag start). */
export function buildSnapTargets(staticNodes: SnapNodeLike[]): SnapTargetLines[] {
    return staticNodes.map((node) => {
        const bounds = getNodeBounds(node);
        const { vertical, horizontal } = getCandidateLines(bounds);
        return { vertical, horizontal, bounds };
    });
}

/** A snap target that also carries its React Flow z-index for occlusion checks. */
export interface OccludableNode extends SnapNodeLike {
    /** Explicit React Flow `zIndex`; when absent, array order decides stacking. */
    zIndex?: number;
}

/**
 * Drops targets that are fully hidden behind another node rendered on top of
 * them (e.g. a small node sitting entirely under a larger one). A target is
 * occluded only when some higher-stacked node's bounds fully contain it —
 * partial overlaps keep both, since the covered node is still partly visible.
 *
 * Stacking order mirrors React Flow: explicit `zIndex` wins, ties (and nodes
 * without one) fall back to array index (later items render on top). Runs once
 * per gesture start, not per frame, so O(n²) containment checks are acceptable.
 */
export function filterOccludedNodes(nodes: OccludableNode[]): OccludableNode[] {
    const order = nodes.map((node, index) => node.zIndex ?? index);
    return nodes.filter((node, i) => {
        const b = getNodeBounds(node);
        for (let j = 0; j < nodes.length; j++) {
            if (j === i || order[j] <= order[i]) continue; // only nodes on top can occlude
            const c = getNodeBounds(nodes[j]);
            if (c.x <= b.x && c.y <= b.y && c.x + c.width >= b.x + b.width && c.y + c.height >= b.y + b.height) {
                return false; // fully covered by a node above → hidden
            }
        }
        return true;
    });
}

/** A single in-threshold alignment between a moved line and a target line. */
interface AxisMatch {
    /** `targetLine - candidate` — the correction that would land the line. */
    delta: number;
    /** Coordinate of the matched static node's line (the guide position). */
    guide: number;
    /** Index of the matched target node (for endpoint resolution). */
    targetIndex: number;
    /** True only when BOTH matched lines are centers (moved center ↔ target center). */
    isCenter: boolean;
}

/**
 * Collects every alignment within `thresholdFlowPx` between the moved bounds'
 * candidate lines and each static target's lines on one axis. Returns matches
 * sorted by closeness (closest first) so callers can snap to `[0]` while still
 * rendering the rest as guides. Replaces the old single-best `bestAxisMatch`.
 *
 * @param centerIndex index of the moved bounds' center line within `candidates`
 *   (drag uses 1 for [edge, center, edge]; resize uses 0 or 1 depending on which
 *   edge is moving). A match is "center" only when both sides are centers.
 */
function collectAxisMatches(
    candidates: number[],
    targets: SnapTargetLines[],
    axis: 'vertical' | 'horizontal',
    thresholdFlowPx: number,
    centerIndex: number,
): AxisMatch[] {
    const matches: AxisMatch[] = [];
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
        const lines = targets[targetIndex][axis];
        for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const delta = lines[lineIndex] - candidates[candidateIndex];
                if (Math.abs(delta) > thresholdFlowPx) continue;
                matches.push({
                    delta,
                    guide: lines[lineIndex],
                    targetIndex,
                    isCenter: candidateIndex === centerIndex && lineIndex === 1,
                });
            }
        }
    }
    // Closest first; on exact ties prefer center-to-center (stable, meaningful).
    matches.sort((a, b) => {
        const da = Math.abs(a.delta);
        const db = Math.abs(b.delta);
        if (da !== db) return da - db;
        if (a.isCenter !== b.isCenter) return a.isCenter ? -1 : 1;
        return a.guide - b.guide;
    });
    return matches;
}

/**
 * Builds guide lines for an axis, scoped to the NEAREST target node only —
 * the node that owns the closest match (`matches[0]`). Lines from other nodes
 * that happen to fall within threshold are intentionally not drawn, so guides
 * always describe a single, unambiguous alignment. A node has at most three
 * lines per axis, so `MAX_GUIDES_PER_AXIS` is a natural (defensive) cap.
 *
 * - Center guides run from the corrected moved center to the target's center
 *   (both exactly on the matched line) — a short, clearly "centered" segment.
 * - Edge guides span the union of both bounds along the perpendicular axis, so
 *   they run from the snapped node's far endpoint to the moved node's far
 *   endpoint (× marks at each extreme).
 */
function buildAxisGuides(
    matches: AxisMatch[],
    axis: 'vertical' | 'horizontal',
    movedBounds: NodeBounds,
    targetLines: SnapTargetLines[],
    correctedCenter: { x: number; y: number },
): SnapGuideLine[] {
    if (matches.length === 0) return [];
    // Only the nearest node's lines are rendered.
    const nearestTarget = matches[0].targetIndex;
    const guides: SnapGuideLine[] = [];
    const seen = new Set<number>();
    for (const match of matches) {
        if (guides.length >= MAX_GUIDES_PER_AXIS) break;
        if (match.targetIndex !== nearestTarget) continue;
        // Dedup by coordinate so a node's coincident lines don't double-render.
        if (seen.has(match.guide)) continue;
        seen.add(match.guide);

        const target = targetLines[match.targetIndex];
        const guide: SnapGuideLine = { value: match.guide, kind: match.isCenter ? 'center' : 'edge' };
        if (match.isCenter) {
            guide.from = correctedCenter;
            guide.to = { x: target.bounds.x + target.bounds.width / 2, y: target.bounds.y + target.bounds.height / 2 };
        } else if (axis === 'vertical') {
            // Vertical line at `value`: top of the higher node → bottom of the lower.
            const y1 = Math.min(target.bounds.y, movedBounds.y);
            const y2 = Math.max(target.bounds.y + target.bounds.height, movedBounds.y + movedBounds.height);
            guide.from = { x: match.guide, y: y1 };
            guide.to = { x: match.guide, y: y2 };
        } else {
            // Horizontal line at `value`: left of the further node → right of the other.
            const x1 = Math.min(target.bounds.x, movedBounds.x);
            const x2 = Math.max(target.bounds.x + target.bounds.width, movedBounds.x + movedBounds.width);
            guide.from = { x: x1, y: match.guide };
            guide.to = { x: x2, y: match.guide };
        }
        guides.push(guide);
    }
    return guides;
}

/**
 * Finds the snap per axis for a dragged group against precomputed targets.
 * Corrects to the globally closest line; guides are drawn only for that
 * nearest target node's aligned lines (see `buildAxisGuides`).
 *
 * @param groupBounds bounding box of all dragged nodes (or the single node).
 * @param targetLines precomputed lines of every static node (`buildSnapTargets`).
 * @param thresholdFlowPx maximum flow-space distance for a match to count.
 */
export function findBestSnap(
    groupBounds: NodeBounds,
    targetLines: SnapTargetLines[],
    thresholdFlowPx: number,
): SnapResult {
    if (thresholdFlowPx <= 0 || targetLines.length === 0) return NO_SNAP;

    // Drag candidates are [edge, center, edge] on both axes → center is index 1.
    const candidates = getCandidateLines(groupBounds);
    const xMatches = collectAxisMatches(candidates.vertical, targetLines, 'vertical', thresholdFlowPx, 1);
    const yMatches = collectAxisMatches(candidates.horizontal, targetLines, 'horizontal', thresholdFlowPx, 1);

    if (xMatches.length === 0 && yMatches.length === 0) return NO_SNAP;
    // The rendered (corrected) group center lands exactly on the snapped line,
    // so center guides are drawn from here — perfectly axis-aligned.
    const deltaX = xMatches[0]?.delta ?? 0;
    const deltaY = yMatches[0]?.delta ?? 0;
    const correctedCenter = {
        x: groupBounds.x + groupBounds.width / 2 + deltaX,
        y: groupBounds.y + groupBounds.height / 2 + deltaY,
    };
    return {
        deltaX,
        deltaY,
        xGuides: buildAxisGuides(xMatches, 'vertical', groupBounds, targetLines, correctedCenter),
        yGuides: buildAxisGuides(yMatches, 'horizontal', groupBounds, targetLines, correctedCenter),
    };
}

/**
 * Computes the corrected geometry + guides for a single-node resize.
 *
 * Only the lines that can move (per `anchor`) are snap candidates — the fixed
 * edge cannot move, so matching it would be wrong. The closest match per axis
 * is applied: moving-edge matches reposition that edge (adjusting width/height,
 * and x/y when the left/top edge moves); center matches re-center the node
 * around its fixed edge. All aligned lines are returned as guides.
 */
export function findBestResizeSnap(
    bounds: NodeBounds,
    anchor: ResizeAnchor,
    axes: ResizeAxes,
    targetLines: SnapTargetLines[],
    thresholdFlowPx: number,
): ResizeSnapResult {
    const result: ResizeSnapResult = { xGuides: [], yGuides: [] };
    if (thresholdFlowPx <= 0 || targetLines.length === 0) return result;

    const left = bounds.x;
    const right = bounds.x + bounds.width;
    const top = bounds.y;
    const bottom = bounds.y + bounds.height;
    // Movable lines per axis: center always, plus only the moving edge. The fixed
    // edge cannot move, so it is excluded from snap candidates. An axis that is
    // not changing size (e.g. width during a pure top-edge resize) is skipped.
    const xCandidates = anchor.x ? [left, left + bounds.width / 2] : [left + bounds.width / 2, right];
    const yCandidates = anchor.y ? [top, top + bounds.height / 2] : [top + bounds.height / 2, bottom];

    // Center line index within each candidate set (anchor.x=false → center is first).
    const xCenterIndex = anchor.x ? 1 : 0;
    const yCenterIndex = anchor.y ? 1 : 0;

    const xMatches = axes.x
        ? collectAxisMatches(xCandidates, targetLines, 'vertical', thresholdFlowPx, xCenterIndex)
        : [];
    const yMatches = axes.y
        ? collectAxisMatches(yCandidates, targetLines, 'horizontal', thresholdFlowPx, yCenterIndex)
        : [];

    // Apply the closest match per axis to derive the corrected geometry.
    let correctedX = bounds.x;
    let correctedY = bounds.y;
    let correctedW = bounds.width;
    let correctedH = bounds.height;

    const xBest = xMatches[0];
    if (xBest) {
        if (xBest.isCenter) {
            // Center match: re-center around the fixed edge.
            if (anchor.x) {
                correctedX = 2 * xBest.guide - right;
                correctedW = right - correctedX;
            } else {
                correctedW = 2 * (xBest.guide - left);
            }
        } else if (anchor.x) {
            // Left edge match: x = line, width = right - line.
            correctedX = xBest.guide;
            correctedW = right - correctedX;
        } else {
            // Right edge match: width = line - left.
            correctedW = xBest.guide - left;
        }
    }

    const yBest = yMatches[0];
    if (yBest) {
        if (yBest.isCenter) {
            // Center match: re-center around the fixed edge.
            if (anchor.y) {
                correctedY = 2 * yBest.guide - bottom;
                correctedH = bottom - correctedY;
            } else {
                correctedH = 2 * (yBest.guide - top);
            }
        } else if (anchor.y) {
            // Top edge match: y = line, height = bottom - line.
            correctedY = yBest.guide;
            correctedH = bottom - correctedY;
        } else {
            // Bottom edge match: height = line - top.
            correctedH = yBest.guide - top;
        }
    }

    // Center guides run from the corrected center to the target's center.
    const correctedCenter = { x: correctedX + correctedW / 2, y: correctedY + correctedH / 2 };
    result.xGuides = buildAxisGuides(xMatches, 'vertical', bounds, targetLines, correctedCenter);
    result.yGuides = buildAxisGuides(yMatches, 'horizontal', bounds, targetLines, correctedCenter);

    // Only emit geometry fields that actually changed.
    if (correctedX !== bounds.x) result.x = correctedX;
    if (correctedW !== bounds.width) result.width = correctedW;
    if (correctedY !== bounds.y) result.y = correctedY;
    if (correctedH !== bounds.height) result.height = correctedH;

    return result;
}

/** Convenience overload: computes target lines inline (used by tests). */
export function findBestSnapForNodes(
    groupBounds: NodeBounds,
    staticNodes: SnapNodeLike[],
    thresholdFlowPx: number,
): SnapResult {
    return findBestSnap(groupBounds, buildSnapTargets(staticNodes), thresholdFlowPx);
}

/**
 * Shared live-resize snap state. Written by the canvas projection on every
 * resize frame and read by `useWorkbenchNodeHandlers.handleResizeEnd` so the
 * committed geometry matches what was rendered (the last correction is folded
 * into the commit). Kept in a ref so it survives re-renders without triggering
 * them. Only one resizer can be active at a time, so this tracks a single node.
 */
export interface ResizeSnapState {
    /** Id of the node currently being resized (null when idle). */
    nodeId: string | null;
    /** Precomputed snap lines of every static node (built once per resize start). */
    targets: SnapTargetLines[];
    /** Geometry at resize start (last committed bounds, before any frame). */
    start: NodeBounds | null;
    anchor: ResizeAnchor | null;
    axes: ResizeAxes | null;
    /** Last raw (un-corrected) geometry processed — skips re-snap on no-op frames. */
    lastRaw: NodeBounds | null;
    /** Raw geometry the `corrected` values were computed from. */
    correctedRaw: NodeBounds | null;
    /** Last corrected geometry — folded into the commit by `handleResizeEnd`. */
    corrected: NodeBounds | null;
}

export function createResizeSnapState(): ResizeSnapState {
    return { nodeId: null, targets: [], start: null, anchor: null, axes: null, lastRaw: null, correctedRaw: null, corrected: null };
}

export type ResizeSnapStateRef = { current: ResizeSnapState };
