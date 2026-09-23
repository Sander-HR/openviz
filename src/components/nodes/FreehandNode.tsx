import React, { useEffect, useState } from 'react';
import { NodeResizer } from '@xyflow/react';

import { FreehandNode as FreehandNodeType } from '@/types';

interface FreehandNodeData extends FreehandNodeType {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface FreehandNodeProps {
    id: string;
    data: FreehandNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

export const FreehandNode: React.FC<FreehandNodeProps> = ({ id, data, selected, width, height }) => {
    const [nodeSize, setNodeSize] = useState({ width: width || 1, height: height || 1 });
    const path = data.data?.path ?? '';
    const strokeColor = data.data?.color ?? '#2563eb';
    const strokeWidth = Number.isFinite(data.data?.strokeWidth) ? Math.max(0.5, data.data.strokeWidth) : 2;
    const rawWidth = typeof data.width === 'number' ? data.width : undefined;
    const rawHeight = typeof data.height === 'number' ? data.height : undefined;
    const svgWidth = typeof rawWidth === 'number' && rawWidth > 0 ? rawWidth : 1;
    const svgHeight = typeof rawHeight === 'number' && rawHeight > 0 ? rawHeight : 1;

    useEffect(() => {
        if (width && height && width > 0 && height > 0) {
            setNodeSize({ width, height });
        }
    }, [width, height]);

    if (!path.trim()) {
        return null;
    }

    return (
        <div style={{ width: nodeSize.width, height: nodeSize.height }} className="relative select-none pointer-events-none">
            <svg
                className="w-full h-full overflow-visible"
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                role="img"
                aria-label="Freehand stroke"
            >
                <path d={path} fill={strokeColor} stroke={strokeColor} strokeWidth={strokeWidth} />
            </svg>
            <NodeResizer
                isVisible={selected}
                minWidth={10}
                minHeight={10}
                color="#ffffff"
                handleStyle={{
                    width: 12,
                    height: 12,
                    backgroundColor: '#ffffff',
                    borderColor: '#6366f1',
                    borderWidth: '2px',
                    borderRadius: 3,
                }}
                onResize={(_event, resizeParams) => {
                    const newWidth = Number.isFinite(resizeParams.width) ? resizeParams.width : nodeSize.width;
                    const newHeight = Number.isFinite(resizeParams.height) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;

                    if (newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResize?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
                onResizeEnd={(_event, resizeParams) => {
                    const newWidth = Number.isFinite(resizeParams.width) ? resizeParams.width : nodeSize.width;
                    const newHeight = Number.isFinite(resizeParams.height) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;

                    if (newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResizeEnd?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
            />
        </div>
    );
};
