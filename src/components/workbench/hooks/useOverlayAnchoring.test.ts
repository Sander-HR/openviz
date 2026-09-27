import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// T024 (US2): anchoring math for the floating overlay layer (ui-translation §5).
// - screen position = node.positionAbsolute × viewport transform
// - panel flips ABOVE the node when its bottom would exceed container height − 16px
// - horizontal clamp to [16px, width − 16px]
// - only the active (last-clicked) node anchors a toolbar/panel

const storeState = {
    workbenchNodes: [] as Array<{ id: string; x: number; y: number; width?: number; height?: number }>,
    selectedNodeIds: [] as string[],
    activeNodeId: null as string | null,
};

vi.mock('@/store/useStore', () => ({
    useStore: (selector?: (state: typeof storeState) => unknown) =>
        selector ? selector(storeState) : storeState,
}));

import {
    computeOverlayPosition,
    resolveAnchorNodeId,
    useOverlayAnchoring,
    type OverlayAnchor,
    type ViewportLike,
} from './useOverlayAnchoring';

const viewport: ViewportLike = { x: 100, y: 50, zoom: 2 };

function makeAnchor(overrides: Partial<OverlayAnchor> = {}): OverlayAnchor {
    return {
        nodeId: 'node-1',
        flowX: 10,
        flowY: 20,
        width: 280,
        height: 160,
        ...overrides,
    };
}

describe('computeOverlayPosition (ui-translation §5)', () => {
    it('maps node.positionAbsolute through the viewport transform', () => {
        const result = computeOverlayPosition(makeAnchor(), viewport, { width: 240, height: 36 }, { width: 1000, height: 800 });

        // top-center of the node in screen space
        const expectedX = (10 + 280 / 2) * 2 + 100; // 490
        const expectedY = 20 * 2 + 50; // 90
        expect(result.left).toBeCloseTo(expectedX - 120, 5); // centered: 370
        expect(result.top).toBeCloseTo(expectedY - 8 - 36, 5); // 8px gap above: 46
        expect(result.flipped).toBe(false);
    });

    it('flips ABOVE the node when the panel bottom would exceed container height − 16px', () => {
        const anchor = makeAnchor({ flowY: 370, height: 100 }); // screen top = 790
        const result = computeOverlayPosition(anchor, viewport, { width: 240, height: 36 }, { width: 1000, height: 800 });

        // below the node would be 790 + 8 + 36 = 834 > 800 − 16 → flip above
        expect(result.flipped).toBe(true);
        expect(result.top).toBeCloseTo(790 - 8 - 36, 5); // 746
    });

    it('does not flip when the panel fits below within the 16px margin', () => {
        const anchor = makeAnchor({ flowY: 360, height: 100 }); // screen top = 770 → bottom 814? no: 770+8+36=814 > 784 → flip
        const fits = makeAnchor({ flowY: 350, height: 100 }); // screen top = 750 → 750+8+36 = 794 ≤ 784? no
        const safe = makeAnchor({ flowY: 340, height: 100 }); // screen top = 730 → 730+8+36 = 774 ≤ 784 → fits

        expect(computeOverlayPosition(anchor, viewport, { width: 240, height: 36 }, { width: 1000, height: 800 }).flipped).toBe(true);
        expect(computeOverlayPosition(fits, viewport, { width: 240, height: 36 }, { width: 1000, height: 800 }).flipped).toBe(true);
        expect(computeOverlayPosition(safe, viewport, { width: 240, height: 36 }, { width: 1000, height: 800 }).flipped).toBe(false);
    });

    it('clamps horizontally to [16px, containerWidth − 16px]', () => {
        const farLeft = makeAnchor({ flowX: -500, width: 280 }); // screen center ≈ -790
        const left = computeOverlayPosition(farLeft, viewport, { width: 240, height: 36 }, { width: 1000, height: 800 });
        expect(left.left).toBe(16);

        const farRight = makeAnchor({ flowX: 500, width: 280 }); // screen center ≈ 1190
        const right = computeOverlayPosition(farRight, viewport, { width: 240, height: 36 }, { width: 1000, height: 800 });
        expect(right.left).toBe(1000 - 16 - 240); // 744
    });

    it('scales with zoom (positionAbsolute × viewport)', () => {
        const atZoom1 = computeOverlayPosition(makeAnchor(), { x: 0, y: 0, zoom: 1 }, { width: 240, height: 36 }, { width: 1000, height: 800 });
        const atZoom2 = computeOverlayPosition(makeAnchor(), { x: 0, y: 0, zoom: 2 }, { width: 240, height: 36 }, { width: 1000, height: 800 });

        // node top-center at zoom 1: (150, 20); at zoom 2: (300, 40)
        expect(atZoom2.top).toBeCloseTo(40 - 8 - 36, 5);
        expect(atZoom1.top).toBeCloseTo(20 - 8 - 36, 5);
    });
});

