import { WorkbenchNode } from '@/types';

export type ConnectionStartRef = { nodeId: string; handleType: string } | null;

export type CanonicalConnection = {
    fromId: string;
    toId: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
};

export function getCanonicalConnectionFromDrop(
    connectionStart: ConnectionStartRef,
    targetNodeId: string | null,
    workbenchNodes: WorkbenchNode[]
): CanonicalConnection | null {
    if (!connectionStart || !targetNodeId) {
        return null;
    }

    const sourceNode = workbenchNodes.find((n) => n.id === connectionStart.nodeId);
    const targetNode = workbenchNodes.find((n) => n.id === targetNodeId);

    if (!sourceNode || !targetNode) {
        return null;
    }

    const sourceIsTransformNode = sourceNode.type === 'animate' || sourceNode.type === 'render';
    if (connectionStart.handleType === 'target' && targetNode.type === 'image' && sourceIsTransformNode) {
        return {
            fromId: targetNode.id,
            toId: sourceNode.id,
            sourceHandle: 'image-source',
            targetHandle: null,
        };
    }

    return null;
}
