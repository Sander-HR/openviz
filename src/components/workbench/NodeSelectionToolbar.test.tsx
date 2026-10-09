import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// T026 (US2): floating selection toolbar above the selected image node
// (ui-translation §3.2). Edit button, aspect-ratio chip with the exact ratio
// list, quick actions, "more" trigger; stays anchored through pan/zoom.

import { NodeSelectionToolbar } from './NodeSelectionToolbar';
import { useNodeMoreMenuActions } from './hooks/useNodeMoreMenuActions';
import type { ImageNode, WorkbenchNode } from '@/types';

function makeImageNode(id: string): ImageNode {
    return {
        id,
        type: 'image',
        x: 0,
        y: 0,
        name: `Image ${id}`,
        project: {
            id: `project-${id}`,
            name: `Project ${id}`,
            createdAt: 0,
            lastModifiedAt: 0,
            canvas: {
                width: 512,
                height: 512,
                aspectRatio: 'square',
                zoomLevel: 1,
                panX: 0,
                panY: 0,
                backgroundColor: '#ffffff',
            },
            layers: [],
            thumbnail: `https://example.com/${id}.png`,
        },
    };
}

function makeActions(nodes: WorkbenchNode[] = [makeImageNode('img-1')]) {
    return useNodeMoreMenuActions({
        nodes,
        reorderWorkbenchNode: vi.fn(),
        copyToClipboard: vi.fn(),
        duplicateWorkbenchNode: vi.fn(),
        removeWorkbenchNode: vi.fn(),
    });
}

function renderToolbar(overrides: Partial<Parameters<typeof NodeSelectionToolbar>[0]> = {}) {
    const props = {
        anchor: { screenX: 400, screenY: 200 },
        aspectRatio: '1:1',
        actions: makeActions(),
        onEdit: vi.fn(),
        onAspectRatioChange: vi.fn(),
        onOpenMore: vi.fn(),
        ...overrides,
    };
    const utils = render(<NodeSelectionToolbar {...props} />);
    return { props, ...utils };
}

describe('NodeSelectionToolbar — contents (ui-translation §3.2)', () => {
    it('renders an Edit button', () => {
        renderToolbar();
        expect(screen.getByTitle('Edit')).toBeTruthy();
    });

    it('renders an aspect-ratio chip showing the current ratio', () => {
        renderToolbar({ aspectRatio: '16:9' });
        const chip = screen.getByRole('button', { name: /16:9/ });
        expect(chip).toBeTruthy();
    });

    it('aspect menu lists exactly 1:1, 4:5, 5:4, 2:3, 3:2, 9:16, 16:9', () => {
        renderToolbar();
        fireEvent.pointerDown(screen.getByRole('button', { name: /1:1/ }), { button: 0 });

        // exactly seven options — no more, no less (the chip also shows the
        // current ratio, so assert on the menu items themselves)
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(7);
        expect(menuItems.map((item) => item.textContent?.trim()))
            .toEqual(['1:1', '4:5', '5:4', '2:3', '3:2', '9:16', '16:9']);
    });

    it('selecting a ratio calls onAspectRatioChange and closes the menu', () => {
        const { props } = renderToolbar();
        fireEvent.pointerDown(screen.getByRole('button', { name: /1:1/ }), { button: 0 });
        fireEvent.click(screen.getByText('2:3', { exact: true }));

        expect(props.onAspectRatioChange).toHaveBeenCalledWith('2:3');
        expect(screen.queryByText('9:16', { exact: true })).toBeNull();
    });

    it('renders the quick actions Download, Copy raw image, Add to library', () => {
        renderToolbar();
        expect(screen.getByTitle('Download')).toBeTruthy();
        expect(screen.getByTitle('Copy raw image')).toBeTruthy();
        expect(screen.getByTitle('Add to library')).toBeTruthy();
    });

    it('disables quick actions that have no backend (R11)', () => {
        renderToolbar();
        expect(screen.getByTitle('Add to library')).toBeDisabled();
        expect(screen.getByTitle('Download')).toBeEnabled();
        expect(screen.getByTitle('Copy raw image')).toBeEnabled();
    });

    it('renders a "more" trigger that opens the more menu', () => {
        const { props } = renderToolbar();
        fireEvent.click(screen.getByTitle('More'));
        expect(props.onOpenMore).toHaveBeenCalledTimes(1);
    });
});

describe('NodeSelectionToolbar — anchoring (§5)', () => {
    it('positions itself above the node title with a 24px gap', () => {
        const { container } = renderToolbar({ anchor: { screenX: 400, screenY: 200 } });
        const toolbar = container.firstElementChild as HTMLElement;

        expect(toolbar.style.left).toBe('400px');
        expect(toolbar.style.top).toBe('176px'); // 200 − 24px gap
        expect(toolbar.style.transform).toContain('translate(-50%, -100%)');
    });

    it('stays anchored through pan/zoom (re-renders with new anchor coordinates)', () => {
        const { container, rerender } = renderToolbar({ anchor: { screenX: 400, screenY: 200 } });

        // Simulate the overlay layer re-anchoring after a viewport change
        rerender(
            <NodeSelectionToolbar
                anchor={{ screenX: 650, screenY: 340 }}
                aspectRatio="1:1"
                actions={makeActions()}
                onEdit={() => undefined}
                onAspectRatioChange={() => undefined}
                onOpenMore={() => undefined}
            />
        );

        const moved = container.firstElementChild as HTMLElement;
        expect(moved.style.left).toBe('650px');
        expect(moved.style.top).toBe('316px'); // 340 − 24px gap
    });
});
