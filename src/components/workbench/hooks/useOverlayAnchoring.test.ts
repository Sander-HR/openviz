import { cleanup, renderHook } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// T024 (US2): anchoring math for the floating overlay layer (ui-translation §5).
// - screen position = node.positionAbsolute × viewport transform
// - panels anchor BELOW the node by default (8px gap) and flip ABOVE when the
//   panel bottom would exceed container height − 16px
// - horizontal clamp to [16px, width − 16px]
// - only the active (last-clicked) node anchors a toolbar/panel

const { storeState, subscribe, notify } = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    return {
        storeState: {
            workbenchNodes: [] as Array<{ id: string; x: number; y: number; width?: number; height?: number }>,
            selectedNodeIds: [] as string[],
            activeNodeId: null as string | null,
        },
        subscribe: (cb: () => void) => {
            listeners.add(cb);
            return () => {
                listeners.delete(cb);
            };
        },
        notify: () => listeners.forEach((l) => l()),
    };
});

vi.mock('@/store/useStore', () => ({
    useStore: (selector?: (state: typeof storeState) => unknown) =>
        useSyncExternalStore(
            subscribe,
            () => (selector ? selector(storeState) : storeState),
        ),
}));

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useViewport: () => ({ x: 100, y: 50, zoom: 2 }),
    };
});

import {
    computeOverlayPosition,
    resolveAnchorNodeId,
    useOverlayAnchoring,
    type OverlayAnchor,
    type ViewportLike,
} from './useOverlayAnchoring';

afterEach(() => {
    cleanup();
    storeState.workbenchNodes = [];
    storeState.selectedNodeIds = [];
    storeState.activeNodeId = null;
});

const viewport: ViewportLike = { x: 100, y: 50, zoom: 2 };
const container = { width: 1000, height: 800 };
const panel = { width: 240, height: 36 };

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
    it('maps node.positionAbsolute through the viewport transform and anchors below', () => {
        const result = computeOverlayPosition(makeAnchor(), viewport, panel, container);

        // top-center of the node in screen space: x=(10+140)*2+100=400, y=20*2+50=90
        expect(result.left).toBeCloseTo(400 - 240 / 2, 5); // centered: 280
        expect(result.top).toBeCloseTo(90 + 8, 5); // 8px gap below: 98
        expect(result.flipped).toBe(false);
    });

    it('flips ABOVE the node when the panel bottom would exceed container height − 16px', () => {
        const anchor = makeAnchor({ flowY: 350 }); // screen top = 750 → below bottom 794 > 784
        const result = computeOverlayPosition(anchor, viewport, panel, container);

        expect(result.flipped).toBe(true);
        expect(result.top).toBeCloseTo(750 - 8 - 36, 5); // above: 706
    });

    it('does not flip when the panel fits below the node', () => {
        const anchor = makeAnchor({ flowY: 100 }); // screen top = 250 → bottom 294 ≤ 784
        const result = computeOverlayPosition(anchor, viewport, panel, container);

        expect(result.flipped).toBe(false);
        expect(result.top).toBeCloseTo(250 + 8, 5); // 258
    });

    it('clamps horizontally to [16px, containerWidth − 16px]', () => {
        const farLeft = makeAnchor({ flowX: -500, width: 280 }); // screen center ≈ -620
        const left = computeOverlayPosition(farLeft, viewport, panel, container);
        expect(left.left).toBe(16);

        const farRight = makeAnchor({ flowX: 500, width: 280 }); // screen center ≈ 1380
        const right = computeOverlayPosition(farRight, viewport, panel, container);
        expect(right.left).toBe(1000 - 16 - 240); // 744
    });

    it('scales with zoom (positionAbsolute × viewport)', () => {
        const anchor = makeAnchor({ flowY: 100 });
        const atZoom1 = computeOverlayPosition(anchor, { x: 0, y: 0, zoom: 1 }, panel, container);
        const atZoom2 = computeOverlayPosition(anchor, { x: 0, y: 0, zoom: 2 }, panel, container);

        // node top at screen y=100 (zoom 1) and y=200 (zoom 2), anchored below
        expect(atZoom1.top).toBeCloseTo(100 + 8, 5); // 108
        expect(atZoom2.top).toBeCloseTo(200 + 8, 5); // 208
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
        // screen top-center of b: (400 + 140) * 2 + 100 = 1180, y: 100*2+50 = 250
        expect(result.current?.screenX).toBeCloseTo(1180, 5);
        expect(result.current?.screenY).toBeCloseTo(250, 5);
    });

    it('returns null when there is no selection', () => {
        storeState.workbenchNodes = [{ id: 'a', x: 0, y: 0 }];
        storeState.selectedNodeIds = [];
        storeState.activeNodeId = null;

        const { result } = renderHook(() => useOverlayAnchoring());
        expect(result.current).toBeNull();
    });

    it('recomputes when the selection changes', () => {
        storeState.workbenchNodes = [
            { id: 'a', x: 0, y: 0, width: 280, height: 160 },
            { id: 'b', x: 400, y: 100, width: 280, height: 160 },
        ];
        storeState.selectedNodeIds = ['a'];
        storeState.activeNodeId = 'a';

        const { result } = renderHook(() => useOverlayAnchoring());
        expect(result.current?.nodeId).toBe('a');

        act(() => {
            storeState.selectedNodeIds = ['b'];
            storeState.activeNodeId = 'b';
            notify();
        });
        expect(result.current?.nodeId).toBe('b');
    });
});
