import { act, renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkbenchOneShotCreation } from './useWorkbenchOneShotCreation';

// T012: one-shot creation behavior (C-4.1–C-4.3). The auto-switch-to-select
// half is covered by the createOneShotNode store action tests (T005/T006);
// here we verify each handler builds the right node payload and calls it.

function paneTarget(): Element {
    const el = document.createElement('div');
    el.className = 'react-flow__pane';
    return el;
}

function nonPaneTarget(): Element {
    return document.createElement('div');
}

function mouseEvent(clientX: number, clientY: number, target: EventTarget): ReactMouseEvent<HTMLDivElement> {
    return { clientX, clientY, button: 0, target } as unknown as ReactMouseEvent<HTMLDivElement>;
}

function setup(tool: 'select' | 'text' | 'note' | 'arrow') {
    const createOneShotNode = vi.fn();
    const handlePaneClick = vi.fn();
    // Identity mapping keeps expected coordinates trivial to assert.
    const screenToFlowPosition = (p: { x: number; y: number }) => p;
    const { result } = renderHook(() =>
        useWorkbenchOneShotCreation({
            activeWorkbenchTool: tool,
            screenToFlowPosition,
            createOneShotNode,
            handlePaneClick,
        })
    );
    return { createOneShotNode, handlePaneClick, handlers: result.current };
}

describe('useWorkbenchOneShotCreation — text (C-4.2)', () => {
    it('pane click in text tool creates a text node centered on the pointer', () => {
        const { createOneShotNode, handlers } = setup('text');
        act(() => {
            handlers.handlePaneClickWithTool(mouseEvent(300, 200, paneTarget()));
        });

        expect(createOneShotNode).toHaveBeenCalledTimes(1);
        const node = createOneShotNode.mock.calls[0][0];
        expect(node.type).toBe('text');
        // Centered placement: pointer minus half the default box (240x72)
        expect(node.x).toBe(300 - 120);
        expect(node.y).toBe(200 - 36);
        expect(node.data.text).toBe('');
    });

    // Note: unlike the arrow handlers (wired to the wrapper div), this handler
    // is wired to React Flow's onPaneClick in workbench.tsx, which only fires
    // for pane clicks — so no target check is needed here.
    it('still calls the base pane-click handler before creating', () => {
        const { createOneShotNode, handlePaneClick, handlers } = setup('text');
        act(() => {
            handlers.handlePaneClickWithTool(mouseEvent(300, 200, paneTarget()));
        });
        expect(handlePaneClick).toHaveBeenCalledTimes(1);
        expect(createOneShotNode).toHaveBeenCalledTimes(1);
    });

    it('does not create a node when the select tool is active', () => {
        const { createOneShotNode, handlers } = setup('select');
        act(() => {
            handlers.handlePaneClickWithTool(mouseEvent(300, 200, paneTarget()));
        });
        expect(createOneShotNode).not.toHaveBeenCalled();
    });
});

describe('useWorkbenchOneShotCreation — note (C-4.3)', () => {
    it('pane click in note tool creates a yellow note node centered on the pointer', () => {
        const { createOneShotNode, handlers } = setup('note');
        act(() => {
            handlers.handlePaneClickWithTool(mouseEvent(500, 400, paneTarget()));
        });

        expect(createOneShotNode).toHaveBeenCalledTimes(1);
        const node = createOneShotNode.mock.calls[0][0];
        expect(node.type).toBe('note');
        // Default box 220x180 centered on pointer
        expect(node.x).toBe(500 - 110);
        expect(node.y).toBe(400 - 90);
        expect(node.data.colorVariant).toBe('yellow');
    });

    it('still calls the base pane-click handler (deselect behavior preserved)', () => {
        const { handlePaneClick, handlers } = setup('note');
        act(() => {
            handlers.handlePaneClickWithTool(mouseEvent(500, 400, paneTarget()));
        });
        expect(handlePaneClick).toHaveBeenCalledTimes(1);
    });
});

describe('useWorkbenchOneShotCreation — arrow (C-4.1)', () => {
    it('drag on the pane creates one arrow node spanning the drag with padding', () => {
        const { createOneShotNode, handlers } = setup('arrow');
        act(() => {
            handlers.handleCanvasMouseDownForArrow(mouseEvent(0, 0, paneTarget()));
        });
        act(() => {
            handlers.handleCanvasMouseUpForArrow(mouseEvent(200, 100, paneTarget()));
        });

        expect(createOneShotNode).toHaveBeenCalledTimes(1);
        const node = createOneShotNode.mock.calls[0][0];
        expect(node.type).toBe('arrow');
        // Box: |200|+40 x |100|+40 at min corner minus padding
        expect(node.width).toBe(240);
        expect(node.height).toBe(140);
        expect(node.x).toBe(-20);
        expect(node.y).toBe(-20);
        // Local coords: start at (0,0), end at (200,100) relative to box origin
        expect(node.data.start).toEqual({ x: 20, y: 20 });
        expect(node.data.end).toEqual({ x: 220, y: 120 });
    });

    it('a click with no movement (<8px) creates a default-sized arrow', () => {
        const { createOneShotNode, handlers } = setup('arrow');
        act(() => {
            handlers.handleCanvasMouseDownForArrow(mouseEvent(100, 100, paneTarget()));
        });
        act(() => {
            handlers.handleCanvasMouseUpForArrow(mouseEvent(103, 102, paneTarget()));
        });

        expect(createOneShotNode).toHaveBeenCalledTimes(1);
        const node = createOneShotNode.mock.calls[0][0];
        expect(node.width).toBe(120); // minWidth floor
        expect(node.height).toBe(80); // minHeight floor
        expect(node.data.start).toEqual({ x: 20, y: 60 });
        expect(node.data.end).toEqual({ x: 100, y: 20 });
    });

    it('ignores drags that start outside the pane', () => {
        const { createOneShotNode, handlers } = setup('arrow');
        act(() => {
            handlers.handleCanvasMouseDownForArrow(mouseEvent(0, 0, nonPaneTarget()));
        });
        act(() => {
            handlers.handleCanvasMouseUpForArrow(mouseEvent(200, 100, paneTarget()));
        });
        expect(createOneShotNode).not.toHaveBeenCalled();
    });

    it('ignores arrow creation when another tool is active', () => {
        const { createOneShotNode, handlers } = setup('select');
        act(() => {
            handlers.handleCanvasMouseDownForArrow(mouseEvent(0, 0, paneTarget()));
        });
        act(() => {
            handlers.handleCanvasMouseUpForArrow(mouseEvent(200, 100, paneTarget()));
        });
        expect(createOneShotNode).not.toHaveBeenCalled();
    });

    it('releases the drag state after mouse-up (a second up does not create another node)', () => {
        const { createOneShotNode, handlers } = setup('arrow');
        act(() => {
            handlers.handleCanvasMouseDownForArrow(mouseEvent(0, 0, paneTarget()));
        });
        act(() => {
            handlers.handleCanvasMouseUpForArrow(mouseEvent(200, 100, paneTarget()));
        });
        act(() => {
            handlers.handleCanvasMouseUpForArrow(mouseEvent(300, 200, paneTarget()));
        });
        expect(createOneShotNode).toHaveBeenCalledTimes(1);
    });
});
