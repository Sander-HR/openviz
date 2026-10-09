import { describe, expect, it } from 'vitest';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { createAdjustmentsFilter, initialAdjustments } from './adjustments';

const createImageData = (pixels: number[]) => ({ data: new Uint8ClampedArray(pixels) }) as ImageData;

describe('adjustments filter', () => {
    it('leaves default pixels unchanged', () => {
        const imageData = createImageData([80, 120, 160, 200]);
        createAdjustmentsFilter(initialAdjustments).call({} as KonvaNode, imageData);
        expect(Array.from(imageData.data)).toEqual([80, 120, 160, 200]);
    });

    it('changes light and color values without changing alpha', () => {
        const imageData = createImageData([80, 120, 160, 200]);
        createAdjustmentsFilter({ ...initialAdjustments, Exposure: 1, Temp: 100, Hue: 30 }).call({} as KonvaNode, imageData);
        expect(Array.from(imageData.data)).not.toEqual([80, 120, 160, 200]);
        expect(imageData.data[3]).toBe(200);
    });
});