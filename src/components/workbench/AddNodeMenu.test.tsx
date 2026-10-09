import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest runs without `globals:true`, so RTL's auto-cleanup is not registered;
// unmount explicitly between tests to avoid DOM accumulation.
afterEach(cleanup);

// T032 (US3): the add-node menu (ui-translation §3.1). w-[222px] container,
// upload group with Kbd hints (I /), a two-column icon grid of every
// non-legacy creatable type, legacy types excluded, and selecting a type
// routes to its creation flow and closes the menu.

import { AddNodeMenu } from './AddNodeMenu';

const GRID_LABELS = [
    'Sketch',
    'Instant Render',
    'Animate',
    'Modify',
    'Variate',
    'Extract',
    'New View',
    'Text',
    'Sticky Note',
    'Section',
    'Media/Video',
];

const LEGACY_LABELS = ['Style', 'Mix', 'Try on'];

function renderMenu(overrides: Partial<Parameters<typeof AddNodeMenu>[0]> = {}) {
    const props = {
        onUploadImage: vi.fn(),
        onUploadFromPhone: vi.fn(),
        onCreateNode: vi.fn(),
        ...overrides,
    };
    const utils = render(<AddNodeMenu {...props} />);
    return { props, ...utils };
}

function openMenu() {
    // Radix DropdownMenu.Trigger opens on pointerdown (button 0).
    fireEvent.pointerDown(screen.getByTitle('Add node'), { button: 0 });
}

describe('AddNodeMenu — container (ui-translation §3.1)', () => {
    it('renders a trigger with the Plus tooltip "Add node"', () => {
        renderMenu();
        expect(screen.getByTitle('Add node')).toBeTruthy();
    });

    it('opens a w-[222px] content panel', () => {
        renderMenu();
        openMenu();
        const content = screen.getByRole('menu');
        expect(content.className).toContain('w-[222px]');
    });
});

describe('AddNodeMenu — upload group', () => {
    it('lists "Upload an image" with Kbd I and "Upload from phone" with Kbd /', () => {
        renderMenu();
        openMenu();

        const uploadImage = screen.getByText('Upload an image').closest('[role="menuitem"]');
        expect(uploadImage?.querySelector('kbd')?.textContent).toBe('I');

        const uploadPhone = screen.getByText('Upload from phone').closest('[role="menuitem"]');
        expect(uploadPhone?.querySelector('kbd')?.textContent).toBe('/');
    });

    it('routes the upload rows to their flows and closes', () => {
        const { props } = renderMenu();
        openMenu();

        fireEvent.click(screen.getByText('Upload an image'));
        expect(props.onUploadImage).toHaveBeenCalledTimes(1);

        openMenu();
        fireEvent.click(screen.getByText('Upload from phone'));
        expect(props.onUploadFromPhone).toHaveBeenCalledTimes(1);
    });
});

describe('AddNodeMenu — two-column type grid', () => {
    it('lists every non-legacy creatable type exactly once', () => {
        renderMenu();
        openMenu();

        for (const label of GRID_LABELS) {
            expect(screen.getAllByText(label)).toHaveLength(1);
        }
    });

    it('excludes legacy types (Style, Mix, Try on) and a bare "Render" label', () => {
        renderMenu();
        openMenu();

        for (const label of LEGACY_LABELS) {
            expect(screen.queryByText(label)).toBeNull();
        }
        // The existing render node appears only as "Instant Render".
        expect(screen.queryByText('Render', { exact: true })).toBeNull();
    });

    it('lays the grid out in two columns', () => {
        renderMenu();
        openMenu();

        const sketch = screen.getByText('Sketch').closest('[role="menuitem"]');
        const grid = sketch?.parentElement;
        expect(grid?.className).toContain('grid-cols-2');
    });

    it.each([
        ['Sketch', 'sketch'],
        ['Instant Render', 'render'],
        ['Animate', 'animate'],
        ['Modify', 'modify'],
        ['Variate', 'variate'],
        ['Extract', 'extract'],
        ['New View', 'new-view'],
        ['Text', 'text'],
        ['Sticky Note', 'note'],
        ['Section', 'section'],
        ['Media/Video', 'media'],
    ] as const)('selecting %s routes to the %s creation flow and closes', (label, kind) => {
        const { props } = renderMenu();
        openMenu();

        fireEvent.click(screen.getByText(label));

        expect(props.onCreateNode).toHaveBeenCalledWith(kind);
        // Radix closes the menu on item selection.
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
