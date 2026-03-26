import React from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { ImageNode as ImageNodeType } from '../../types';

interface ImageNodeData extends ImageNodeType {
    onSourceClick?: (nodeId: string) => void;
    onResize?: (nodeId: string, width: number, height: number) => void;
}

interface ImageNodeProps {
    id: string;
    data: ImageNodeData;
    selected: boolean;
    isConnectable: boolean;
}

export const ImageNode: React.FC<ImageNodeProps> = ({ id, data, selected, isConnectable = true }) => {
    const handleSourceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        data.onSourceClick?.(data.id);
    };

    return (
        <>
            {selected && (
                <div className="absolute -top-4 left-0 right-0 text-blue-500 text-xs truncate text-left px-1">
                    {data.name}
                </div>
            )}
            <div
                className={`relative bg-white rounded-lg shadow-lg transition-all duration-200 overflow-hidden border-2 ${selected ? 'border-[#6366f1]' : 'border-white hover:border-[#6366f1]'}`}
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
            <NodeResizer
                nodeId={id}
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
                    transform: `scale(1)`,
                    transformOrigin: 'center'
                }}
                onResize={(_, { width, height }) => {
                    data.onResize?.(data.id, width, height);
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="image-source"
                style={{
                    right: '0px',
                    top: '50%',  // Add this back
                    background: '#6366f1',
                    width: '26px',
                    height: '26px',
                    border: '3px solid white',
                    cursor: 'hand',
                    zIndex: 1000,
                    opacity: selected ? 1 : 0,
                    transformOrigin: 'center',  // Change to 'center'
                    //transform: `scale(${1 / zoom})`,  // Only zoom scaling here
                    transition: 'opacity 300ms ease',
                    pointerEvents: selected ? 'auto' : 'none',
                    display: 'flex',
                    //translate: '50% -50%',  // Use CSS translate for positioning
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                isConnectable={isConnectable}
                onClick={handleSourceClick}
            >
                <Plus size={16} color="white" strokeWidth={3} />
            </Handle>
        </>
    );
};
