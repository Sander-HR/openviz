import { fireEvent, render } from '@testing-library/react';
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
