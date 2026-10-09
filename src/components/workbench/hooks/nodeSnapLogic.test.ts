import { describe, expect, it } from 'vitest';
import {
    buildSnapTargets,
    filterOccludedNodes,
    findBestResizeSnap,
    findBestSnap,
    getCandidateLines,
    getGroupBounds,
    getNodeBounds,
    type NodeBounds,
    type OccludableNode,
    type ResizeAnchor,
    type SnapNodeLike,
} from './nodeSnapLogic';

/** Test helper: snap against raw static nodes (builds targets inline). */
function snap(groupBounds: NodeBounds, staticNodes: SnapNodeLike[], thresholdFlowPx: number) {
    return findBestSnap(groupBounds, buildSnapTargets(staticNodes), thresholdFlowPx);
}

/** Test helper: resize-snap a single node's bounds against raw static nodes. */
function resizeSnap(
    bounds: NodeBounds,
    anchor: ResizeAnchor,
    staticNodes: SnapNodeLike[],
    thresholdFlowPx: number,
) {
    // Both axes active by default (corner handle); individual tests override.
    return findBestResizeSnap(bounds, anchor, { x: true, y: true }, buildSnapTargets(staticNodes), thresholdFlowPx);
}

/** Test helper with explicit per-axis activity (edge handles). */
function resizeSnapAxes(
    bounds: NodeBounds,
    anchor: ResizeAnchor,
    axes: { x: boolean; y: boolean },
    staticNodes: SnapNodeLike[],
    thresholdFlowPx: number,
) {
    return findBestResizeSnap(bounds, anchor, axes, buildSnapTargets(staticNodes), thresholdFlowPx);
}

/**
 * Convention: `deltaX/deltaY` is the correction to ADD to a dragged node's
 * position so its line lands on the matched static line (delta = line - candidate).
 *
 * TARGET spans x 500..700 (lines 500/600/700), y 300..400 (lines 300/350/400).
 */
function makeNode(overrides: Partial<OccludableNode> & { id: string; position: { x: number; y: number } }): OccludableNode {
    return { width: 200, height: 100, ...overrides };
}

const TARGET = makeNode({ id: 'target', position: { x: 500, y: 300 } });

describe('getNodeBounds', () => {
    it('prefers measured size over explicit width/height', () => {
        const node = makeNode({ id: 'a', position: { x: 10, y: 20 }, width: 100, height: 50, measured: { width: 120, height: 60 } });
        expect(getNodeBounds(node)).toEqual({ x: 10, y: 20, width: 120, height: 60 });
    });

    it('falls back to explicit size, then to the 256 default', () => {
        expect(getNodeBounds(makeNode({ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 50 }))).toEqual(
            { x: 0, y: 0, width: 100, height: 50 },
        );
        expect(getNodeBounds(makeNode({ id: 'a', position: { x: 0, y: 0 }, width: undefined, height: undefined }))).toEqual(
            { x: 0, y: 0, width: 256, height: 256 },
        );
    });
});

describe('getGroupBounds', () => {
    it('returns null for an empty list', () => {
        expect(getGroupBounds([])).toBeNull();
    });

    it('returns the single bounds unchanged', () => {
        const bounds: NodeBounds = { x: 5, y: 6, width: 10, height: 20 };
        expect(getGroupBounds([bounds])).toEqual(bounds);
    });

    it('encloses multiple disjoint bounds', () => {
        const group = getGroupBounds([
            { x: 0, y: 0, width: 100, height: 50 },
            { x: 40, y: 30, width: 80, height: 60 },
        ]);
        expect(group).toEqual({ x: 0, y: 0, width: 120, height: 90 });
    });
});

describe('getCandidateLines', () => {
    it('emits edges and center per axis', () => {
        const lines = getCandidateLines({ x: 10, y: 20, width: 100, height: 50 });
        expect(lines.vertical).toEqual([10, 60, 110]);
        expect(lines.horizontal).toEqual([20, 45, 70]);
    });
});

