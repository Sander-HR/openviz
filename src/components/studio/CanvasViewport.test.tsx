import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Layer } from '../../types';

// Sprint 3: Studio layer images must not load while the view is hidden.
// use-image is the single seam that starts an image request — spy on it.
const useImageMock = vi.fn((_src: string, _cors?: string) => [null]);
vi.mock('use-image', () => ({ default: (src: string, cors?: string) => useImageMock(src, cors) }));

// Konva needs a real canvas — jsdom has none. Replace react-konva nodes with
// inert DOM elements; the test target is the image-gating decision, not drawing.
vi.mock('react-konva', () => ({
    Group: ({ children }: { children?: React.ReactNode }) => <div data-testid="layer-group">{children}</div>,
    Line: (props: Record<string, unknown>) => <span data-testid={`line-${String(props.stroke ?? '')}`} />,
    Rect: () => <span data-testid="rect" />,
    Circle: () => <span data-testid="circle" />,
    Image: ({ image }: { image?: unknown }) => <img data-testid="konva-image" data-loaded={image ? 'true' : 'false'} alt="" />,
}));

import { LayerGroup } from './CanvasViewport';

const baseLayer: Layer = {
    id: 'layer-1',
    name: 'Layer 1',
    type: 'image',
    order: 0,
    locked: false,
    created: 1,
    opacity: 100,
    strokes: [],
    visible: true,
    modified: 1,
    blendMode: 'normal',
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    image: '/api/assets/abc?thumb=1',
};

const renderGroup = (layer: Layer, imagesArmed: boolean) =>
    render(
        <LayerGroup
            layer={layer}
            activeLayerId={null}
            activeTool="select"
            previewShape={null}
            updateLayer={() => undefined}
            canvasWidth={1024}
            canvasHeight={1024}
            imagesArmed={imagesArmed}
        />,
    );

describe('LayerGroup image gating (Sprint 3 Task 3.1)', () => {
    it('makes no image request while Studio is hidden', () => {
        useImageMock.mockClear();
        renderGroup(baseLayer, false);
        expect(useImageMock).not.toHaveBeenCalled();
    });

    it('loads the layer image once armed (first visibility)', () => {
        useImageMock.mockClear();
        renderGroup(baseLayer, true);
        expect(useImageMock).toHaveBeenCalledWith('/api/assets/abc?thumb=1', 'anonymous');
    });

    it('keeps hidden layers unloaded until unhidden', () => {
        useImageMock.mockClear();
        const { rerender } = render(
            <LayerGroup
                layer={{ ...baseLayer, visible: false }}
                activeLayerId={null}
                activeTool="select"
                previewShape={null}
                updateLayer={() => undefined}
                canvasWidth={1024}
                canvasHeight={1024}
                imagesArmed={true}
            />,
        );
        expect(useImageMock).not.toHaveBeenCalled();
        rerender(
            <LayerGroup
                layer={{ ...baseLayer, visible: true }}
                activeLayerId={null}
                activeTool="select"
                previewShape={null}
                updateLayer={() => undefined}
                canvasWidth={1024}
                canvasHeight={1024}
                imagesArmed={true}
            />,
        );
        expect(useImageMock).toHaveBeenCalledWith('/api/assets/abc?thumb=1', 'anonymous');
    });

    it('layers without an image never request one', () => {
        useImageMock.mockClear();
        renderGroup({ ...baseLayer, image: undefined }, true);
        expect(useImageMock).not.toHaveBeenCalled();
    });
});
