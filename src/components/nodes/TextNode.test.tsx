import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', () => ({
    NodeResizer: () => null,
}));

import { TextNode } from './TextNode';
import type { TextWorkbenchNode } from '@/types';

function makeData(text = '', onDataChange?: (id: string, data: Record<string, unknown>) => void) {
    const base: TextWorkbenchNode = {
        id: 'text-1',
        type: 'text',
        x: 0,
        y: 0,
        width: 240,
        height: 72,
        data: { text, fontSize: 24, color: '#111827' },
    };
    return { ...base, onDataChange };
}

describe('TextNode editing (C-3.1)', () => {
    it('shows the placeholder when empty and the content otherwise', () => {
        const empty = render(<TextNode id="text-1" data={makeData()} selected={false} />);
        expect(empty.getByText('Text')).toBeTruthy();

        const filled = render(<TextNode id="text-1" data={makeData('Hello')} selected={false} />);
        expect(filled.getByText('Hello')).toBeTruthy();
    });

    it('double-click opens a focused textarea (C-3.1)', () => {
        const { container } = render(<TextNode id="text-1" data={makeData('Hi')} selected={true} />);
        expect(container.querySelector('textarea')).toBeNull();

        fireEvent.doubleClick(container.firstElementChild as HTMLElement);

        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        expect(textarea).toBeTruthy();
        expect(textarea.value).toBe('Hi');
        expect(document.activeElement).toBe(textarea);
    });

    it('typing reports the new text through onDataChange', () => {
        const onDataChange = vi.fn();
        const { container } = render(<TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />);
        fireEvent.doubleClick(container.firstElementChild as HTMLElement);

        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Hello world' } });

        expect(onDataChange).toHaveBeenCalledWith('text-1', { text: 'Hello world' });
    });

    it('blur exits edit mode and the updated data renders on re-render (C-3.1 persist)', () => {
        const onDataChange = vi.fn();
        const { container, rerender } = render(
            <TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />
        );
        fireEvent.doubleClick(container.firstElementChild as HTMLElement);

        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Updated' } });
        fireEvent.blur(textarea);

        // Edit mode closed
        expect(container.querySelector('textarea')).toBeNull();

        // Store applied the change → re-render with updated node data
        rerender(
            <TextNode id="text-1" data={makeData('Updated', onDataChange)} selected={true} />
        );
        expect(container.querySelector('textarea')).toBeNull();
        expect(container.textContent).toContain('Updated');
    });
});

describe('TextNode formatting toolbar', () => {
    it('is hidden when the node is not selected', () => {
        const { queryByTitle } = render(<TextNode id="text-1" data={makeData()} selected={false} />);
        expect(queryByTitle('Bold')).toBeNull();
        expect(queryByTitle('More')).toBeNull();
    });

    it('shows color, font, size, bold, underline, align and more controls when selected', () => {
        const { getByTitle, getByLabelText } = render(<TextNode id="text-1" data={makeData()} selected={true} />);
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
        const { getByTitle } = render(<TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.click(getByTitle('Bold'));
        expect(onDataChange).toHaveBeenCalledWith('text-1', { fontWeight: 700 });
    });

    it('toggles underline through onDataChange', () => {
        const onDataChange = vi.fn();
        const { getByTitle } = render(<TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.click(getByTitle('Underline'));
        expect(onDataChange).toHaveBeenCalledWith('text-1', { underline: true });
    });

    it('opens a popover with 12 preset swatches from the color button', () => {
        const { getByLabelText } = render(<TextNode id="text-1" data={makeData()} selected={true} />);
        expect(screen.queryByLabelText('Color #ef4444')).toBeNull();

        fireEvent.click(getByLabelText('Text color'));
        expect(screen.getByLabelText('Color #ef4444')).toBeTruthy();
        expect(screen.getAllByLabelText(/^Color #/)).toHaveLength(12);
    });

    it('picks a preset swatch through onDataChange', () => {
        const onDataChange = vi.fn();
        const { getByLabelText } = render(<TextNode id="text-1" data={makeData('', onDataChange)} selected={true} />);

        fireEvent.click(getByLabelText('Text color'));
        fireEvent.click(screen.getByLabelText('Color #3b82f6'));
        expect(onDataChange).toHaveBeenCalledWith('text-1', { color: '#3b82f6' });
    });

    it('picks a font size from the size menu', () => {
        const onDataChange = vi.fn();
        render(<TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />);

        // Radix DropdownMenu.Trigger opens on pointerdown (button 0).
        fireEvent.pointerDown(screen.getByTitle('Size'), { button: 0 });
        fireEvent.click(screen.getByText('32px'));
        expect(onDataChange).toHaveBeenCalledWith('text-1', { fontSize: 32 });
    });

    it('picks a font family from the font menu', () => {
        const onDataChange = vi.fn();
        render(<TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.pointerDown(screen.getByTitle('Font'), { button: 0 });
        fireEvent.click(screen.getByText('Mono'));
        expect(onDataChange).toHaveBeenCalledWith('text-1', {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        });
    });

    it('picks an alignment from the align menu', () => {
        const onDataChange = vi.fn();
        render(<TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.pointerDown(screen.getByTitle('Align'), { button: 0 });
        fireEvent.click(screen.getByText('Align center'));
        expect(onDataChange).toHaveBeenCalledWith('text-1', { align: 'center' });
    });

    it('toggles italic from the more menu', () => {
        const onDataChange = vi.fn();
        render(<TextNode id="text-1" data={makeData('Hi', onDataChange)} selected={true} />);

        fireEvent.pointerDown(screen.getByTitle('More'), { button: 0 });
        fireEvent.click(screen.getByText('Italic'));
        expect(onDataChange).toHaveBeenCalledWith('text-1', { fontStyle: 'italic' });
    });
});
