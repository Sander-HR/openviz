import type { Viewport } from '@xyflow/react';

export const WORKBENCH_DEFAULT_ZOOM = 0.5;
const WORKBENCH_MIN_ZOOM = 0.1;
const WORKBENCH_MAX_ZOOM = 2;
const STORAGE_PREFIX = 'openviz:workbench-viewport:v1:';

type PositionedNode = {
    position: { x: number; y: number };
    width?: number;
    height?: number;
};

function storageKey(projectId: string): string {
    return `${STORAGE_PREFIX}${projectId}`;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function getWorkbenchViewport(projectId: string | null): Viewport | null {
    if (!projectId || typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(storageKey(projectId));
        if (!raw) return null;
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object') return null;
        const candidate = value as Record<string, unknown>;
        if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y) || !isFiniteNumber(candidate.zoom)) {
            return null;
        }
        if (candidate.zoom < WORKBENCH_MIN_ZOOM || candidate.zoom > WORKBENCH_MAX_ZOOM) return null;
        return { x: candidate.x, y: candidate.y, zoom: candidate.zoom };
    } catch {
        return null;
    }
}

export function saveWorkbenchViewport(projectId: string | null, viewport: Viewport): void {
    if (!projectId || typeof window === 'undefined') return;
    if (!isFiniteNumber(viewport.x) || !isFiniteNumber(viewport.y) || !isFiniteNumber(viewport.zoom)) return;

    try {
        window.localStorage.setItem(storageKey(projectId), JSON.stringify(viewport));
    } catch {
        // Local persistence is best effort and must not interrupt the workbench.
    }
}

export function getCenteredWorkbenchViewport(
    nodes: PositionedNode[],
    width: number,
    height: number,
): Viewport {
    const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
    const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;

    if (nodes.length === 0) {
        return {
            x: safeWidth / 2,
            y: safeHeight / 2,
            zoom: WORKBENCH_DEFAULT_ZOOM,
        };
    }

    const bounds = nodes.reduce(
        (result, node) => {
            const nodeWidth = Number.isFinite(node.width) && (node.width ?? 0) > 0 ? node.width ?? 0 : 256;
            const nodeHeight = Number.isFinite(node.height) && (node.height ?? 0) > 0 ? node.height ?? 0 : 256;
            return {
                minX: Math.min(result.minX, node.position.x),
                minY: Math.min(result.minY, node.position.y),
                maxX: Math.max(result.maxX, node.position.x + nodeWidth),
                maxY: Math.max(result.maxY, node.position.y + nodeHeight),
            };
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    const contentCenterX = (bounds.minX + bounds.maxX) / 2;
    const contentCenterY = (bounds.minY + bounds.maxY) / 2;
    return {
        x: safeWidth / 2 - contentCenterX * WORKBENCH_DEFAULT_ZOOM,
        y: safeHeight / 2 - contentCenterY * WORKBENCH_DEFAULT_ZOOM,
        zoom: WORKBENCH_DEFAULT_ZOOM,
    };
}
