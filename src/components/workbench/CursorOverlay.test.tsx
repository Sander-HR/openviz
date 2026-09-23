import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { CollabRemoteCursorState } from '@/types/collab.types';
import { CursorOverlay } from './CursorOverlay';

const viewport = { x: 20, y: 30, zoom: 2 };

describe('CursorOverlay', () => {
    it('positions each remote cursor in screen space (world × zoom + viewport offset)', () => {
        const cursors: Record<string, CollabRemoteCursorState> = {
            '3': { userId: 'u-2', userName: 'Grace Hopper', color: '#f97316', x: 100, y: 50 },
        };

        render(<CursorOverlay remoteCursors={cursors} viewport={viewport} />);

        const label = screen.getByText('Grace');
        expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
        // The positioned wrapper carries the computed left/top.
        const positioned = label.closest('[data-cursor-client="3"]') as HTMLElement;
        expect(positioned).not.toBeNull();
        expect(positioned.style.left).toBe('220px'); // 100 × 2 + 20
        expect(positioned.style.top).toBe('130px'); // 50 × 2 + 30
    });

    it('renders only peers that currently have an active cursor entry', () => {
        const cursors: Record<string, CollabRemoteCursorState> = {
            '4': { userId: 'u-3', userName: 'Hugo Boss', color: '#0ea5e9', x: 0, y: 0 },
        };

        render(<CursorOverlay remoteCursors={cursors} viewport={viewport} />);

        // Grace has no cursor entry (idle / pointer left) — the slice drops it.
        expect(screen.queryByText('Grace')).not.toBeInTheDocument();
        expect(screen.getByText('Hugo')).toBeInTheDocument();
    });

    it('renders an empty layer when there are no remote cursors', () => {
        const { container } = render(<CursorOverlay remoteCursors={{}} viewport={viewport} />);
        expect(container.querySelectorAll('[data-cursor-client]')).toHaveLength(0);
    });
});
