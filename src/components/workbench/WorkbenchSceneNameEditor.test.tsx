import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkbenchSceneNameEditor } from './WorkbenchSceneNameEditor';

describe('WorkbenchSceneNameEditor', () => {
    it('submits a trimmed scene name and exits edit mode', () => {
        const onSave = vi.fn();
        render(<WorkbenchSceneNameEditor value="Board" onSave={onSave} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rename scene' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Scene name' }), { target: { value: '  Shared board  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save scene name' }));

        expect(onSave).toHaveBeenCalledWith('Shared board');
        expect(screen.queryByRole('textbox', { name: 'Scene name' })).not.toBeInTheDocument();
    });

    it('cancels edits without submitting', () => {
        const onSave = vi.fn();
        render(<WorkbenchSceneNameEditor value="Board" onSave={onSave} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rename scene' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Scene name' }), { target: { value: 'Discarded' } });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel scene name edit' }));

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText('Board')).toBeInTheDocument();
    });

    it('rejects blank names and reflects remote value updates', () => {
        const onSave = vi.fn();
        const { rerender } = render(<WorkbenchSceneNameEditor value="Board" onSave={onSave} />);

        fireEvent.click(screen.getByRole('button', { name: 'Rename scene' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Scene name' }), { target: { value: '  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save scene name' }));
        expect(onSave).not.toHaveBeenCalled();

        rerender(<WorkbenchSceneNameEditor value="Renamed remotely" onSave={onSave} />);
        expect(screen.getByText('Renamed remotely')).toBeInTheDocument();
    });
});
