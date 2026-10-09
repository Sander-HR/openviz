import type { FilterFunction } from 'konva/lib/Node';

export const lightAdjustments = ['Exposure', 'Contrast', 'Highlights', 'Shadows'] as const;
export const colorAdjustments = ['Temp', 'Tint', 'Hue', 'Vibrance', 'Saturation', 'Lightness'] as const;

export type AdjustmentName = (typeof lightAdjustments | typeof colorAdjustments)[number];

export interface AdjustmentValues {
    Exposure: number;
    Contrast: number;
    Highlights: number;
    Shadows: number;
    Temp: number;
    Tint: number;
    Hue: number;
    Vibrance: number;
    Saturation: number;
    Lightness: number;
    whitePoint: string;
}

export const initialAdjustments: AdjustmentValues = {
    Exposure: 0,
    Contrast: 0,
    Highlights: 0,
    Shadows: 0,
    Temp: 0,
    Tint: 0,
    Hue: 0,
    Vibrance: 0,
    Saturation: 0,
    Lightness: 0,
    whitePoint: '#ffffff',
};

export const hasAdjustments = (values?: AdjustmentValues): boolean => {
    if (!values) return false;
    return Object.entries(values).some(([key, value]) => key === 'whitePoint' ? value !== '#ffffff' : value !== 0);
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = clamp((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
};

const rgbToHsl = (red: number, green: number, blue: number) => {
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const lightness = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: lightness };

    const delta = max - min;
    const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    let hue = max === red
        ? (green - blue) / delta + (green < blue ? 6 : 0)
        : max === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4;
    hue /= 6;
    return { h: hue, s: saturation, l: lightness };
};

const hueToRgb = (p: number, q: number, t: number) => {
    let hue = t;
    if (hue < 0) hue += 1;
    if (hue > 1) hue -= 1;
    if (hue < 1 / 6) return p + (q - p) * 6 * hue;
    if (hue < 1 / 2) return q;
    if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
    return p;
};

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
    if (saturation === 0) return { r: lightness, g: lightness, b: lightness };
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    return {
        r: hueToRgb(p, q, hue + 1 / 3),
        g: hueToRgb(p, q, hue),
        b: hueToRgb(p, q, hue - 1 / 3),
    };
};

const whitePointFactors = (whitePoint: string) => {
    const hex = whitePoint.replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return { r: 1, g: 1, b: 1 };
    const red = parseInt(hex.slice(0, 2), 16) / 255;
    const green = parseInt(hex.slice(2, 4), 16) / 255;
    const blue = parseInt(hex.slice(4, 6), 16) / 255;
    return { r: red ? 1 / red : 1, g: green ? 1 / green : 1, b: blue ? 1 / blue : 1 };
};

export const createAdjustmentsFilter = (values: AdjustmentValues): FilterFunction => {
    const exposureGain = 2 ** values.Exposure;
    const contrast = 1 + values.Contrast / 100;
    const temperature = values.Temp / 100;
    const tint = values.Tint / 100;
    const vibrance = values.Vibrance / 100;
    const saturationAmount = 1 + values.Saturation / 100;
    const lightnessAmount = values.Lightness / 100;
    const hueShift = values.Hue / 360;
    const whitePoint = whitePointFactors(values.whitePoint);

    return function (imageData) {
        const data = imageData.data;
        for (let index = 0; index < data.length; index += 4) {
            if (data[index + 3] === 0) continue;
            let red = (data[index] / 255) * exposureGain * whitePoint.r;
            let green = (data[index + 1] / 255) * exposureGain * whitePoint.g;
            let blue = (data[index + 2] / 255) * exposureGain * whitePoint.b;

            red = (red - 0.5) * contrast + 0.5;
            green = (green - 0.5) * contrast + 0.5;
            blue = (blue - 0.5) * contrast + 0.5;

            const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
            const highlightMask = smoothstep(0.45, 1, luminance);
            const shadowMask = 1 - smoothstep(0, 0.55, luminance);
            const adjustedLuminance = luminance
                + (values.Highlights / 100) * highlightMask * (1 - luminance)
                + (values.Shadows / 100) * shadowMask * luminance;
            if (luminance > 0.00001) {
                const scale = adjustedLuminance / luminance;
                red *= scale;
                green *= scale;
                blue *= scale;
            }

            red *= 1 + 0.15 * temperature + 0.06 * tint;
            green *= 1 - 0.12 * tint;
            blue *= 1 - 0.15 * temperature + 0.06 * tint;

            const hsl = rgbToHsl(clamp(red), clamp(green), clamp(blue));
            hsl.h = (hsl.h + hueShift + 1) % 1;
            hsl.s = clamp(hsl.s * (1 + vibrance * (1 - hsl.s)) * saturationAmount);
            hsl.l = clamp(hsl.l + lightnessAmount * 0.5);
            const adjusted = hslToRgb(hsl.h, hsl.s, hsl.l);

            data[index] = Math.round(clamp(adjusted.r) * 255);
            data[index + 1] = Math.round(clamp(adjusted.g) * 255);
            data[index + 2] = Math.round(clamp(adjusted.b) * 255);
        }
    };
};