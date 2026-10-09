import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPutAsset = vi.fn(async () => undefined);
const mockGetAssetBuffer = vi.fn();
vi.mock('@/lib/services/s3', () => ({
    putAsset: (...args: unknown[]) => mockPutAsset(...(args as [])),
    getAssetBuffer: (key: string) => mockGetAssetBuffer(key),
    isS3Configured: () => true,
    IMMUTABLE_CACHE_CONTROL: 'public, max-age=31536000, immutable',
    thumbnailKeyFor: (key: string) => {
        const dot = key.lastIndexOf('.');
        return dot === -1 ? null : `thumbnails/${key.slice(key.indexOf('/') + 1, dot)}.webp`;
    },
    previewKeyFor: (key: string) => {
        const dot = key.lastIndexOf('.');
        return dot === -1 ? null : `previews/${key.slice(key.indexOf('/') + 1, dot)}.webp`;
    },
}));

const mockGenerateVariant = vi.fn();
vi.mock('@/lib/services/thumbnail', () => ({
    generateVariant: (input: Buffer, contentType: string, maxDim: number) => mockGenerateVariant(input, contentType, maxDim),
    THUMBNAIL_MAX_DIM: 512,
    PREVIEW_MAX_DIM: 1024,
}));

vi.mock('@/lib/auth', () => ({
    auth: async () => ({ user: { id: 'user-1' } }),
}));

describe('POST /api/assets/thumbnail (variant pipeline: thumb/preview)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetBuffer.mockResolvedValue(Buffer.from('fake-image-bytes'));
        mockGenerateVariant.mockResolvedValue({ buffer: Buffer.from('webp'), contentType: 'image/webp' });
    });

    const post = (body: Record<string, unknown>) =>
        import('./route').then(({ POST }) =>
            POST(new Request('http://localhost/api/assets/thumbnail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }))
        );

    it('defaults to the thumb variant (512) and stores under the thumbnails prefix', async () => {
        const res = await post({ key: 'uploads/user-1/123-pic.png' });
        const json = (await res.json()) as { url: string | null };

        expect(res.status).toBe(200);
        expect(json.url).toMatch(/^\/api\/assets\//);
        expect(mockGenerateVariant).toHaveBeenCalledWith(Buffer.from('fake-image-bytes'), 'image/png', 512);
        expect(mockPutAsset).toHaveBeenCalledWith(
            'thumbnails/user-1/123-pic.webp',
            Buffer.from('webp'),
            'image/webp',
            'public, max-age=31536000, immutable'
        );
    });

    it('generates the preview variant (1024) when requested and stores under the previews prefix', async () => {
        const res = await post({ key: 'uploads/user-1/123-pic.png', variant: 'preview' });
        const json = (await res.json()) as { url: string | null };

        expect(res.status).toBe(200);
        expect(json.url).toMatch(/^\/api\/assets\//);
        expect(mockGenerateVariant).toHaveBeenCalledWith(Buffer.from('fake-image-bytes'), 'image/png', 1024);
        expect(mockPutAsset).toHaveBeenCalledWith(
            'previews/user-1/123-pic.webp',
            Buffer.from('webp'),
            'image/webp',
            'public, max-age=31536000, immutable'
        );
    });

    it('returns null (never throws) when the source is not variant-able', async () => {
        mockGenerateVariant.mockResolvedValue(null);
        const res = await post({ key: 'uploads/user-1/123-pic.png', variant: 'preview' });
        const json = (await res.json()) as { url: string | null; reason: string };

        expect(res.status).toBe(200);
        expect(json.url).toBeNull();
        expect(json.reason).toBe('not-a-variantable-image');
        expect(mockPutAsset).not.toHaveBeenCalled();
    });

    it('returns null when generation throws (S3 hiccup, corrupt bytes)', async () => {
        mockGetAssetBuffer.mockRejectedValue(new Error('S3 down'));
        const res = await post({ key: 'uploads/user-1/123-pic.png' });
        const json = (await res.json()) as { url: string | null; reason: string };

        expect(res.status).toBe(200);
        expect(json.url).toBeNull();
        expect(json.reason).toBe('generation-failed');
    });

    it('rejects unknown variants with 400', async () => {
        const res = await post({ key: 'uploads/user-1/123-pic.png', variant: 'huge' });
        expect(res.status).toBe(400);
        expect(mockGetAssetBuffer).not.toHaveBeenCalled();
    });

    it('rejects keys outside the asset sections', async () => {
        const res = await post({ key: 'secrets/user-1/123.png' });
        const json = (await res.json()) as { url: string | null };
        expect(json.url).toBeNull();
        expect(mockGetAssetBuffer).not.toHaveBeenCalled();
    });

    it('forbids processing other users\' uploads', async () => {
        const res = await post({ key: 'uploads/user-2/123-pic.png' });
        expect(res.status).toBe(403);
        expect(mockGetAssetBuffer).not.toHaveBeenCalled();
    });

    it('rejects malformed JSON bodies with 400', async () => {
        const { POST } = await import('./route');
        const res = await POST(new Request('http://localhost/api/assets/thumbnail', { method: 'POST', body: '{nope' }));
        expect(res.status).toBe(400);
    });
});
