import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@xyflow/react', () => ({
    NodeResizer: () => null,
}));

import { MediaNode } from './MediaNode';
import type { MediaWorkbenchNode } from '@/types';

function makeData(src: string | null = 'blob:http://localhost/abc') {
    const base: MediaWorkbenchNode = {
        id: 'media-1',
        type: 'media',
        x: 0,
        y: 0,
        width: 260,
        height: 180,
        data: { src: src ?? '', alt: 'sunset.png', mimeType: 'image/png' },
    };
    return base;
}

describe('MediaNode fallback (C-5.4 / FR-013)', () => {
    it('renders the image when a src is present', () => {
        const { container } = render(<MediaNode id="media-1" data={makeData()} selected={false} />);
        const img = container.querySelector('img');
        expect(img).toBeTruthy();
        expect(img?.getAttribute('src')).toBe('blob:http://localhost/abc');
        expect(img?.getAttribute('alt')).toBe('sunset.png');
    });

    it('renders a fallback instead of an image when there is no src', () => {
        const { container } = render(<MediaNode id="media-1" data={makeData(null)} selected={false} />);
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain('Media unavailable');
    });

    it('switches to the fallback (icon + alt text) when the image fails to load', () => {
        const { container } = render(<MediaNode id="media-1" data={makeData()} selected={false} />);
        const img = container.querySelector('img') as HTMLImageElement;

        fireEvent.error(img);

        // Broken-image glyph must not remain; fallback shows the alt text.
        expect(container.querySelector('img')).toBeNull();
        expect(container.textContent).toContain('sunset.png');
    });
});
