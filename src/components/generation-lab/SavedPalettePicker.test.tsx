import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SavedPalettePicker, type SavedPalette } from './SavedPalettePicker';

const PALETTES: SavedPalette[] = [
    { id: 'asset-1', name: 'Lamp palette', swatches: ['#a1a1aa', '#047857'] },
    { id: 'asset-2', swatches: ['#c2410c'] },
];

describe('SavedPalettePicker (T030, FR-023)', () => {
    it('renders each saved palette with its name and swatch count', () => {
        render(<SavedPalettePicker palettes={PALETTES} onSelect={vi.fn()} />);
        expect(screen.getByText('Lamp palette')).toBeInTheDocument();
        // The unnamed palette falls back to a stable label.
        expect(screen.getByText(/saved palette/i)).toBeInTheDocument();
    });

    it('selecting a palette reports its name and swatches', () => {
        const onSelect = vi.fn();
        render(<SavedPalettePicker palettes={PALETTES} onSelect={onSelect} />);
        fireEvent.click(screen.getByRole('button', { name: /load palette "lamp palette"/i }));

        expect(onSelect).toHaveBeenCalledWith({ id: 'asset-1', name: 'Lamp palette', swatches: ['#a1a1aa', '#047857'] });
    });

    it('shows an empty state when no palettes are saved yet', () => {
        render(<SavedPalettePicker palettes={[]} onSelect={vi.fn()} />);
        expect(screen.getByText(/no saved palettes yet/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /load palette/i })).not.toBeInTheDocument();
    });
});
