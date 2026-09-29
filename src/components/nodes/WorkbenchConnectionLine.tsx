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

    return (
        <>
            <defs>
                <marker
                    id="workbench-connection-arrow"
                    viewBox="0 0 10 10"
                    refX={8}
                    refY={5}
                    markerWidth={7}
                    markerHeight={7}
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#4C4CEF" />
                </marker>
            </defs>
            <path
                d={path}
                fill="none"
                stroke="#4C4CEF"
                strokeWidth={2}
                markerEnd="url(#workbench-connection-arrow)"
            />
        </>
    );
}
