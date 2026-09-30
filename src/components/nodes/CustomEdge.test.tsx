import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vitest runs without `globals:true`, so RTL's auto-cleanup is not registered;
// unmount explicitly between tests to avoid DOM accumulation.
afterEach(cleanup);

const { storeState } = vi.hoisted(() => ({
    storeState: {
        removeConnection: () => {},
        activeNodeId: null as string | null,
    },
}));

vi.mock('../../store/useStore', () => ({
    useStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

// jsdom cannot measure React Flow nodes (no layout engine), so a full
// <ReactFlow> instance never computes edge geometry and renders no edges.
// Instead, render CustomEdge directly with explicit connection points and stub
// only the two flow-context dependencies: useViewport (zoom) and
// EdgeLabelRenderer (portals into a mounted flow's label layer). BaseEdge and
// getSmoothStepPath stay real so path/stroke behavior is exercised for real.
vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useViewport: () => ({ zoom: 1 }),
        EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
    };
});

import { CustomEdge } from './CustomEdge';
import { Position, type EdgeProps } from '@xyflow/react';

function renderEdge(overrides: Partial<EdgeProps> = {}) {
    const props: EdgeProps = {
        id: 'edge-1',
        type: 'custom',
        animated: false,
        data: {},
        selectable: true,
        deletable: true,
        source: 'node-a',
        target: 'node-b',
        sourceX: 0,
        sourceY: 100,
        targetX: 300,
        targetY: 100,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        selected: false,
        ...overrides,
    };
    return render(
        <svg width={400} height={200}>
            <CustomEdge {...props} />
        </svg>,
    );
}

function edgePath(container: HTMLElement) {
    const path = container.querySelector('path.react-flow__edge-path');
    expect(path).not.toBeNull();
    return path as SVGPathElement;
}

describe('CustomEdge hover behavior', () => {
    beforeEach(() => {
        storeState.activeNodeId = null;
    });

    it('hides the delete control when not hovered and no endpoint is active', () => {
        renderEdge();
        expect(screen.queryByRole('button', { name: /delete connection/i })).not.toBeInTheDocument();
    });

    it('shows the delete control on hover and removes the connection on click', () => {
        const removeConnection = vi.fn();
        storeState.removeConnection = removeConnection;
        const { container } = renderEdge();

        expect(screen.queryByRole('button', { name: /delete connection/i })).not.toBeInTheDocument();

        fireEvent.mouseEnter(edgePath(container));

        const deleteButton = screen.getByRole('button', { name: /delete connection/i });
        expect(deleteButton).toBeInTheDocument();

        fireEvent.click(deleteButton);
        expect(removeConnection).toHaveBeenCalledWith('edge-1');
    });

    it('highlights the stroke with the accent color while hovered', () => {
        const { container } = renderEdge();
        const path = edgePath(container);
        const defaultStroke = path.style.stroke;

        fireEvent.mouseEnter(path);
        expect(path.style.stroke.toLowerCase()).toContain('#4c4cef');

        fireEvent.mouseLeave(path);
        expect(path.style.stroke).toBe(defaultStroke);
    });

    it('keeps the delete control visible when an endpoint is the active node', () => {
        storeState.activeNodeId = 'node-a';
        renderEdge();
        expect(screen.getByRole('button', { name: /delete connection/i })).toBeInTheDocument();
        storeState.activeNodeId = null;
    });
});

describe('CustomEdge endpoint attachment', () => {
    it('extends horizontal endpoints by the connector radius', () => {
        const { container } = renderEdge({
            sourceX: 100,
            sourceY: 100,
            targetX: 300,
            targetY: 100,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        });

        const path = edgePath(container);
        expect(path.getAttribute('d')).toContain('M87');
        expect(path.getAttribute('d')).toContain('L313');
    });
});
