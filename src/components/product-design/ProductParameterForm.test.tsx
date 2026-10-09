import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductParameterForm } from './ProductParameterForm';

describe('ProductParameterForm', () => {
    it('submits a labeled prompt and batch selection', () => {
        const onSubmit = vi.fn();
        render(<ProductParameterForm prompt="" batchSize={1} aspectRatio="1:1" onPromptChange={vi.fn()} onBatchSizeChange={vi.fn()} onAspectRatioChange={vi.fn()} onSubmit={onSubmit} />);

        fireEvent.change(screen.getByLabelText(/product description/i), { target: { value: 'A modular lamp' } });
        fireEvent.click(screen.getByRole('button', { name: /generate concepts/i }));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });
});
