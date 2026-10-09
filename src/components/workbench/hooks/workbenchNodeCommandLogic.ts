import type { SceneFieldUpdate } from '@/services/collab/sceneDocCommands';
import type { WorkbenchNode } from '@/types';
import { normalizeArrowGeometry } from '@/services/workbench/arrowGeometry';
import { isSceneJsonValue, sceneFieldUpdatesFromObject } from '@/services/collab/sceneDocCommands';

export type NodeFieldPatch = SceneFieldUpdate;

export function buildNodeFieldPatches(updates: object): NodeFieldPatch[] {
    return sceneFieldUpdatesFromObject(updates);
}

export function buildNodeFieldDiff(previous: WorkbenchNode, current: WorkbenchNode): NodeFieldPatch[] {
    const patches: NodeFieldPatch[] = [];
    const visit = (before: unknown, after: unknown, path: (string | number)[]): void => {
        if (JSON.stringify(before) === JSON.stringify(after)) return;
        if (after !== null && typeof after === 'object' && !Array.isArray(after)) {
            const beforeRecord = before !== null && typeof before === 'object' && !Array.isArray(before)
                ? before as Record<string, unknown>
                : {};
            const afterRecord = after as Record<string, unknown>;
            for (const [key, value] of Object.entries(afterRecord)) visit(beforeRecord[key], value, [...path, key]);
            return;
        }
        if (isSceneJsonValue(after)) patches.push({ path, value: after });
    };

    const previousRecord = previous as unknown as Record<string, unknown>;
    const currentRecord = current as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(currentRecord)) {
        if (key !== 'id') visit(previousRecord[key], value, [key]);
    }
    return patches;
}

export function getNodeResizeUpdates(
    node: WorkbenchNode,
    width: number,
    height: number,
    x?: number,
    y?: number,
): Partial<WorkbenchNode> | null {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    const xUpdate = Number.isFinite(x) ? x : undefined;
    const yUpdate = Number.isFinite(y) ? y : undefined;

    if (node.type === 'arrow') {
        const currentWidth = Number.isFinite(node.width) && (node.width as number) > 0 ? (node.width as number) : width;
        const currentHeight = Number.isFinite(node.height) && (node.height as number) > 0 ? (node.height as number) : height;
        return {
            width,
            height,
            data: normalizeArrowGeometry(node.data, currentWidth, currentHeight, width, height),
            ...(xUpdate !== undefined ? { x: xUpdate } : {}),
            ...(yUpdate !== undefined ? { y: yUpdate } : {}),
        };
    }

    if ((node.type === 'image' || node.type === 'video') && node.project?.canvas) {
        const canvasWidth = node.project.canvas.width;
        if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) {
            return { width, height, ...(xUpdate !== undefined ? { x: xUpdate } : {}), ...(yUpdate !== undefined ? { y: yUpdate } : {}) };
        }
        const scale = width / canvasWidth;
        if (!Number.isFinite(scale) || scale <= 0) return null;
        return { scale, width, height, ...(xUpdate !== undefined ? { x: xUpdate } : {}), ...(yUpdate !== undefined ? { y: yUpdate } : {}) };
    }

    return { width, height, ...(xUpdate !== undefined ? { x: xUpdate } : {}), ...(yUpdate !== undefined ? { y: yUpdate } : {}) };
}
