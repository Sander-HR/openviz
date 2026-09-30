import React, { useState, useEffect } from 'react';
import { Handle, NodeResizer, Position, useConnection } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { ImageNode as ImageNodeType } from '../../types';
import { cn, imageLikeHandleStyle, mediaNodeFrameClass, mediaNodeTitleClass, resizeHandleClassName } from './nodeUi';
import { getGenerationRetry } from '@/services/workbench/generationRetryRegistry';

interface ImageNodeData extends ImageNodeType {
    onSourceClick?: (nodeId: string) => void;
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    isTransitioningToStudio?: boolean;
}

interface ImageNodeProps {
    id: string;
    data: ImageNodeData;
    selected: boolean;
    isConnectable: boolean;
    width?: number;
    height?: number;
}

export const ImageNode = React.memo(({ id, data, selected, isConnectable = true, width, height }: ImageNodeProps) => {
    const isTransitioningToStudio = data.isTransitioningToStudio === true;
    const showSelectionChrome = selected && !isTransitioningToStudio;
    const connection = useConnection();
    const [isHovered, setIsHovered] = useState(false);
    const [nodeSize, setNodeSize] = useState({ width: width || 256, height: height || 256 });
    
    const handleSourceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        data.onSourceClick?.(data.id);
    };

    useEffect(() => {
        if (width && height && width > 0 && height > 0) {
            setNodeSize({ width, height });
        }
    }, [width, height]);

    const isHoverConnectable = connection.inProgress && isHovered &&
        (connection.fromNode?.type === 'animateNode' || connection.fromNode?.type === 'renderNode');

    return (
        <div
            className="relative"
            style={{ width: nodeSize.width, height: nodeSize.height }}
        >
            {showSelectionChrome && (
                <div className={mediaNodeTitleClass()}>
                    {data.name}
                </div>
            )}
            <div
                data-workbench-drawable={id}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={cn(mediaNodeFrameClass(showSelectionChrome), isHoverConnectable && 'border-viz-accent')}
            >
                {data.status === 'rendering' ? (
                    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center animate-pulse">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-gray-400 text-xs font-medium">Rendering...</span>
                    </div>
                ) : data.status === 'error' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-red-50 p-4 text-center">
                        <div role="alert" className="space-y-1">
                            <p className="text-xs font-semibold text-red-700">Generation failed</p>
                            <p className="line-clamp-3 text-[10px] text-red-600">
                                {data.errorMessage ?? 'The image could not be generated.'}
                            </p>
                        </div>
                        {getGenerationRetry(data.id) && (
                            <button
                                type="button"
                                className="nodrag rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    getGenerationRetry(data.id)?.();
                                }}
                            >
                                Retry
                            </button>
                        )}
                    </div>
                ) : data.project.thumbnail ? (
                    <img
                        src={data.project.thumbnail}
                        alt={data.name}
                        className="block h-full w-full object-cover"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No preview</span>
                    </div>
                )}
            </div>
            <Handle
                type="source"
                position={Position.Right}
                id="image-source"
                style={{
                    ...imageLikeHandleStyle,
                    right: '0px',
                    top: '50%',
                    zIndex: 1000,
                    opacity: showSelectionChrome || isHoverConnectable ? 1 : 0,
                    pointerEvents: showSelectionChrome || isHoverConnectable ? 'auto' : 'none',
                }}
                isConnectable={isConnectable}
                onClick={handleSourceClick}
            >
                <Plus size={16} color="white" strokeWidth={3} className="pointer-events-none" />
            </Handle>
            <NodeResizer
                isVisible={showSelectionChrome && data.status !== 'rendering'}
                minWidth={100}
                minHeight={100}
                keepAspectRatio={true}
                color="#4C4CEF"
                handleClassName={resizeHandleClassName}
                handleStyle={{
                    width: 12,
                    height: 12,
                    borderWidth: '2px',
                    borderRadius: 3,
                }}
                onResize={(_event, resizeParams) => {
                    const newWidth = (resizeParams.width && Number.isFinite(resizeParams.width)) ? resizeParams.width : nodeSize.width;
                    const newHeight = (resizeParams.height && Number.isFinite(resizeParams.height)) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;
                    if (Number.isFinite(newWidth) && Number.isFinite(newHeight) && newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResize?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
                onResizeEnd={(_event, resizeParams) => {
                    const newWidth = (resizeParams.width && Number.isFinite(resizeParams.width)) ? resizeParams.width : nodeSize.width;
                    const newHeight = (resizeParams.height && Number.isFinite(resizeParams.height)) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;
                    if (Number.isFinite(newWidth) && Number.isFinite(newHeight) && newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResizeEnd?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
            />
        </div>
    );
});

ImageNode.displayName = 'ImageNode';
