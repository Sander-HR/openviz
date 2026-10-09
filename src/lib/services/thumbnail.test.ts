import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
    generateThumbnail,
    generateVariant,
    THUMBNAIL_MAX_DIM,
    PREVIEW_MAX_DIM,
} from './thumbnail';

async function makePng(width: number, height: number): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } } }).png().toBuffer();
}



describe('generateThumbnail (Sprint 3 server-side WebP pipeline)', () => {
    it('downscales a large PNG to WebP within the size budget', async () => {
        const input = await makePng(1600, 900);
        const result = await generateThumbnail(input, 'image/png');

        expect(result).not.toBeNull();
        const meta = await sharp(result!.buffer).metadata();
        expect(meta.format).toBe('webp');
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(THUMBNAIL_MAX_DIM);
        // Proportional downscale: 1600x900 -> 512x288 (fit inside, no enlargement)
        expect(meta.width).toBe(512);
        expect(meta.height).toBe(288);
        // The thumbnail must be smaller than the source.
        expect(result!.buffer.byteLength).toBeLessThan(input.byteLength);
    });

    it('returns null for images already at or below the budget (no point re-encoding)', async () => {
        const small = await makePng(300, 200);
        expect(await generateThumbnail(small, 'image/png')).toBeNull();
    });

    it('returns null for non-image content types', async () => {
        expect(await generateThumbnail(Buffer.from('not an image'), 'video/mp4')).toBeNull();
        expect(await generateThumbnail(Buffer.from('no ext type'), 'application/octet-stream')).toBeNull();
    });

    it('returns null (never throws) for undecodable bytes', async () => {
        await expect(generateThumbnail(Buffer.from('definitely not png bytes'), 'image/png')).resolves.toBeNull();
    });
});

describe('generateVariant (3-tier pipeline: thumb/preview/full)', () => {
    it('generates a ≤1024px WebP preview for large images', async () => {
        const input = await makePng(2400, 1600);
        const result = await generateVariant(input, 'image/png', PREVIEW_MAX_DIM);

        expect(result).not.toBeNull();
        const meta = await sharp(result!.buffer).metadata();
        expect(meta.format).toBe('webp');
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(PREVIEW_MAX_DIM);
        // Proportional: 2400x1600 -> 1024x683 (fit inside, no enlargement)
        expect(meta.width).toBe(1024);
        expect(meta.height).toBe(683);
    });

    it('returns null for images already at or below the preview budget (original IS the preview)', async () => {
        const mid = await makePng(800, 600);
        expect(await generateVariant(mid, 'image/png', PREVIEW_MAX_DIM)).toBeNull();
    });

    it('matches legacy thumbnail behavior at the 512 budget', async () => {
        const input = await makePng(1600, 900);
        const [viaVariant, viaLegacy] = await Promise.all([
            generateVariant(input, 'image/png', THUMBNAIL_MAX_DIM),
            generateThumbnail(input, 'image/png'),
        ]);
        expect(viaVariant).not.toBeNull();
        expect(viaLegacy).not.toBeNull();
        const a = await sharp(viaVariant!.buffer).metadata();
        const b = await sharp(viaLegacy!.buffer).metadata();
        expect(a.width).toBe(b.width);
        expect(a.height).toBe(b.height);
    });

    it('returns null for non-image content types at any budget', async () => {
        expect(await generateVariant(Buffer.from('not an image'), 'application/pdf', PREVIEW_MAX_DIM)).toBeNull();
    });
});