describe('filterOccludedNodes', () => {
    it('drops a node fully covered by one rendered on top (later in array)', () => {
        const big = makeNode({ id: 'big', position: { x: 0, y: 0 }, width: 400, height: 300 });
        const hidden = makeNode({ id: 'hidden', position: { x: 50, y: 50 }, width: 100, height: 80 }); // inside big
        // Array order [hidden, big] → big (index 1) is on top and contains hidden.
        const filtered = filterOccludedNodes([hidden, big]);
        expect(filtered.map((n) => n.id)).toEqual(['big']);
    });

    it('keeps a node that only partially overlaps the one above', () => {
        const big = makeNode({ id: 'big', position: { x: 0, y: 0 }, width: 200, height: 200 });
        const partial = makeNode({ id: 'partial', position: { x: 150, y: 150 }, width: 100, height: 100 }); // sticks out
        const filtered = filterOccludedNodes([partial, big]);
        expect(filtered.map((n) => n.id).sort()).toEqual(['big', 'partial']);
    });

    it('respects explicit zIndex over array order', () => {
        const bottom = makeNode({ id: 'bottom', position: { x: 0, y: 0 }, width: 400, height: 300, zIndex: 10 });
        const hidden = makeNode({ id: 'hidden', position: { x: 50, y: 50 }, width: 100, height: 80, zIndex: 1 });
        // bottom has the higher zIndex → on top → occludes hidden even though listed first.
        const filtered = filterOccludedNodes([bottom, hidden]);
        expect(filtered.map((n) => n.id)).toEqual(['bottom']);
    });

    it('keeps every node when none is fully covered', () => {
        const a = makeNode({ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 100 });
        const b = makeNode({ id: 'b', position: { x: 200, y: 200 }, width: 100, height: 100 });
        expect(filterOccludedNodes([a, b]).map((n) => n.id)).toEqual(['a', 'b']);
    });
});

