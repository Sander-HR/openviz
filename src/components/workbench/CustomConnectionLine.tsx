import React from 'react';
import { getSmoothStepPath, type ConnectionLineComponentProps } from '@xyflow/react';

export const CustomConnectionLine = ({
    fromX,
    fromY,
    toX,
    toY,
    fromPosition,
    toPosition,
}: ConnectionLineComponentProps) => {
    const [edgePath] = getSmoothStepPath({
        sourceX: fromX,
        sourceY: fromY,
        sourcePosition: fromPosition,
        targetX: toX,
        targetY: toY,
        targetPosition: toPosition,
        borderRadius: 15,
    });

    return (
        <path
            fill="none"
            stroke="#6366f1"
            strokeWidth={2}
            d={edgePath}
        />
    );
};
