import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModifyPanel } from './ModifyPanel';

describe('ModifyPanel', () => {
    it('submits a direct product edit prompt', () => {
        const onGenerate = vi.fn();
        render(<ModifyPanel height={400} onGenerate={onGenerate} />);
        fireEvent.change(screen.getByLabelText('Modify prompt'), { target: { value: 'Change the finish to brushed aluminum.' } });
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
        expect(onGenerate).toHaveBeenCalledWith('Change the finish to brushed aluminum.');
    });

    it('supports shortcut actions with the current prompt', () => {
        const onGenerate = vi.fn();
        const onAction = vi.fn();
        render(<ModifyPanel height={400} onGenerate={onGenerate} onAction={onAction} />);
        fireEvent.change(screen.getByLabelText('Modify prompt'), { target: { value: 'Show another angle.' } });
        fireEvent.click(screen.getByRole('button', { name: 'New view' }));
        expect(onAction).toHaveBeenCalledWith('new-view');
        expect(onGenerate).toHaveBeenCalledWith('Show another angle.');
        expect(screen.getByRole('button', { name: 'New view' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('collapses to its header', () => {
        render(<ModifyPanel height={400} />);

        const toggle = screen.getByRole('button', { name: 'Modify' });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByLabelText('Modify prompt')).toBeInTheDocument();

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByLabelText('Modify prompt')).not.toBeInTheDocument();
    });
});
