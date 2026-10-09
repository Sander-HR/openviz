import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductWorkflowPicker } from './ProductWorkflowPicker';

describe('ProductWorkflowPicker', () => {
    it('exposes task workflows as keyboard-operable choices', () => {
        const onChange = vi.fn();
        render(<ProductWorkflowPicker selectedWorkflowId="product_concept" onChange={onChange} />);

        expect(screen.getByRole('tab', { name: /product concept/i })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('tab', { name: /modify product/i }));
        expect(onChange).toHaveBeenCalledWith('product_edit');
    });
});
