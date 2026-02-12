import React, { useRef, useState } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { Plus, Play, Pause } from 'lucide-react';
import { VideoNode as VideoNodeType } from '../../types';

interface VideoNodeData extends VideoNodeType {
    onSourceClick?: (nodeId: string) => void;
    onResize?: (nodeId: string, width: number, height: number) => void;
}

interface VideoNodeProps {
    id: string;
    data: VideoNodeData;
    selected: boolean;
    isConnectable: boolean;
}

export const VideoNode: React.FC<VideoNodeProps> = ({ id, data, selected, isConnectable = true }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const handleSourceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        data.onSourceClick?.(data.id);
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleVideoEnded = () => {
        setIsPlaying(false);
        // Optional: Loop is handled by the video attribute, but if we want manual control or non-looping:
        // setIsPlaying(false);
    };

    return (
        <>
            <Handle
                type="source"
                position={Position.Right}
                id="video-source"
                style={{
                    right: '0px',
                    top: '50%',
                    background: '#6366f1',
                    width: '26px',
                    height: '26px',
                    border: '3px solid white',
                    cursor: 'hand',
                    zIndex: 1000,
                    opacity: selected ? 1 : 0,
                    transformOrigin: 'center',
                    transition: 'opacity 300ms ease',
                    pointerEvents: selected ? 'auto' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                isConnectable={isConnectable}
                onClick={handleSourceClick}
            >
                <Plus size={16} color="white" strokeWidth={3} />
            </Handle>
            <div
                className={`relative bg-black rounded-lg shadow-lg transition-all duration-200 border-2 ${selected ? 'border-[#6366f1]' : 'border-transparent hover:border-[#6366f1]'}`}
                style={{ width: '100%', height: '100%' }}
            >
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
                        borderColor: '#6366f1',
                        borderRadius: 3,
                        transform: `scale(1)`,
                        transformOrigin: 'center'
                    }}
                    onResize={(_, { width, height }) => {
                        data.onResize?.(data.id, width, height);
                    }}
                />
                {data.status === 'rendering' ? (
                    <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center rounded-lg animate-pulse">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-gray-400 text-xs font-medium">Rendering Video...</span>
                    </div>
                ) : data.project.thumbnail ? (
                    <div className="relative w-full h-full group">
                        <video
                            ref={videoRef}
                            src={data.project.thumbnail}
                            className="w-full h-full object-cover rounded-lg"
                            loop
                            muted
                            playsInline
                            onEnded={handleVideoEnded}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                        />
                        <div 
                            className="absolute inset-0 flex items-center justify-center cursor-pointer transition-opacity duration-200"
                            onClick={togglePlay}
                            style={{
                                backgroundColor: isPlaying ? 'transparent' : 'rgba(0,0,0,0.3)'
                            }}
                        >
                             <div className={`
                                w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center 
                                hover:bg-white/30 transition-all transform hover:scale-110
                                ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}
                             `}>
                                {isPlaying ? (
                                    <Pause size={24} className="text-white fill-white" />
                                ) : (
                                    <Play size={24} className="text-white fill-white ml-1" />
                                )}
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center rounded-lg">
                        <span className="text-gray-400 text-sm">No video</span>
                    </div>
                )}
            </div>
        </>
    );
};