describe('findBestSnap', () => {
    it('renders every aligned line at once and corrects to the closest (center wins ties)', () => {
        // dragged at (492,305): vertical lines 492/592/692 → +8 on EVERY target line;
        // horizontal 305/355/405 → -5 on every target line. All six align within threshold.
        const dragged = makeNode({ id: 'drag', position: { x: 492, y: 305 } });
        const result = snap(getNodeBounds(dragged), [TARGET], 10);
        expect(result.deltaX).toBe(8);
        expect(result.deltaY).toBe(-5);
        // All three vertical guides render; closest (center) sorts first.
        expect(result.xGuides.map((g) => g.value)).toEqual([600, 500, 700]);
        expect(result.xGuides[0].kind).toBe('center');
        expect(result.xGuides[1].kind).toBe('edge');
        // Center guide runs corrected drag center → target center (perfectly aligned here).
        expect(result.xGuides[0].from).toEqual({ x: 600, y: 350 });
        expect(result.xGuides[0].to).toEqual({ x: 600, y: 350 });
        // Edge guides span the union of both nodes' vertical extents (300..405).
        expect(result.xGuides[1].from).toEqual({ x: 500, y: 300 });
        expect(result.xGuides[1].to).toEqual({ x: 500, y: 405 });
        // Horizontal guides likewise.
        expect(result.yGuides.map((g) => g.value)).toEqual([350, 300, 400]);
        expect(result.yGuides[0].kind).toBe('center');
    });

    it('snaps the top edge to the target bottom edge', () => {
        // dragged at (520,406): top=406 vs target bottom=400 → -6; no other line in range.
        const dragged = makeNode({ id: 'drag', position: { x: 520, y: 406 } });
        const result = snap(getNodeBounds(dragged), [TARGET], 10);
        expect(result.deltaY).toBe(-6);
        expect(result.xGuides).toHaveLength(0);
        expect(result.yGuides).toHaveLength(1);
        expect(result.yGuides[0].value).toBe(400);
        expect(result.yGuides[0].kind).toBe('edge'); // top edge ↔ target bottom edge
        // Edge guides bridge both nodes: union of their horizontal extents (500..720).
        expect(result.yGuides[0].from).toEqual({ x: 500, y: 400 });
        expect(result.yGuides[0].to).toEqual({ x: 720, y: 400 });
    });

    it('spans edge guides from the snapped node to the moved node far endpoint', () => {
        // Dragged right edge (498) is +2 from the target left edge (500); no horizontal line in range.
        // Drag spans y 5..105, target spans y 300..400 → vertical union 5..400.
        const dragged = makeNode({ id: 'drag', position: { x: 398, y: 5 }, width: 100, height: 100 });
        const result = snap(getNodeBounds(dragged), [TARGET], 10);
        expect(result.deltaX).toBe(2);
        expect(result.yGuides).toHaveLength(0);
        expect(result.xGuides[0].value).toBe(500);
        expect(result.xGuides[0].kind).toBe('edge');
        // Endpoints are the far endpoints of both nodes on that line.
        expect(result.xGuides[0].from).toEqual({ x: 500, y: 5 });
        expect(result.xGuides[0].to).toEqual({ x: 500, y: 400 });
    });

    it('marks center-to-center matches with endpoints on both centers', () => {
        // Drag 100×80 at (550,240): center-x 600 ↔ target center-x 600 (d=0); no horizontal line in range.
        const dragged = makeNode({ id: 'drag', position: { x: 550, y: 240 }, width: 100, height: 80 });
        const result = snap(getNodeBounds(dragged), [TARGET], 10);
        expect(result.deltaX).toBe(0);
        expect(result.xGuides[0].kind).toBe('center');
        // `from` is the corrected drag center (on the guide line), `to` the target center.
        expect(result.xGuides[0].from).toEqual({ x: 600, y: 280 });
        expect(result.xGuides[0].to).toEqual({ x: 600, y: 350 });
        expect(result.yGuides).toHaveLength(0);
    });

    it('keeps edge kind when only one side of the match is a center', () => {
        // Drag 180×100 at (497,346): left=497 → +3 to target left (500), no center tie (widths differ);
        // top=346 → +4 to target center-y (350) — edge↔center stays an edge guide.
        const dragged = makeNode({ id: 'drag', position: { x: 497, y: 346 }, width: 180 });
        const result = snap(getNodeBounds(dragged), [TARGET], 10);
        expect(result.xGuides[0].value).toBe(500);
        expect(result.xGuides[0].kind).toBe('edge'); // left ↔ left
        expect(result.yGuides[0].value).toBe(350);
        expect(result.yGuides[0].kind).toBe('edge'); // drag top edge ↔ target center-y
    });

    it('draws guides only for the nearest target node', () => {
        // Two static targets both have a left edge within threshold of the dragged
        // left edge (497): t1 at 500 (d=+3) and t2 at 498 (d=+1, the nearest).
        const t1 = makeNode({ id: 't1', position: { x: 500, y: 300 } }); // left 500 (d=+3)
        const t2 = makeNode({ id: 't2', position: { x: 498, y: 600 } }); // left 498 (d=+1)
        const dragged = makeNode({ id: 'drag', position: { x: 497, y: 346 }, width: 180 });
        const result = snap(getNodeBounds(dragged), [t1, t2], 10);
        // Corrects to the closest (498) and renders only that node's aligned line —
        // t1's in-threshold line (500) is intentionally NOT drawn.
        expect(result.deltaX).toBe(1);
        expect(result.xGuides.map((g) => g.value)).toEqual([498]);
    });

    it('respects the threshold boundary (inside vs outside)', () => {
        const inside = makeNode({ id: 'drag', position: { x: 490, y: 320 } }); // offset exactly 10 → in range
        expect(snap(getNodeBounds(inside), [TARGET], 10).deltaX).toBe(10);

        const outside = makeNode({ id: 'drag', position: { x: 489, y: 320 } }); // offset 11 → out of range
        const result = snap(getNodeBounds(outside), [TARGET], 10);
        expect(result.deltaX).toBe(0);
        expect(result.xGuides).toHaveLength(0);
    });

    it('returns no snap for an empty static list or non-positive threshold', () => {
        const dragged = makeNode({ id: 'drag', position: { x: 500, y: 300 } });
        expect(snap(getNodeBounds(dragged), [], 10)).toEqual({ deltaX: 0, deltaY: 0, xGuides: [], yGuides: [] });
        expect(snap(getNodeBounds(dragged), [TARGET], 0).deltaX).toBe(0);
    });

    it('picks the globally closest line across multiple static nodes', () => {
        const farTarget = makeNode({ id: 'far', position: { x: 100, y: 300 } }); // lines 100/200/300 (all far away)
        const dragged = makeNode({ id: 'drag', position: { x: 497, y: 320 } }); // +3 to TARGET on every line pair
        const result = snap(getNodeBounds(dragged), [farTarget, TARGET], 10);
        expect(result.deltaX).toBe(3);
        expect(result.xGuides[0].value).toBe(600); // tie → center↔center wins
    });

    it('snaps a group bounding box, not individual members', () => {
        const memberA = makeNode({ id: 'a', position: { x: 490, y: 300 }, width: 100, height: 80 }); // x 490..590
        const memberB = makeNode({ id: 'b', position: { x: 620, y: 340 }, width: 100, height: 80 }); // x 620..720
        // group spans x 490..720 → vertical lines 490/605/720; closest to target is center 605 vs 600 → -5
        const group = getGroupBounds([getNodeBounds(memberA), getNodeBounds(memberB)]);
        expect(group).not.toBeNull();
        if (!group) return;
        const result = snap(group, [TARGET], 10);
        expect(result.deltaX).toBe(-5);
        expect(result.xGuides[0].value).toBe(600);
    });

    it('snaps both axes independently when both are in range', () => {
        const dragged = makeNode({ id: 'drag', position: { x: 494, y: 304 } }); // +6 / -4 on every line pair
        const result = snap(getNodeBounds(dragged), [TARGET], 10);
        expect(result.deltaX).toBe(6);
        expect(result.xGuides[0].value).toBe(600); // tie → center↔center
        expect(result.deltaY).toBe(-4);
        expect(result.yGuides[0].value).toBe(350); // tie → center↔center
    });
});

