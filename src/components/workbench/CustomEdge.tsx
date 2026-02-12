import {
    BaseEdge,
    EdgeLabelRenderer,
    getSmoothStepPath,
    useViewport,
    type EdgeProps,
} from '@xyflow/react';
import { Minus } from 'lucide-react';
import { useStore } from '../../store/useStore';

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
}: EdgeProps) => {
    const { zoom } = useViewport();
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        // sourceX - 26 to account for the delete button size and ensure the edge connects to the center of the button
        
        sourceX: sourceX - 25,
        sourceY,
        sourcePosition,
        targetX: targetX + 25,
        targetY,
        targetPosition,
        borderRadius: 15,
    });

    const removeConnection = useStore((state) => state.removeConnection);
    const activeNodeId = useStore((state) => state.activeNodeId);

    const onEdgeClick = () => {
        removeConnection(id);
    };

    const isDeleteButtonVisible = selected || source === activeNodeId || target === activeNodeId;

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: isDeleteButtonVisible ? '#3b82f6' : '#000' }} />
            {isDeleteButtonVisible && (
                <EdgeLabelRenderer>
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
                            style={{
                                width: '26px',
                                height: '26px',
                                backgroundColor: '#6366f1',
                                border: '3px solid white',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                            }}
                        >
                            <Minus size={12} color="white" strokeWidth={2} />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
