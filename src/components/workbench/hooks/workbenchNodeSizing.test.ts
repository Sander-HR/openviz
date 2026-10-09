import { describe, expect, it } from 'vitest';

import { ImageNode, RenderNode } from '@/types';

import { getWorkbenchNodeSize } from './workbenchNodeSizing';

function createImageNode(overrides: Partial<ImageNode> = {}): ImageNode {
    return {
        id: 'image-1',
        type: 'image',
        name: 'Image',
        x: 0,
        y: 0,
        project: {
            id: 'project-1',
            name: 'Project',
            createdAt: 0,
            lastModifiedAt: 0,
            canvas: {
                width: 512,
                height: 256,
                aspectRatio: 'landscape',
                zoomLevel: 1,
                panX: 0,
                panY: 0,
                backgroundColor: '#fff',
            },
            layers: [],
        },
        ...overrides,
    };
}

describe('getWorkbenchNodeSize', () => {
    it('uses scale and canvas for image/video nodes', () => {
        const node = createImageNode({ scale: 0.5, width: 100, height: 100 });
        expect(getWorkbenchNodeSize(node)).toEqual({ width: 256, height: 128 });
    });

    it('falls back to node width/height when no scale-based size is available', () => {
        const node = createImageNode({ scale: undefined, width: 300, height: 200 });
        expect(getWorkbenchNodeSize(node)).toEqual({ width: 300, height: 200 });
    });

    it('falls back to default 256 for invalid dimensions', () => {
        const node: RenderNode = {
            id: 'render-1',
            type: 'render',
            x: 0,
            y: 0,
            width: 0,
            height: -1,
            data: {
                prompt: '',
                stylePreset: 'Photorealistic',
                drawingInfluence: 0.5,
                numImages: 1,
            },
        };

        expect(getWorkbenchNodeSize(node)).toEqual({ width: 256, height: 256 });
    });
});
