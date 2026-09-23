import React, { useState, useEffect } from 'react';
import { Handle, NodeResizer, Position, useConnection } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { ImageNode as ImageNodeType } from '../../types';
import { imageLikeHandleStyle } from './nodeUi';

interface ImageNodeData extends ImageNodeType {
    onSourceClick?: (nodeId: string) => void;
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface ImageNodeProps {
    id: string;
    data: ImageNodeData;
    selected: boolean;
    isConnectable: boolean;
    width?: number;
    height?: number;
}

export const ImageNode: React.FC<ImageNodeProps> = ({ id, data, selected, isConnectable = true, width, height }) => {
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
        <div style={{ width: nodeSize.width, height: nodeSize.height }}>
            {selected && (
                <div className="absolute -top-4 left-0 right-0 text-blue-500 text-xs truncate text-left px-1">
                    {data.name}
                </div>
            )}
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative bg-white rounded-lg shadow-lg transition-all duration-200 border-2 overflow-hidden ${selected ? 'border-[#6366f1]' : 'border-transparent hover:border-[#6366f1]'} ${isHoverConnectable ? 'border-[#6366f1]' : ''}`}
                style={{ width: '100%', height: '100%' }}
            >
                {data.status === 'rendering' ? (
                    <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center animate-pulse">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-gray-400 text-xs font-medium">Rendering...</span>
                    </div>
                ) : data.project.thumbnail ? (
                    <img
                        src={data.project.thumbnail}
                        alt={data.name}
                        className="w-full h-full object-cover"
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
                    opacity: selected || isHovered ? 1 : 0,
                    pointerEvents: 'auto',
                    width: 24,
                    height: 24,
                }}
                isConnectable={isConnectable}
                onClick={handleSourceClick}
            >
                <Plus size={16} color="white" strokeWidth={3} className="pointer-events-none" />
            </Handle>
            <NodeResizer
                isVisible={selected && data.status !== 'rendering'}
                minWidth={100}
                minHeight={100}
                keepAspectRatio={true}
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
};
