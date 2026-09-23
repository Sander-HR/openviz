import { ConnectionLineComponentProps, getSmoothStepPath } from '@xyflow/react';

export function WorkbenchConnectionLine({
    fromX,
    fromY,
    fromPosition,
    toX,
    toY,
    toPosition,
}: ConnectionLineComponentProps) {
    if (![fromX, fromY, toX, toY].every((value) => Number.isFinite(value))) {
        return null;
    }

    const [path] = getSmoothStepPath({
        sourceX: fromX,
        sourceY: fromY,
        sourcePosition: fromPosition,
        targetX: toX,
        targetY: toY,
        targetPosition: toPosition,
        borderRadius: 15,
    });

    if (!path || path.includes('NaN')) {
        return null;
    }

    return <path d={path} fill="none" stroke="#475569" strokeWidth={2} />;
}
