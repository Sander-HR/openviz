import type { ImageNode, Project } from '@/types';
import { generateUUID } from '@/utils/uuid';

/**
 * Pure media-upload logic (research R4): file validation, node building, and
 * viewport-center placement. No DOM/URL APIs here so the rules are unit-
 * testable; the view layer supplies the object URL and screen mapping.
 */

export interface MediaFileLike {
    type?: string;
}

/** FR-012: only image/* mime types are accepted. */
export function isImageFile(file: MediaFileLike): boolean {
    return typeof file.type === 'string' && file.type.startsWith('image/');
}

export interface BuildImageNodeInput {
    src: string;
    /**
     * ≤512px thumbnail variant. Stored on `project.thumbnail` so the workbench
     * canvas and dashboard cards render it instead of downloading full
     * resolution. Falls back to `src` when absent.
     */
    thumbnail?: string | null;
    /** ≤1024px preview variant (3-tier pipeline); stored on `project.previewUrl`. */
    preview?: string | null;
    fileName: string;
    mimeType: string;
    centerPoint: { x: number; y: number };
}

const MEDIA_NODE_WIDTH = 260;
const DEFAULT_CENTER_POINT = { x: 200, y: 200 };

/** Builds a media node centered on the given flow point (data-model Media entity). */
export function buildImageNode({ src, thumbnail, preview, fileName, centerPoint }: BuildImageNodeInput): ImageNode {
    const id = generateUUID();
    const name = fileName || 'Uploaded image';
    // Canvas/dashboard display prefers the small variant; full res stays on the layer.
    const displayUrl = thumbnail ?? src;
    const canvas = { width: 1024, height: 768 };
    const project: Project = {
        id,
        name,
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
        canvas: {
            width: canvas.width,
            height: canvas.height,
            aspectRatio: 'landscape',
            zoomLevel: 1,
            panX: 0,
            panY: 0,
            backgroundColor: '#ffffff',
        },
        layers: [{
            id: `${id}-image`,
            name,
            type: 'image',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            image: src,
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height,
            order: 1,
            created: Date.now(),
            modified: Date.now(),
        }],
        thumbnail: displayUrl,
        ...(preview ? { previewUrl: preview } : {}),
    };
    const scale = MEDIA_NODE_WIDTH / canvas.width;
    const nodeWidth = canvas.width * scale;
    const nodeHeight = canvas.height * scale;

    return {
        id,
        type: 'image',
        name,
        x: centerPoint.x - nodeWidth / 2,
        y: centerPoint.y - nodeHeight / 2,
        width: nodeWidth,
        height: nodeHeight,
        scale,
        project,
    };
}

/**
 * Maps the wrapper element's rect center into flow coordinates; falls back to
 * a default canvas point when no rect is available (e.g. before first layout).
 */
export function resolveCenterFlowPoint(
    rect: DOMRect | null | undefined,
    screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number }
): { x: number; y: number } {
    if (!rect) {
        return DEFAULT_CENTER_POINT;
    }
    return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    });
}
