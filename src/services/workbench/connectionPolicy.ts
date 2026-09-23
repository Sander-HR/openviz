import { Connection, WorkbenchNode } from '@/types';

type NodeType = WorkbenchNode['type'];
const IMAGE_SOURCE_HANDLE = 'image-source';

const INBOUND_CAPS: Partial<Record<NodeType, number>> = {
    animate: 2,
    render: 1,
};

function isAllowedDirection(sourceType: NodeType, targetType: NodeType): boolean {
    return sourceType === 'image' && (targetType === 'animate' || targetType === 'render');
}

function isVideoEndpoint(sourceType: NodeType, targetType: NodeType): boolean {
    return sourceType === 'video' || targetType === 'video';
}

function makeConnectionId(): string {
    return Math.random().toString(36).slice(2, 11);
}

function resolveSourceHandle(
    sourceNode: WorkbenchNode | undefined,
    sourceHandle?: string | null,
): string | null {
    if (sourceHandle) {
        return sourceHandle;
    }
    return sourceNode?.type === 'image' ? IMAGE_SOURCE_HANDLE : null;
}

function upsertPolicyConnection(
    nextConnections: Connection[],
    candidate: Connection,
    nodeById: Map<string, WorkbenchNode>,
): Connection[] {
    if (!candidate.from || !candidate.to) {
        return nextConnections;
    }

    if (candidate.from === candidate.to) {
        return nextConnections;
    }

    const sourceNode = nodeById.get(candidate.from);
    const targetNode = nodeById.get(candidate.to);
    if (!sourceNode || !targetNode) {
        return nextConnections;
    }

    if (isVideoEndpoint(sourceNode.type, targetNode.type)) {
        return nextConnections;
    }

    if (!isAllowedDirection(sourceNode.type, targetNode.type)) {
        return nextConnections;
    }

    const duplicate = nextConnections.some(
        (connection) => connection.from === candidate.from && connection.to === candidate.to
    );
    if (duplicate) {
        return nextConnections;
    }

    const cap = INBOUND_CAPS[targetNode.type];
    if (!cap) {
        return [...nextConnections, candidate];
    }

    const inboundIndexes: number[] = [];
    for (let index = 0; index < nextConnections.length; index += 1) {
        if (nextConnections[index].to === candidate.to) {
            inboundIndexes.push(index);
        }
    }

    if (inboundIndexes.length < cap) {
        return [...nextConnections, candidate];
    }

    // Deterministic overflow rule: replace the oldest inbound connection (first in persisted order).
    const oldestInboundIndex = inboundIndexes[0];
    const withoutOldest = nextConnections.filter((_, index) => index !== oldestInboundIndex);
    return [...withoutOldest, candidate];
}

export function normalizeConnections(
    connections: Connection[],
    nodes: WorkbenchNode[],
): Connection[] {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const seenPairs = new Set<string>();
    return connections.reduce<Connection[]>((accumulator, connection) => {
        const pairKey = `${connection.from}:${connection.to}`;
        if (seenPairs.has(pairKey)) {
            return accumulator;
        }
        seenPairs.add(pairKey);

        const sourceNode = nodeById.get(connection.from);
        const normalizedConnection: Connection = {
            id: connection.id || makeConnectionId(),
            from: connection.from,
            to: connection.to,
            sourceHandle: resolveSourceHandle(sourceNode, connection.sourceHandle),
            targetHandle: connection.targetHandle ?? null,
        };
        return upsertPolicyConnection(accumulator, normalizedConnection, nodeById);
    }, []);
}

export function addConnectionWithPolicy(
    connections: Connection[],
    nodes: WorkbenchNode[],
    fromId: string,
    toId: string,
    sourceHandle?: string | null,
    targetHandle?: string | null,
): Connection[] {
    const base = normalizeConnections(connections, nodes);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const sourceNode = nodeById.get(fromId);
    const candidate: Connection = {
        id: makeConnectionId(),
        from: fromId,
        to: toId,
        sourceHandle: resolveSourceHandle(sourceNode, sourceHandle),
        targetHandle: targetHandle ?? null,
    };
    return upsertPolicyConnection(base, candidate, nodeById);
}
