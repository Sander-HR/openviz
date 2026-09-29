import { WorkbenchNode } from '@/types';

export function getWorkbenchNodeSize(node: WorkbenchNode) {
    const fallbackWidth = Number.isFinite(node.width) && (node.width as number) > 0 ? (node.width as number) : 256;
    const fallbackHeight = Number.isFinite(node.height) && (node.height as number) > 0 ? (node.height as number) : 256;

    let width = fallbackWidth;
    let height = fallbackHeight;

    if (
        (node.type === 'image' || node.type === 'video') &&
        typeof node.scale === 'number' &&
        Number.isFinite(node.scale) &&
        node.scale > 0 &&
        Number.isFinite(node.project?.canvas?.width) &&
        Number.isFinite(node.project?.canvas?.height) &&
        (node.project?.canvas?.width ?? 0) > 0 &&
        (node.project?.canvas?.height ?? 0) > 0
    ) {
        width = node.project.canvas.width * node.scale;
        height = node.project.canvas.height * node.scale;
    }

    return {
        width: Number.isFinite(width) && width > 0 ? width : 256,
        height: Number.isFinite(height) && height > 0 ? height : 256,
    };
}
