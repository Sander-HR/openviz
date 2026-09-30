import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReferenceChips } from './ReferenceChips';

describe('ReferenceChips', () => {
    it('renders reference tokens and removes a selected reference', () => {
        const onRemove = vi.fn();
        render(<ReferenceChips references={[
            { assetId: 'asset-1', role: 'primary', token: '@1' },
            { assetId: 'asset-2', role: 'material', token: '@2' },
        ]} onRemove={onRemove} onAdd={vi.fn()} />);

        expect(screen.getByText('@1')).toBeInTheDocument();
        expect(screen.getByText('@2')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remove @2 reference' }));
        expect(onRemove).toHaveBeenCalledWith('asset-2');
    });
});
