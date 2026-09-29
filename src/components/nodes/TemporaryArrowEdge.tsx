import React from 'react';
import { type EdgeProps, type Edge } from '@xyflow/react';
import { buildArrowPath, buildArrowheadPath } from '@/services/workbench/arrowGeometry';

type TemporaryArrowEdgeData = {
    control: { x: number; y: number };
    strokeColor: string;
    strokeWidth: number;
};

type TemporaryArrowEdgeProps = EdgeProps<Edge<TemporaryArrowEdgeData>>;

export const TemporaryArrowEdge: React.FC<TemporaryArrowEdgeProps> = ({
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
}) => {
    const start = { x: sourceX, y: sourceY };
    const end = { x: targetX, y: targetY };
    const control = data?.control ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
    const direction = { x: end.x - control.x, y: end.y - control.y };

    const stroke = data?.strokeColor ?? '#111827';
    const strokeWidth = data?.strokeWidth ?? 2;
    return (
        <g className="temporary-arrow-edge" pointerEvents="stroke">
            <path
                d={buildArrowPath(start, control, end)}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
            />
            <path
                d={buildArrowheadPath(end, direction)}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </g>
    );
};
