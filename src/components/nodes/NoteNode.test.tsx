import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', () => ({
    NodeResizer: () => null,
}));

import { NoteNode } from './NoteNode';
import type { NoteWorkbenchNode } from '@/types';

function makeData(text = '', onDataChange?: (id: string, data: Record<string, unknown>) => void) {
    const base: NoteWorkbenchNode = {
        id: 'note-1',
        type: 'note',
        x: 0,
        y: 0,
        width: 220,
        height: 180,
        data: { text, colorVariant: 'yellow' },
    };
    return { ...base, onDataChange };
}

describe('NoteNode editing (C-3.1)', () => {
    it('shows the placeholder when empty and the content otherwise', () => {
        const empty = render(<NoteNode id="note-1" data={makeData()} selected={false} />);
        expect(empty.getByText('Note')).toBeTruthy();

        const filled = render(<NoteNode id="note-1" data={makeData('Idea!')} selected={false} />);
        expect(filled.getByText('Idea!')).toBeTruthy();
    });

    it('renders the yellow variant background (C-4.3 default)', () => {
        const { container } = render(<NoteNode id="note-1" data={makeData()} selected={false} />);
        expect(container.firstElementChild).toHaveClass('bg-amber-100');
    });

    it('double-click opens a focused textarea (C-3.1)', () => {
        const { container } = render(<NoteNode id="note-1" data={makeData('Hi')} selected={true} />);
        expect(container.querySelector('textarea')).toBeNull();

        fireEvent.doubleClick(container.firstElementChild as HTMLElement);

        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
        expect(textarea.value).toBe('Hi');
        expect(document.activeElement).toBe(textarea);
    });

    it('typing reports the new text through onDataChange and blur persists on re-render', () => {
        const onDataChange = vi.fn();
        const { container, rerender } = render(
            <NoteNode id="note-1" data={makeData('Hi', onDataChange)} selected={true} />
        );
        fireEvent.doubleClick(container.firstElementChild as HTMLElement);

        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Better idea' } });
        expect(onDataChange).toHaveBeenCalledWith('note-1', { text: 'Better idea' });

        fireEvent.blur(textarea);
        expect(container.querySelector('textarea')).toBeNull();

        rerender(<NoteNode id="note-1" data={makeData('Better idea', onDataChange)} selected={true} />);
        expect(container.textContent).toContain('Better idea');
    });
});

describe('NoteNode formatting toolbar', () => {
    it('is hidden when the note is not selected', () => {
        const { queryByTitle } = render(<NoteNode id="note-1" data={makeData()} selected={false} />);
        expect(queryByTitle('Bold')).toBeNull();
        expect(queryByTitle('More')).toBeNull();
    });

    it('shows color, font, size, bold, underline, align and more controls when selected', () => {
        const { getByTitle, getByLabelText } = render(<NoteNode id="note-1" data={makeData()} selected={true} />);
        expect(getByLabelText('Text color')).toBeTruthy();
        expect(getByTitle('Font')).toBeTruthy();
        expect(getByTitle('Size')).toBeTruthy();
        expect(getByTitle('Bold')).toBeTruthy();
        expect(getByTitle('Underline')).toBeTruthy();
        expect(getByTitle('Align')).toBeTruthy();
        expect(getByTitle('More')).toBeTruthy();
    });

    it('toggles bold through onDataChange', () => {
        const onDataChange = vi.fn();
        const { getByTitle } = render(<NoteNode id="note-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.click(getByTitle('Bold'));
        expect(onDataChange).toHaveBeenCalledWith('note-1', { fontWeight: 700 });
    });

    it('toggles underline through onDataChange', () => {
        const onDataChange = vi.fn();
        const { getByTitle } = render(<NoteNode id="note-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.click(getByTitle('Underline'));
        expect(onDataChange).toHaveBeenCalledWith('note-1', { underline: true });
    });

    it('opens a popover with 12 preset swatches from the color button', () => {
        const { getByLabelText } = render(<NoteNode id="note-1" data={makeData()} selected={true} />);
        expect(screen.queryByLabelText('Color #ef4444')).toBeNull();

        fireEvent.click(getByLabelText('Text color'));
        expect(screen.getByLabelText('Color #ef4444')).toBeTruthy();
        expect(screen.getAllByLabelText(/^Color #/)).toHaveLength(12);
    });

    it('picks a preset swatch through onDataChange', () => {
        const onDataChange = vi.fn();
        const { getByLabelText } = render(<NoteNode id="note-1" data={makeData('', onDataChange)} selected={true} />);

        fireEvent.click(getByLabelText('Text color'));
        fireEvent.click(screen.getByLabelText('Color #22c55e'));
        expect(onDataChange).toHaveBeenCalledWith('note-1', { color: '#22c55e' });
    });

    it('picks a font size from the size menu', () => {
        const onDataChange = vi.fn();
        render(<NoteNode id="note-1" data={makeData('Hi', onDataChange)} selected={true} />);

        // Radix DropdownMenu.Trigger opens on pointerdown (button 0).
        fireEvent.pointerDown(screen.getByTitle('Size'), { button: 0 });
        fireEvent.click(screen.getByText('32px'));
        expect(onDataChange).toHaveBeenCalledWith('note-1', { fontSize: 32 });
    });

    it('picks an alignment from the align menu', () => {
        const onDataChange = vi.fn();
        render(<NoteNode id="note-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.pointerDown(screen.getByTitle('Align'), { button: 0 });
        fireEvent.click(screen.getByText('Align center'));
        expect(onDataChange).toHaveBeenCalledWith('note-1', { align: 'center' });
    });
});
