import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Pencil } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest runs without `globals:true`, so RTL's auto-cleanup is not registered;
// unmount explicitly between tests to avoid DOM accumulation.
afterEach(cleanup);

import { MenuItemRow } from './MenuItemRow';
import { Kbd } from '@/components/ui/kbd';

// T010: shared menu row behavior (ui-translation §3.3 item anatomy).

describe('MenuItemRow', () => {
    it('renders icon, label and a right-aligned Kbd shortcut hint when a shortcut exists', () => {
        render(
            <MenuItemRow
                label="Duplicate"
                icon={Pencil}
                shortcut="⌘D"
            />,
        );

        expect(screen.getByRole('menuitem')).toBeInTheDocument();
        expect(screen.getByText('Duplicate')).toBeInTheDocument();
        // Kbd hint renders the shortcut text inside a <kbd> element
        const kbd = screen.getByText('⌘D');
        expect(kbd.tagName).toBe('KBD');
        expect(kbd.className).toContain('ml-auto');
    });

    it('omits the Kbd hint when no shortcut is assigned', () => {
        render(<MenuItemRow label="Add to library" icon={Pencil} />);

        expect(screen.getByRole('menuitem')).toBeInTheDocument();
        expect(screen.queryByText('⌘D')).not.toBeInTheDocument();
        // No <kbd> element rendered at all
        expect(document.querySelector('kbd')).not.toBeInTheDocument();
    });

    it('invokes onClick when enabled', () => {
        const onClick = vi.fn();
        render(<MenuItemRow label="Delete" shortcut="Del" onClick={onClick} />);

        fireEvent.click(screen.getByRole('menuitem'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('applies disabled styling and is inert to clicks when disabled', () => {
        const onClick = vi.fn();
        render(<MenuItemRow label="Copy link" shortcut="⌘L" disabled onClick={onClick} />);

        const row = screen.getByRole('menuitem');
        expect(row.className).toContain('opacity-40');
        expect(row.className).toContain('pointer-events-none');
        expect(row).toHaveAttribute('aria-disabled', 'true');

        fireEvent.click(row);

        expect(onClick).not.toHaveBeenCalled();
    });

    it('applies danger styling for destructive actions', () => {
        render(<MenuItemRow label="Delete" shortcut="Del" danger />);

        expect(screen.getByRole('menuitem').className).toContain('text-red-400');
    });

    it('Kbd renders a styled chip element', () => {
        render(<Kbd>⌘Z</Kbd>);

        const kbd = screen.getByText('⌘Z');
        expect(kbd.tagName).toBe('KBD');
        expect(kbd.className).toContain('font-mono');
    });
});