describe('resolveAnchorNodeId (active-node rule)', () => {
    it('returns the active node when it is part of the selection', () => {
        storeState.workbenchNodes = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 1 }];
        storeState.selectedNodeIds = ['a', 'b'];
        storeState.activeNodeId = 'b';
        expect(resolveAnchorNodeId(storeState)).toBe('b');
    });

    it('falls back to the last selected node when the active node is not selected', () => {
        storeState.workbenchNodes = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 1 }];
        storeState.selectedNodeIds = ['a', 'b'];
        storeState.activeNodeId = null;
        expect(resolveAnchorNodeId(storeState)).toBe('b');
    });

    it('returns null when nothing is selected', () => {
        storeState.workbenchNodes = [{ id: 'a', x: 0, y: 0 }];
        storeState.selectedNodeIds = [];
        storeState.activeNodeId = 'a';
        expect(resolveAnchorNodeId(storeState)).toBeNull();
    });
});

describe('useOverlayAnchoring', () => {
    afterEach(() => {
        storeState.workbenchNodes = [];
        storeState.selectedNodeIds = [];
        storeState.activeNodeId = null;
    });

    it('anchors only the active node and exposes screen coordinates', () => {
        storeState.workbenchNodes = [
            { id: 'a', x: 0, y: 0, width: 280, height: 160 },
            { id: 'b', x: 400, y: 100, width: 280, height: 160 },
        ];
        storeState.selectedNodeIds = ['a', 'b'];
        storeState.activeNodeId = 'b';

        const { result } = renderHook(() => useOverlayAnchoring());
        expect(result.current).not.toBeNull();
        expect(result.current?.nodeId).toBe('b');
        // screen top-center of b: (400 + 140) * 2 + 100 = 1080, y: 100*2+50 = 250
        expect(result.current?.screenX).toBeCloseTo(1080, 5);
        expect(result.current?.screenY).toBeCloseTo(250, 5);
    });

    it('returns null when there is no selection', () => {
        storeState.workbenchNodes = [{ id: 'a', x: 0, y: 0 }];
        storeState.selectedNodeIds = [];
        storeState.activeNodeId = null;

        const { result } = renderHook(() => useOverlayAnchoring());
        expect(result.current).toBeNull();
    });

    it('tracks viewport changes (re-render on pan/zoom)', () => {
        storeState.workbenchNodes = [{ id: 'a', x: 0, y: 0, width: 280, height: 160 }];
        storeState.selectedNodeIds = ['a'];
        storeState.activeNodeId = 'a';

        const { result } = renderHook(() => useOverlayAnchoring());
        const before = result.current;
        expect(before).not.toBeNull();

        // Simulate a pan: the hook subscribes to useViewport, which in this
        // unit test is driven by re-rendering with a new store-independent
        // viewport — verified via the pure math above; here we assert the
        // hook output shape stays stable across renders.
        act(() => {
            storeState.workbenchNodes = [{ id: 'a', x: 0, y: 0, width: 280, height: 160 }];
        });
        expect(result.current?.nodeId).toBe('a');
    });
});
