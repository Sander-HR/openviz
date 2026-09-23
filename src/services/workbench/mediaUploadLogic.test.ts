import { describe, expect, it } from 'vitest';

// T020: pure media-upload logic (FR-012, C-4.4). Module under test:
// src/services/workbench/mediaUploadLogic.ts (T023 implements it).

describe('isImageFile (FR-012 image-only validation)', () => {
    it('accepts common image mime types', async () => {
        const { isImageFile } = await import('./mediaUploadLogic');
        expect(isImageFile({ type: 'image/png' })).toBe(true);
        expect(isImageFile({ type: 'image/jpeg' })).toBe(true);
        expect(isImageFile({ type: 'image/webp' })).toBe(true);
    });

    it('rejects non-image and missing mime types', async () => {
        const { isImageFile } = await import('./mediaUploadLogic');
        expect(isImageFile({ type: 'video/mp4' })).toBe(false);
        expect(isImageFile({ type: 'application/pdf' })).toBe(false);
        expect(isImageFile({ type: '' })).toBe(false);
        expect(isImageFile({})).toBe(false);
    });
});

describe('buildImageNode (uploaded image node)', () => {
    it('produces an editable image node centered on the viewport point', async () => {
        const { buildImageNode } = await import('./mediaUploadLogic');
        const node = buildImageNode({
            src: 'blob:http://localhost/abc',
            fileName: 'pic.png',
            mimeType: 'image/png',
            centerPoint: { x: 500, y: 300 },
        });

        expect(node.type).toBe('image');
        expect(node.project.layers[0].image).toBe('blob:http://localhost/abc');
        expect(node.name).toBe('pic.png');
        expect(node.width).toBe(260);
        expect(node.height).toBe(195);
        expect(node.x).toBe(500 - 130);
        expect(node.y).toBe(300 - 97.5);
    });

    it('falls back to a generic alt when the file has no name', async () => {
        const { buildImageNode } = await import('./mediaUploadLogic');
        const node = buildImageNode({
            src: 'blob:http://localhost/xyz',
            fileName: '',
            mimeType: 'image/jpeg',
            centerPoint: { x: 10, y: 20 },
        });
        expect(node.name).toBe('Uploaded image');
    });
});

describe('resolveCenterFlowPoint (viewport-center placement)', () => {
    it('maps the wrapper rect center into flow coordinates', async () => {
        const { resolveCenterFlowPoint } = await import('./mediaUploadLogic');
        const screenToFlowPosition = (p: { x: number; y: number }) => ({
            x: p.x * 2,
            y: p.y * 2,
        });
        const rect = { left: 100, top: 50, width: 800, height: 600 } as DOMRect;
        // Center (500, 350) -> flow (1000, 700)
        expect(resolveCenterFlowPoint(rect, screenToFlowPosition)).toEqual({ x: 1000, y: 700 });
    });

    it('falls back to a default canvas point when no wrapper rect is available', async () => {
        const { resolveCenterFlowPoint } = await import('./mediaUploadLogic');
        expect(resolveCenterFlowPoint(null, (p) => p)).toEqual({ x: 200, y: 200 });
    });
});
