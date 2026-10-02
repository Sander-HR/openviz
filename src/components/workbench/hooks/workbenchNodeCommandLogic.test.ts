import { describe, expect, it } from 'vitest';
import type { NoteWorkbenchNode, ImageNode } from '@/types';
import { buildNodeFieldDiff, buildNodeFieldPatches, getNodeResizeUpdates } from './workbenchNodeCommandLogic';

const note: NoteWorkbenchNode = {
    id: 'note-1',
    type: 'note',
    x: 10,
    y: 20,
    data: { text: 'Before', colorVariant: 'yellow' },
};

describe('buildNodeFieldPatches', () => {
    it('flattens nested objects into field paths and omits undefined values', () => {
        expect(buildNodeFieldPatches({
            width: 200,
            data: { text: 'After', style: { color: 'blue' }, unused: undefined },
        } as object)).toEqual([
            { path: ['width'], value: 200 },
            { path: ['data', 'text'], value: 'After' },
            { path: ['data', 'style', 'color'], value: 'blue' },
        ]);
    });
});

describe('buildNodeFieldDiff', () => {
    it('emits only changed nested values and leaves stable fields untouched', () => {
        const current = { ...note, data: { ...note.data, text: 'After' } };
        expect(buildNodeFieldDiff(note, current)).toEqual([{ path: ['data', 'text'], value: 'After' }]);
    });
});

describe('getNodeResizeUpdates', () => {
    it('creates position and dimension updates for a regular node', () => {
        expect(getNodeResizeUpdates(note, 200, 120, 15, 25)).toEqual({ width: 200, height: 120, x: 15, y: 25 });
    });

    it('updates image scale with the resized canvas dimensions', () => {
        const image: ImageNode = {
            id: 'image-1',
            type: 'image',
            name: 'Image',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            scale: 0.5,
            project: { canvas: { width: 400, height: 200 } } as ImageNode['project'],
        };
        expect(getNodeResizeUpdates(image, 200, 100)).toEqual({ width: 200, height: 100, scale: 0.5 });
    });
});
