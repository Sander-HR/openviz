/**
 * Feature 012 — T023 deterministic client-side color analysis (FR-018, SC-007).
 *
 * Samples pixels inside a normalized region box and clusters them into
 * 16-level-per-channel buckets. The dominant bucket's mean color is the
 * representative hex; confidence is its share of sampled opaque pixels.
 * Pure over RGBA buffers so it is fully unit-testable with synthetic
 * canvases; `loadPixelBufferFromDataUrl` is the thin browser-only loader.
 */

import type { ExtractionRegion } from '@/types/renderTask.types';

export interface PixelBuffer {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}

export interface RegionColorResult {
    /** `#rrggbb` of the dominant cluster, or null when nothing opaque was sampled. */
    hex: string | null;
    /** Dominant cluster share of sampled opaque pixels, 0–1. */
    confidence: number;
    /** Opaque pixel count that went into the clustering. */
    sampledPixels: number;
    /** Up to 3 cluster hexes in descending share order. */
    dominantHexes: string[];
}

interface PixelSample {
    r: number;
    g: number;
    b: number;
    a: number;
}

/** Test helper: build an RGBA buffer from a per-pixel function (x, y). */
export function buildPixelBuffer(width: number, height: number, pixelAt: (x: number, y: number) => PixelSample): PixelBuffer {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const pixel = pixelAt(x, y);
            const offset = (y * width + x) * 4;
            data[offset] = pixel.r;
            data[offset + 1] = pixel.g;
            data[offset + 2] = pixel.b;
            data[offset + 3] = pixel.a;
        }
    }
    return { data, width, height };
}

const MAX_SAMPLES = 20_000;
const MIN_ALPHA = 128;
const BUCKET_SHIFT = 4; // 16 levels per channel → 4096 buckets.

interface Bucket {
    count: number;
    sumR: number;
    sumG: number;
    sumB: number;
}

function toHex(r: number, g: number, b: number): string {
    const channel = (value: number): string => Math.round(value).toString(16).padStart(2, '0');
    return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Deterministic dominant-color analysis of one region box. Transparent pixels
 * are excluded; oversized regions are stride-sampled on a fixed grid so the
 * result stays reproducible and bounded.
 */
export function analyzeRegionColors(buffer: PixelBuffer, region: ExtractionRegion): RegionColorResult {
    const empty: RegionColorResult = { hex: null, confidence: 0, sampledPixels: 0, dominantHexes: [] };

    const x0 = Math.max(0, Math.floor(region.x * buffer.width));
    const y0 = Math.max(0, Math.floor(region.y * buffer.height));
    const x1 = Math.min(buffer.width, Math.ceil((region.x + region.w) * buffer.width));
    const y1 = Math.min(buffer.height, Math.ceil((region.y + region.h) * buffer.height));
    if (x1 <= x0 || y1 <= y0) return empty;

    const boxWidth = x1 - x0;
    const boxHeight = y1 - y0;
    const total = boxWidth * boxHeight;
    const stride = total <= MAX_SAMPLES ? 1 : Math.ceil(Math.sqrt(total / MAX_SAMPLES));

    const buckets = new Map<number, Bucket>();
    let sampled = 0;
    for (let y = y0; y < y1; y += stride) {
        for (let x = x0; x < x1; x += stride) {
            const offset = (y * buffer.width + x) * 4;
            if (buffer.data[offset + 3] < MIN_ALPHA) continue;
            const r = buffer.data[offset];
            const g = buffer.data[offset + 1];
            const b = buffer.data[offset + 2];
            const key = ((r >> BUCKET_SHIFT) << 8) | ((g >> BUCKET_SHIFT) << 4) | (b >> BUCKET_SHIFT);
            const bucket = buckets.get(key);
            if (bucket) {
                bucket.count += 1;
                bucket.sumR += r;
                bucket.sumG += g;
                bucket.sumB += b;
            } else {
                buckets.set(key, { count: 1, sumR: r, sumG: g, sumB: b });
            }
            sampled += 1;
        }
    }

    if (sampled === 0) return empty;

    const ranked = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 3);
    const dominantHexes = ranked.map((bucket) => toHex(bucket.sumR / bucket.count, bucket.sumG / bucket.count, bucket.sumB / bucket.count));

    return {
        hex: dominantHexes[0] ?? null,
        confidence: ranked[0]?.count ? ranked[0].count / sampled : 0,
        sampledPixels: sampled,
        dominantHexes,
    };
}

/**
 * Browser-only loader: decode a data URL (or same-origin image URL) into an
 * RGBA buffer via canvas. Throws outside a DOM environment — callers in the
 * vision pipeline run client-side only.
 */
export async function loadPixelBufferFromDataUrl(source: string): Promise<PixelBuffer> {
    if (typeof document === 'undefined') throw new Error('Image decoding requires a browser environment.');

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('The source image could not be decoded for color analysis.'));
        element.src = source;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas 2D is unavailable for color analysis.');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    return { data: new Uint8ClampedArray(data.buffer.slice(0)), width: canvas.width, height: canvas.height };
}
