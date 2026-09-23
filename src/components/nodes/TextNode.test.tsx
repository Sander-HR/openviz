import { fireEvent, render } from '@testing-library/react';
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
