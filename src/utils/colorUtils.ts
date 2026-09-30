export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const v = max;

    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max === min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }

    return { h: h * 360, s: s * 100, v: v * 100 };
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    // Let's redo to be safer and clearer
    s = s / 100;
    v = v / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r1 = 0, g1 = 0, b1 = 0;

    if (h >= 0 && h < 60) {
        r1 = c; g1 = x; b1 = 0;
    } else if (h >= 60 && h < 120) {
        r1 = x; g1 = c; b1 = 0;
    } else if (h >= 120 && h < 180) {
        r1 = 0; g1 = c; b1 = x;
    } else if (h >= 180 && h < 240) {
        r1 = 0; g1 = x; b1 = c;
    } else if (h >= 240 && h < 300) {
        r1 = x; g1 = 0; b1 = c;
    } else if (h >= 300 && h <= 360) {
        r1 = c; g1 = 0; b1 = x;
    }

    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
    const rgb = hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, v: 0 };
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

export function hsvToHex(h: number, s: number, v: number): string {
    const rgb = hsvToRgb(h, s, v);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function normalizeHex(hex: string): string | null {
    const rgb = hexToRgb(hex.trim());
    return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : null;
}

export function extractPaletteFromImageData(imageData: ImageData, maxColors = 5): string[] {
    const buckets = new Map<string, number>();
    for (let index = 0; index < imageData.data.length; index += 4) {
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];
        const alpha = imageData.data[index + 3];
        if (alpha < 128) continue;
        const quantize = (channel: number) => Math.min(255, Math.round(channel / 16) * 16);
        const key = rgbToHex(quantize(r), quantize(g), quantize(b));
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return [...buckets.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, maxColors)
        .map(([color]) => color);
}
