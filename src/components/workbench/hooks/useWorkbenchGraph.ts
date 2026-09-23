import { useMemo } from "react";
import { Edge, Node } from "@xyflow/react";
import { Connection, NodeLockState, WorkbenchNode } from "@/types";

type WorkbenchGraphOptions = {
    workbenchNodes: WorkbenchNode[];
    connections: Connection[];
    selectedNodeIds: string[];
    /** Remote soft locks (nodeId → holder). Locked nodes are inert for this session. */
    nodeLocks: Record<string, NodeLockState>;
    handleSourceClick: (nodeId: string) => void;
    handleResize: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    handleResizeEnd: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    handleTransientDataChange: (nodeId: string, data: Record<string, unknown>) => void;
    handleGestureStart: (nodeId: string, kind: 'move' | 'resize' | 'arrow-handle') => void;
    handleGestureEnd: (cancelled?: boolean) => void;
    handleDataChange: (nodeId: string, data: Record<string, unknown>) => void;
};

type WorkbenchFlowNodeType =
    | "imageNode"
    | "videoNode"
    | "animateNode"
    | "renderNode"
    | "freehandNode"
    | "arrowNode"
    | "textNode"
    | "noteNode"
    | "mediaNode";

function mapNodeType(node: WorkbenchNode): WorkbenchFlowNodeType {
    if (node.type === "image") return "imageNode";
    if (node.type === "video") return "videoNode";
    if (node.type === "animate") return "animateNode";
    if (node.type === "freehand") return "freehandNode";
    if (node.type === "arrow") return "arrowNode";
    if (node.type === "text") return "textNode";
    if (node.type === "note") return "noteNode";
    if (node.type === "media") return "mediaNode";
    return "renderNode";
}

function getNodeSize(node: WorkbenchNode) {
    const fallbackWidth = Number.isFinite(node.width) && (node.width as number) > 0 ? (node.width as number) : 256;
    const fallbackHeight = Number.isFinite(node.height) && (node.height as number) > 0 ? (node.height as number) : 256;

    let width = fallbackWidth;
    let height = fallbackHeight;

    if (
        (node.type === "image" || node.type === "video") &&
        typeof node.scale === "number" &&
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

export function useWorkbenchGraph({
    workbenchNodes,
    connections,
    selectedNodeIds,
    nodeLocks,
    handleSourceClick,
    handleResize,
    handleResizeEnd,
    handleTransientDataChange,
    handleGestureStart,
    handleGestureEnd,
    handleDataChange,
}: WorkbenchGraphOptions) {
    const nodes = useMemo<Array<Node<Record<string, unknown>, WorkbenchFlowNodeType>>>(() => {
        return workbenchNodes.map((node) => {
            const { width, height } = getNodeSize(node);

            return {
                id: node.id,
                type: mapNodeType(node),
                position: { x: node.x, y: node.y },
                width,
                height,
                style: { width, height },
                data: {
                    ...node,
                    width,
                    height,
                    onSourceClick: handleSourceClick,
                    onResize: handleResize,
                    onResizeEnd: handleResizeEnd,
                    onTransientDataChange: handleTransientDataChange,
                    onGestureStart: handleGestureStart,
                    onGestureEnd: handleGestureEnd,
                    onDataChange: handleDataChange,
                } as Record<string, unknown>,
                selected: selectedNodeIds.includes(node.id),
                // Remote soft locks (spec FR-015): a node another collaborator
                // holds cannot be selected or dragged from this session.
                selectable: !nodeLocks[node.id],
                draggable: !nodeLocks[node.id],
            };
        });
    }, [workbenchNodes, selectedNodeIds, nodeLocks, handleSourceClick, handleResize, handleResizeEnd, handleTransientDataChange, handleGestureStart, handleGestureEnd, handleDataChange]);

    const edges = useMemo<Array<Edge>>(() => {
        const nodeById = new Map(workbenchNodes.map((node) => [node.id, node]));
        return connections.flatMap((conn) => {
            const sourceNode = nodeById.get(conn.from);
            const targetNode = nodeById.get(conn.to);

            if (!sourceNode || !targetNode) {
                return [];
            }

            return [{
                id: conn.id,
                source: conn.from,
                target: conn.to,
                sourceHandle: conn.sourceHandle ?? (sourceNode?.type === 'image' ? 'image-source' : null),
                targetHandle: conn.targetHandle ?? null,
                type: "customEdge",
                style: { stroke: "#2F8CFF", strokeWidth: 2 },
                animated: false,
            }];
        });
    }, [connections, workbenchNodes]);

    return { nodes, edges };
}
