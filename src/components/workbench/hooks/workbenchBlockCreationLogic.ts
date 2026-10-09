import { AnimateNode, ModifyNode, RenderNode, WorkbenchNode } from '@/types';

export function getWorkbenchSourceSize(sourceNode: WorkbenchNode) {
    const sourceWidth = sourceNode.width ??
        ((sourceNode.type === 'image' || sourceNode.type === 'video') &&
            sourceNode.scale &&
            sourceNode.project?.canvas?.width
            ? sourceNode.scale * sourceNode.project.canvas.width
            : 320);

    const sourceHeight = sourceNode.height ??
        ((sourceNode.type === 'image' || sourceNode.type === 'video') &&
            sourceNode.scale &&
            sourceNode.project?.canvas?.height
            ? sourceNode.scale * sourceNode.project.canvas.height
            : 320);

    return {
        sourceWidth,
        sourceHeight,
    };
}

export function createModifyNodeFromSource(sourceNode: WorkbenchNode, id: string): ModifyNode {
    const { sourceWidth } = getWorkbenchSourceSize(sourceNode);

    return {
        id,
        type: 'modify',
        x: sourceNode.x + sourceWidth + 100,
        y: sourceNode.y,
        width: 320,
        height: 560,
        data: {
            workflowId: 'product_edit',
            prompt: '',
            aspectRatio: 'square',
            preservation: 0.78,
            structureStrength: 0.72,
            references: [{ assetId: sourceNode.id, role: 'primary', token: '@1' }],
            numImages: 1,
            status: 'idle',
        },
    };
}

export function createRenderNodeFromSource(sourceNode: WorkbenchNode, id: string): RenderNode {
    const { sourceWidth } = getWorkbenchSourceSize(sourceNode);

    return {
        id,
        type: 'render',
        x: sourceNode.x + sourceWidth + 100,
        y: sourceNode.y,
        width: 320,
        height: 390,
        data: {
            prompt: '',
            stylePreset: 'Photorealistic',
            drawingInfluence: 0.65,
            numImages: 1,
        },
    };
}

export function createAnimateNodeFromSource(sourceNode: WorkbenchNode, id: string): AnimateNode {
    const { sourceWidth, sourceHeight } = getWorkbenchSourceSize(sourceNode);
    const nodeHeight = 320;

    return {
        id,
        type: 'animate',
        x: sourceNode.x + sourceWidth + 100,
        y: sourceNode.y + (sourceHeight - nodeHeight) / 2,
        width: 320,
        height: nodeHeight,
        data: {
            prompt: '',
            frames: { start: sourceNode.id },
            settings: { model: 'default', duration: '2s' },
        },
    };
}
