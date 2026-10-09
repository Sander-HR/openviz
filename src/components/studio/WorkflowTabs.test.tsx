import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowTabs } from './WorkflowTabs';

describe('WorkflowTabs', () => {
    it('switches the active workflow tab', () => {
        const onChange = vi.fn();
        render(<WorkflowTabs active="modify" onChange={onChange} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Variation' }));
        expect(onChange).toHaveBeenCalledWith('variation');
    });
});
