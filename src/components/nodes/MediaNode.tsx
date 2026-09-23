import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { NodeResizer } from '@xyflow/react';

import { MediaWorkbenchNode } from '@/types';

interface MediaNodeData extends MediaWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface MediaNodeProps {
    id: string;
    data: MediaNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

export const MediaNode: React.FC<MediaNodeProps> = ({ id, data, selected, width, height }) => {
    const [nodeSize, setNodeSize] = useState({ width: width || 260, height: height || 180 });
    const [loadError, setLoadError] = useState(false);
    const src = data.data?.src;
    const alt = data.data?.alt ?? 'Uploaded media';

    useEffect(() => {
        if (width && height && width > 0 && height > 0) {
            setNodeSize({ width, height });
        }
    }, [width, height]);

    return (
        <div style={{ width: nodeSize.width, height: nodeSize.height }} className={`relative rounded-lg border bg-white shadow-md ${selected ? 'border-blue-400' : 'border-slate-200'}`}>
            <div className="h-full w-full overflow-hidden rounded-lg">
            {src && !loadError ? (
                <img
                    src={src}
                    alt={alt}
                    className="h-full w-full object-cover"
                    draggable={false}
                    onError={() => setLoadError(true)}
                />
            ) : (
                // C-5.4 / FR-013: clear fallback for missing or failed loads —
                // never a broken-image glyph.
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                    <ImageOff size={28} strokeWidth={1.75} />
                    <span>{src ? alt : 'Media unavailable'}</span>
                </div>
            )}
            </div>

            <NodeResizer
                isVisible={selected}
                minWidth={120}
                minHeight={80}
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
