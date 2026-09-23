import { describe, expect, it } from 'vitest';
import { WorkbenchNode } from '@/types';
import { getCanonicalConnectionFromDrop } from './workbenchConnectionLogic';

function createNode(type: WorkbenchNode['type'], id: string): WorkbenchNode {
    if (type === 'image') {
        return {
            id,
            type: 'image',
            name: id,
            x: 0,
            y: 0,
            project: {
                id,
                name: id,
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
        };
    }

    if (type === 'video') {
        return {
            id,
            type: 'video',
            name: id,
            x: 0,
            y: 0,
            project: {
                id,
                name: id,
                createdAt: 0,
                lastModifiedAt: 0,
                canvas: {
                    width: 512,
                    height: 512,
                    aspectRatio: 'square',
                    zoomLevel: 1,
                    panX: 0,
                    panY: 0,
                    backgroundColor: '#000',
                },
                layers: [],
            },
        };
    }

    if (type === 'animate') {
        return {
            id,
            type: 'animate',
            x: 0,
            y: 0,
            data: {
                prompt: '',
                frames: {},
                settings: {
                    model: 'default',
                    duration: '2s',
                },
            },
        };
    }

    if (type === 'arrow') {
        return {
            id,
            type: 'arrow',
            x: 0,
            y: 0,
            data: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
                control: { x: 5, y: 5 },
                strokeColor: '#000',
                strokeWidth: 2,
            },
        };
    }

    if (type === 'text') {
        return { id, type: 'text', x: 0, y: 0, data: { text: '', fontSize: 24, color: '#111827' } };
    }

    if (type === 'note') {
        return { id, type: 'note', x: 0, y: 0, data: { text: '', colorVariant: 'yellow' } };
    }

    return {
        id,
        type: 'render',
        x: 0,
        y: 0,
        data: {
            prompt: '',
            stylePreset: 'Photorealistic',
            drawingInfluence: 0.5,
            numImages: 1,
        },
    };
}

describe('getCanonicalConnectionFromDrop', () => {
    it('maps reverse drag from animate target to image into image -> animate', () => {
        const nodes: WorkbenchNode[] = [createNode('animate', 'animate-1'), createNode('image', 'image-1')];
        const result = getCanonicalConnectionFromDrop({ nodeId: 'animate-1', handleType: 'target' }, 'image-1', nodes);
        expect(result).toEqual({
            fromId: 'image-1',
            toId: 'animate-1',
            sourceHandle: 'image-source',
            targetHandle: null,
        });
    });

    it('maps reverse drag from render target to image into image -> render', () => {
        const nodes: WorkbenchNode[] = [createNode('render', 'render-1'), createNode('image', 'image-1')];
        const result = getCanonicalConnectionFromDrop({ nodeId: 'render-1', handleType: 'target' }, 'image-1', nodes);
        expect(result).toEqual({
            fromId: 'image-1',
            toId: 'render-1',
            sourceHandle: 'image-source',
            targetHandle: null,
        });
    });

    it('returns null for non-image drop target or non-target handle starts', () => {
        const nodes: WorkbenchNode[] = [
            createNode('render', 'render-1'),
            createNode('animate', 'animate-1'),
            createNode('video', 'video-1'),
            createNode('image', 'image-1'),
        ];

        expect(getCanonicalConnectionFromDrop({ nodeId: 'render-1', handleType: 'target' }, 'video-1', nodes)).toBeNull();
        expect(getCanonicalConnectionFromDrop({ nodeId: 'animate-1', handleType: 'source' }, 'image-1', nodes)).toBeNull();
    });

    it('returns null when start/target/node lookup is missing', () => {
        const nodes: WorkbenchNode[] = [createNode('render', 'render-1'), createNode('image', 'image-1')];
        expect(getCanonicalConnectionFromDrop(null, 'image-1', nodes)).toBeNull();
        expect(getCanonicalConnectionFromDrop({ nodeId: 'missing', handleType: 'target' }, 'image-1', nodes)).toBeNull();
        expect(getCanonicalConnectionFromDrop({ nodeId: 'render-1', handleType: 'target' }, null, nodes)).toBeNull();
    });
});

describe('FR-015: arrow/text/note are not connection targets', () => {
    const excludedTypes: Array<'arrow' | 'text' | 'note'> = ['arrow', 'text', 'note'];

    it.each(excludedTypes)('%s node as drop target yields no canonical connection', (excludedType) => {
        const nodes: WorkbenchNode[] = [
            createNode('render', 'render-1'),
            createNode(excludedType, `${excludedType}-1`),
        ];
        expect(
            getCanonicalConnectionFromDrop({ nodeId: 'render-1', handleType: 'target' }, `${excludedType}-1`, nodes)
        ).toBeNull();
    });

    it.each(excludedTypes)('%s node as connection source yields no canonical connection', (excludedType) => {
        const nodes: WorkbenchNode[] = [
            createNode('image', 'image-1'),
            createNode(excludedType, `${excludedType}-1`),
        ];
        expect(
            getCanonicalConnectionFromDrop({ nodeId: `${excludedType}-1`, handleType: 'target' }, 'image-1', nodes)
        ).toBeNull();
    });

    // Structural guarantee (verified by code inspection): ArrowNode/TextNode/
    // NoteNode render no <Handle> elements, so React Flow never offers them as
    // drag sources or drop targets in the first place.
});
