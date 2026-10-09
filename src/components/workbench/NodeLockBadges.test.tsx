import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { NodeLockState } from '@/types';
import { NodeLockBadges } from './NodeLockBadges';

const viewport = { x: 0, y: 0, zoom: 1 };

function flowNode(id: string, x: number, y: number, width = 200, height = 150) {
    return { id, type: 'text', position: { x, y }, width, height, data: {} as Record<string, unknown> };
}

describe('NodeLockBadges', () => {
    it('renders a dark overlay with lock icon and holder name over each locked node (screen space)', () => {
        const locks: Record<string, NodeLockState> = {
            n1: { nodeId: 'n1', userId: 'u-2', userName: 'Grace' },
        };

        render(<NodeLockBadges nodes={[flowNode('n1', 40, 60)]} nodeLocks={locks} viewport={{ x: 10, y: 5, zoom: 3 }} />);

        const overlay = screen.getByText(/Grace/).closest('[data-lock-node="n1"]') as HTMLElement;
        expect(overlay).not.toBeNull();
        // Node top-left (40,60) → screen (40×3+10, 60×3+5); size 200×150 → 600×450 at zoom 3
        expect(overlay.style.left).toBe('130px');
        expect(overlay.style.top).toBe('185px');
        expect(overlay.style.width).toBe('600px');
        expect(overlay.style.height).toBe('450px');
        // Lock icon rendered above the name.
        expect(overlay.querySelector('svg')).not.toBeNull();
        // Icon + name scale with the viewport zoom (proportional to the node).
        const content = overlay.querySelector('[data-lock-badge-content]') as HTMLElement;
        expect(content.style.transform).toBe('scale(3)');
    });

    it('falls back to a default size when node dimensions are missing', () => {
        const locks: Record<string, NodeLockState> = {
            n1: { nodeId: 'n1', userId: 'u-2', userName: 'Grace' },
        };

        render(
            <NodeLockBadges
                nodes={[{ id: 'n1', position: { x: 0, y: 0 } }]}
                nodeLocks={locks}
                viewport={viewport}
            />,
        );

        const overlay = screen.getByText(/Grace/).closest('[data-lock-node="n1"]') as HTMLElement;
        expect(overlay.style.width).toBe('256px');
        expect(overlay.style.height).toBe('256px');
        // At zoom 1 the content is unscaled.
        const content = overlay.querySelector('[data-lock-badge-content]') as HTMLElement;
        expect(content.style.transform).toBe('scale(1)');
    });

    it('renders nothing when there are no remote locks', () => {
        const { container } = render(
            <NodeLockBadges nodes={[flowNode('n1', 0, 0)]} nodeLocks={{}} viewport={viewport} />,
        );
        expect(container.querySelectorAll('[data-lock-node]')).toHaveLength(0);
    });

    it('ignores locks for nodes that no longer exist on the canvas', () => {
        const locks: Record<string, NodeLockState> = {
            ghost: { nodeId: 'ghost', userId: 'u-2', userName: 'Grace' },
        };

        const { container } = render(
            <NodeLockBadges nodes={[flowNode('n1', 0, 0)]} nodeLocks={locks} viewport={viewport} />,
        );
        expect(container.querySelectorAll('[data-lock-node]')).toHaveLength(0);
    });
});