describe('findBestResizeSnap', () => {
    const BOUNDS = { x: 100, y: 100, width: 200, height: 100 }; // lines x 100/200/300, y 100/150/200

    it('snaps the right edge to a target left edge (anchor.x=false)', () => {
        // Right edge 300 is +2 from target left 302 → width shrinks so right lands on 302.
        const target = makeNode({ id: 'target', position: { x: 302, y: 400 } });
        const result = resizeSnap(BOUNDS, { x: false, y: false }, [target], 10);
        expect(result.width).toBe(202); // 302 - 100
        expect(result.x).toBeUndefined(); // left edge fixed → position unchanged
        expect(result.height).toBeUndefined();
        expect(result.y).toBeUndefined();
        expect(result.xGuides[0].value).toBe(302);
        expect(result.xGuides[0].kind).toBe('edge');
    });

    it('snaps the left edge and repositions x (anchor.x=true)', () => {
        // Left edge 100 is +8 from target right 92 → x moves to 92, width grows.
        const t = makeNode({ id: 't', position: { x: 0, y: 400 }, width: 92, height: 50 }); // right edge at 92
        const result = resizeSnap(BOUNDS, { x: true, y: false }, [t], 10);
        expect(result.x).toBe(92); // left → target right (92)
        expect(result.width).toBe(300 - 92); // right edge (300) stays fixed → 208
    });

    it('re-centers on a center match, keeping the fixed edge (anchor.x=false)', () => {
        // Node x 100..300 (center 200). Target center-x at 210 → width doubles around left=100.
        const target = makeNode({ id: 'target', position: { x: 110, y: 400 } }); // center-x 210
        const result = resizeSnap(BOUNDS, { x: false, y: false }, [target], 10);
        expect(result.width).toBe(2 * (210 - 100)); // 220
        expect(result.x).toBeUndefined(); // left fixed
    });

    it('re-centers on a center match with the left edge moving (anchor.x=true)', () => {
        // Node x 100..300 (center 200, right 300). Target center-x at 210 → x = 2*210-300 = 120.
        const target = makeNode({ id: 'target', position: { x: 110, y: 400 } }); // center-x 210
        const result = resizeSnap(BOUNDS, { x: true, y: false }, [target], 10);
        expect(result.x).toBe(120);
        expect(result.width).toBe(300 - 120); // right (300) stays fixed → 180
    });

    it('snaps the bottom edge to a target top edge (anchor.y=false)', () => {
        // Bottom 200 is +5 from target top 205 → height grows.
        const target = makeNode({ id: 'target', position: { x: 400, y: 205 } });
        const result = resizeSnap(BOUNDS, { x: false, y: false }, [target], 10);
        expect(result.height).toBe(205 - 100); // 105
        expect(result.y).toBeUndefined(); // top fixed
    });

    it('snaps the top edge and repositions y (anchor.y=true)', () => {
        // Top 100 is +8 from target bottom 92 → y moves to 92, height grows.
        const target = makeNode({ id: 'target', position: { x: 400, y: 42 }, width: 50, height: 50 }); // bottom 92
        const result = resizeSnap(BOUNDS, { x: false, y: true }, [target], 10);
        expect(result.y).toBe(92);
        expect(result.height).toBe(200 - 92); // bottom (200) stays fixed → 108
    });

    it('ignores the fixed edge as a snap candidate', () => {
        // anchor.x=false means only [center, right] move. Put a target line exactly on the
        // LEFT edge (100) — it must NOT be matched because the left edge cannot move.
        const farTarget = makeNode({ id: 'far', position: { x: 320, y: 400 } }); // lines 320/420/520 (all far)
        const fixedEdgeTarget = makeNode({ id: 'fixed', position: { x: 100, y: 400 }, width: 5, height: 50 }); // left 100 sits on node's left edge
        const result = resizeSnap(BOUNDS, { x: false, y: false }, [farTarget, fixedEdgeTarget], 10);
        // No movable line (center 200 / right 300) is within 10 of any target line → no correction.
        expect(result.width).toBeUndefined();
        expect(result.x).toBeUndefined();
    });

    it('snaps both axes simultaneously', () => {
        // Right 300 → +2 to target left 302; bottom 200 → +5 to target top 205.
        const target = makeNode({ id: 'target', position: { x: 302, y: 205 } });
        const result = resizeSnap(BOUNDS, { x: false, y: false }, [target], 10);
        expect(result.width).toBe(202);
        expect(result.height).toBe(105);
    });

    it('gates off an axis that is not changing size (top-only handle)', () => {
        // Top handle: only height changes. A target vertical line sits within 10 of the
        // node center-x (200) — but width must NOT snap because the x axis is inactive.
        // Target lines: x 195/295/395 (left 195 is d=-5 from node center-x 200); y 96/106/116.
        const target = makeNode({ id: 'target', position: { x: 195, y: 96 }, height: 20 });
        const result = resizeSnapAxes(BOUNDS, { x: false, y: true }, { x: false, y: true }, [target], 10);
        expect(result.width).toBeUndefined(); // x axis gated off despite an in-range line
        expect(result.x).toBeUndefined();
        expect(result.y).toBe(96); // top edge snaps to target top (96), closest y match
        expect(result.height).toBe(200 - 96); // bottom (200) fixed → 104
    });

    it('returns empty guides and no geometry when nothing is in range', () => {
        const farTarget = makeNode({ id: 'far', position: { x: 900, y: 900 } });
        const result = resizeSnap(BOUNDS, { x: false, y: false }, [farTarget], 10);
        expect(result).toEqual({ xGuides: [], yGuides: [] });
    });

    it('returns empty for an empty static list or non-positive threshold', () => {
        expect(resizeSnap(BOUNDS, { x: true, y: true }, [], 10)).toEqual({ xGuides: [], yGuides: [] });
        const target = makeNode({ id: 'target', position: { x: 302, y: 205 } });
        expect(resizeSnap(BOUNDS, { x: false, y: false }, [target], 0)).toEqual({ xGuides: [], yGuides: [] });
    });
});
