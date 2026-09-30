import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReferencePicker } from './ReferencePicker';

describe('ReferencePicker', () => {
    it('selects an eligible image reference', () => {
        const onSelect = vi.fn();
        render(<ReferencePicker open candidates={[{ assetId: 'asset-2', label: 'Material board', thumbnail: 'board.png' }]} onSelect={onSelect} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Material board' }));
        expect(onSelect).toHaveBeenCalledWith('asset-2');
    });
});
