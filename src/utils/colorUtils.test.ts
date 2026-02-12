import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from './colorUtils';

describe('colorUtils', () => {
    describe('hexToRgb', () => {
        it('converts #ffffff to white', () => {
            expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('converts #000000 to black', () => {
            expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('handles missing #', () => {
            expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('returns null for invalid hex', () => {
            expect(hexToRgb('invalid')).toBeNull();
        });
    });

    describe('rgbToHex', () => {
        it('converts white to #ffffff', () => {
            expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
        });

        it('converts black to #000000', () => {
            expect(rgbToHex(0, 0, 0)).toBe('#000000');
        });
    });

    describe('rgbToHsv and hsvToRgb', () => {
        it('roundtrips red', () => {
            const rgb = { r: 255, g: 0, b: 0 };
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            expect(hsvToRgb(hsv.h, hsv.s, hsv.v)).toEqual(rgb);
        });

        it('roundtrips green', () => {
            const rgb = { r: 0, g: 255, b: 0 };
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            expect(hsvToRgb(hsv.h, hsv.s, hsv.v)).toEqual(rgb);
        });
    });
});
