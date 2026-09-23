import { describe, expect, it } from 'vitest';

import { ImageNode } from '@/types';

import {
    createAnimateNodeFromSource,
    createRenderNodeFromSource,
} from './workbenchBlockCreationLogic';

function createImageSourceNode(overrides: Partial<ImageNode> = {}): ImageNode {
    return {
        id: 'source-1',
        type: 'image',
        name: 'Source',
        x: 100,
        y: 200,
        width: 400,
        height: 300,
        project: {
            id: 'project-1',
            name: 'Project',
            createdAt: 0,
            lastModifiedAt: 0,
            canvas: {
                width: 512,
                height: 512,
                aspectRatio: 'square',
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

describe('workbench block creation logic', () => {
    it('creates render node with expected defaults and position', () => {
        const sourceNode = createImageSourceNode();
        const renderNode = createRenderNodeFromSource(sourceNode, 'render-1');

        expect(renderNode).toMatchObject({
            id: 'render-1',
            type: 'render',
            x: 600,
            y: 200,
            width: 320,
            height: 500,
            data: {
                prompt: '',
                stylePreset: 'Photorealistic',
                drawingInfluence: 0.65,
                numImages: 1,
            },
        });
    });

    it('creates animate node centered vertically relative to source', () => {
        const sourceNode = createImageSourceNode({ height: 420 });
        const animateNode = createAnimateNodeFromSource(sourceNode, 'animate-1');

        expect(animateNode).toMatchObject({
            id: 'animate-1',
            type: 'animate',
            x: 600,
            y: 250,
            width: 320,
            height: 320,
            data: {
                prompt: '',
                frames: { start: 'source-1' },
                settings: { model: 'default', duration: '2s' },
            },
        });
    });

    it('uses scale-derived source width when explicit dimensions are missing', () => {
        const sourceNode = createImageSourceNode({ width: undefined, scale: 0.5 });
        const renderNode = createRenderNodeFromSource(sourceNode, 'render-2');

        expect(renderNode.x).toBe(456);
    });
});
