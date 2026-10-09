import { useState } from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    Position,
    useViewport,
    type EdgeProps,
} from '@xyflow/react';
import { Minus } from 'lucide-react';
import { useStore } from '../../store/useStore';

const CONNECTOR_RADIUS = 13;

function extendEndpointToNodeEdge(x: number, y: number, position: Position) {
    switch (position) {
        case Position.Left:
            return { x: x + CONNECTOR_RADIUS, y };
        case Position.Right:
            return { x: x - CONNECTOR_RADIUS, y };
        case Position.Top:
            return { x, y: y + CONNECTOR_RADIUS };
        case Position.Bottom:
            return { x, y: y - CONNECTOR_RADIUS };
        default:
            return { x, y };
    }
}

export const CustomEdge = ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    style = {},
    markerEnd,
    data,
}: EdgeProps) => {
    if (![sourceX, sourceY, targetX, targetY].every((value) => Number.isFinite(value))) {
        return null;
    }

    const { zoom } = useViewport();
    const edgeSource = extendEndpointToNodeEdge(sourceX, sourceY, sourcePosition);
    const edgeTarget = extendEndpointToNodeEdge(targetX, targetY, targetPosition);
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX: edgeSource.x,
        sourceY: edgeSource.y,
        sourcePosition,
        targetX: edgeTarget.x,
        targetY: edgeTarget.y,
        targetPosition,
        borderRadius: 15,
    });

    if (!edgePath || edgePath.includes('NaN') || !Number.isFinite(labelX) || !Number.isFinite(labelY)) {
        return null;
    }

    const removeConnectionFromStore = useStore((state) => state.removeConnection);
    const edgeData = data as { onDeleteConnection?: (connectionId: string) => void } | undefined;
    const removeConnection = edgeData?.onDeleteConnection ?? removeConnectionFromStore;
    const activeNodeId = useStore((state) => state.activeNodeId);

    // FR-007: hover reveals the delete control and highlights the edge.
    const [isHovered, setIsHovered] = useState(false);

    const onEdgeClick = () => {
        removeConnection(id);
    };

    const isDeleteButtonVisible =
        selected || isHovered || source === activeNodeId || target === activeNodeId;

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{ ...style, stroke: isDeleteButtonVisible ? '#4C4CEF' : '#475569' }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            />
            {isDeleteButtonVisible && (
                <EdgeLabelRenderer>
                    {/* Dynamic midpoint transform requires inline positioning; static styling is in classes. */}
                    <div
                        className="nodrag nopan"
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${1 / zoom})`,
                            pointerEvents: 'all',
                        }}
                    >
                        <button
                            onClick={onEdgeClick}
                            aria-label={`Delete connection ${id}`}
                            className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full border-2 border-viz-bg bg-viz-accent p-0 shadow-viz"
                        >
                            <Minus size={12} color="white" strokeWidth={2} />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};
