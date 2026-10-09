import { describe, expect, it } from 'vitest';

import { getBoundingBox, pointsToPath } from './strokeUtils';

describe('strokeUtils', () => {
    it('returns a closed SVG path for valid points', () => {
        const path = pointsToPath([
            { x: 0, y: 0 },
            { x: 25, y: 10 },
            { x: 40, y: 20 },
        ]);

        expect(path.startsWith('M ')).toBe(true);
        expect(path.includes(' L ')).toBe(true);
        expect(path.endsWith(' Z')).toBe(true);
    });

    it('returns an empty path for fewer than two points', () => {
        expect(pointsToPath([])).toBe('');
        expect(pointsToPath([{ x: 1, y: 2 }])).toBe('');
    });

    it('computes bounding boxes from points', () => {
        expect(
            getBoundingBox([
                { x: 10, y: -2 },
                { x: -4, y: 8 },
                { x: 6, y: 3 },
            ])
        ).toEqual({
            minX: -4,
            minY: -2,
            maxX: 10,
            maxY: 8,
            width: 14,
            height: 10,
        });
    });

    it('returns null bounding box for empty input', () => {
        expect(getBoundingBox([])).toBeNull();
    });
});
