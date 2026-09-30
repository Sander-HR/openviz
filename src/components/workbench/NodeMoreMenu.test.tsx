import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// T027 (US2): the "more" menu (ui-translation §3.3) — five groups separated by
// separators, right-aligned Kbd hints, danger-styled Delete, disabled items inert.

import { NodeMoreMenu } from './NodeMoreMenu';
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

function renderMenu(overrides: Partial<Parameters<typeof NodeMoreMenu>[0]> = {}) {
    const props = { actions: makeActions(), onAction: vi.fn(), ...overrides };
    const utils = render(<NodeMoreMenu {...props} />);
    return { props, ...utils };
}

describe('NodeMoreMenu — structure (ui-translation §3.3)', () => {
    it('renders all fifteen actions', () => {
        renderMenu();
        for (const label of [
            'Remove Background', 'Download', 'Export…', 'Copy raw image',
            'Add to library', 'Add to reference images', 'Set as thumbnail', 'Restore default thumbnail',
            'Wrap in section', 'Bring to front', 'Send to back',
            'Copy link to selection', 'Copy', 'Duplicate', 'Delete',
        ]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
    });

    it('separates the five groups with four separators', () => {
        const { container } = renderMenu();
        // Radix renders decorative separators as aria-hidden divs, so count
        // them in the DOM rather than through the accessibility tree.
        expect(container.querySelectorAll('[role="separator"]')).toHaveLength(4);
    });

    it('shows right-aligned Kbd hints for ⌘L, ⌘C, ⌘D, Del, ], [', () => {
        renderMenu();
        const kbds = Array.from(document.querySelectorAll('kbd')).map((el) => el.textContent?.trim());
        expect(kbds).toEqual(expect.arrayContaining(['⌘L', '⌘C', '⌘D', 'Del', ']', '[']));
    });

    it('styles the Delete row as danger (red)', () => {
        const { container } = renderMenu();
        const deleteRow = Array.from(container.querySelectorAll('[role="menuitem"]'))
            .find((el) => el.textContent?.includes('Delete'));
        expect(deleteRow).toBeTruthy();
        expect(deleteRow!.className).toContain('text-red-400');
    });

    it('marks disabled rows as inert (aria-disabled, no click handler effect)', () => {
        const { props } = renderMenu();
        const libraryRow = Array.from(document.querySelectorAll('[role="menuitem"]'))
            .find((el) => el.textContent?.includes('Add to library'));
        expect(libraryRow).toBeTruthy();
        expect(libraryRow!.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(libraryRow!);
        expect(props.onAction).not.toHaveBeenCalledWith('add-to-library');
    });

    it('invokes onAction with the action id for enabled rows', () => {
        const { props } = renderMenu();
        fireEvent.click(screen.getByText('Duplicate'));
        expect(props.onAction).toHaveBeenCalledWith('duplicate');
    });
});
