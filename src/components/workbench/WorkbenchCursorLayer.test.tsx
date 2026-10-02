import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { CollabRemoteCursorState } from '@/types/collab.types';
import { useStore } from '@/store/useStore';
import { WorkbenchCursorLayer } from './WorkbenchCursorLayer';

const viewport = { x: 0, y: 0, zoom: 1 };

describe('WorkbenchCursorLayer', () => {
    beforeEach(() => {
        useStore.setState({ remoteCursors: {} });
    });

    it('updates the cursor overlay from awareness without rerendering its parent', () => {
        let parentRenders = 0;
        const Harness = () => {
            parentRenders += 1;
            return <WorkbenchCursorLayer viewport={viewport} />;
        };
        render(<Harness />);
        const cursors: Record<string, CollabRemoteCursorState> = {
            '7': { userId: 'u-7', userName: 'Grace Hopper', x: 40, y: 50 },
        };

        act(() => useStore.setState({ remoteCursors: cursors }));

        expect(screen.getByText('Grace')).toBeInTheDocument();
        expect(parentRenders).toBe(1);
    });
});
