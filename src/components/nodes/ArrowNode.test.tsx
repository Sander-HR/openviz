import { fireEvent, render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// NodeResizer needs a React Flow provider; these tests exercise the handle
// drag logic only, so stub it out.
vi.mock('@xyflow/react', () => ({
    NodeResizer: () => null,
}));

import { ArrowNode } from './ArrowNode';
import type { ArrowWorkbenchNode } from '@/types';

// jsdom has no PointerEvent API or pointer capture — polyfill both.
beforeAll(() => {
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
});

const NODE_W = 220;
const NODE_H = 140;

function makeArrowData(): ArrowWorkbenchNode['data'] {
    return {
        start: { x: 20, y: 120 },
        end: { x: 200, y: 20 },
        control: { x: 110, y: 70 },
        strokeColor: '#111827',
        strokeWidth: 2,
    };
}

function renderArrow(onDataChange = vi.fn(), selected = true) {
    const data = {
        id: 'arrow-1',
        type: 'arrow' as const,
        x: 0,
        y: 0,
        width: NODE_W,
        height: NODE_H,
        data: makeArrowData(),
        onDataChange,
    };
    const utils = render(
        <ArrowNode id="arrow-1" data={data} selected={selected} width={NODE_W} height={NODE_H} />
    );
    const root = utils.container.firstElementChild as HTMLDivElement;
    // The drag math uses the container rect; pin it to the origin.
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: NODE_W,
        height: NODE_H,
        right: NODE_W,
        bottom: NODE_H,
        x: 0,
        y: 0,
        toJSON: () => ({}),
    } as DOMRect);
    // DOM order of handles: start, end, control
    const handles = Array.from(root.querySelectorAll<HTMLDivElement>('div.nodrag'));
    return { utils, root, onDataChange, handles };
}

function fireWindowPointer(type: string, clientX: number, clientY: number) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, { pointerId: 1, clientX, clientY });
    window.dispatchEvent(ev);
}

describe('ArrowNode handles (C-5.2)', () => {
    it('renders no handles when unselected and three when selected', () => {
        const unselected = renderArrow(vi.fn(), false);
        expect(unselected.root.querySelectorAll('div.nodrag')).toHaveLength(0);

        const selected = renderArrow(vi.fn(), true);
        expect(selected.root.querySelectorAll('div.nodrag')).toHaveLength(3);
    });

    it('dragging the start handle reports new coordinates via onDataChange', () => {
        const { handles, onDataChange } = renderArrow();
        fireEvent.pointerDown(handles[0], { pointerId: 1, clientX: 20, clientY: 120 });
        fireWindowPointer('pointermove', 50, 60);

        expect(onDataChange).toHaveBeenCalledWith('arrow-1', { start: { x: 50, y: 60 } });
    });

    it('dragging the control handle updates the control point', () => {
        const { handles, onDataChange } = renderArrow();
        fireEvent.pointerDown(handles[2], { pointerId: 1, clientX: 110, clientY: 70 });
        fireWindowPointer('pointermove', 30, 40);

        expect(onDataChange).toHaveBeenCalledWith('arrow-1', { control: { x: 30, y: 40 } });
    });

    it('clamps drags that leave the node box instead of throwing (C-5.2 edge)', () => {
        const { handles, onDataChange } = renderArrow();
        fireEvent.pointerDown(handles[1], { pointerId: 1, clientX: 200, clientY: 20 });

        expect(() => fireWindowPointer('pointermove', -50, -50)).not.toThrow();
        expect(onDataChange).toHaveBeenCalledWith('arrow-1', { end: { x: 0, y: 0 } });

        fireWindowPointer('pointermove', 999, 999);
        expect(onDataChange).toHaveBeenCalledWith('arrow-1', { end: { x: NODE_W, y: NODE_H } });
    });

    it('stops reporting after pointer-up (release outside the canvas is safe)', () => {
        const { handles, onDataChange } = renderArrow();
        fireEvent.pointerDown(handles[0], { pointerId: 1, clientX: 20, clientY: 120 });
        fireWindowPointer('pointerup', -100, -100);

        expect(onDataChange).not.toHaveBeenCalled();

        // No listeners left: further moves are inert.
        fireWindowPointer('pointermove', 50, 60);
        expect(onDataChange).not.toHaveBeenCalled();
    });
});
