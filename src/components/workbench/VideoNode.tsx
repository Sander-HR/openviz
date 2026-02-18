import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { Plus, Play, Pause, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    const [isFullscreen, setIsFullscreen] = useState(false);

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
            <div
                className={`relative bg-black rounded-lg shadow-lg transition-all duration-200 border-2 overflow-hidden ${selected ? 'border-[#6366f1]' : 'border-transparent hover:border-[#6366f1]'}`}
                style={{ width: '100%', height: '100%' }}
            >
                {data.status === 'rendering' ? (
                    <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center animate-pulse">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-gray-400 text-xs font-medium">Rendering Video...</span>
                    </div>
                ) : data.project.thumbnail ? (
                    <div className="relative w-full h-full group">
                        <video
                            ref={videoRef}
                            src={data.project.thumbnail}
                            className="w-full h-full object-cover"
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

                        {/* Fullscreen Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsFullscreen(true);
                            }}
                            className="absolute bottom-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-black z-10"
                            title="Fullscreen Preview"
                        >
                            <Maximize2 size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No video</span>
                    </div>
                )}
            </div>
            <NodeResizer
                nodeId={id}
                isVisible={selected && data.status !== 'rendering'}
                minWidth={100}
                minHeight={100}
                keepAspectRatio={true}
                color="#6366f1"
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

            {/* Fullscreen Modal Overlay */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {isFullscreen && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-[5vh] md:p-[10vh] bg-black/80 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative bg-[#0A0A0A] rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center border border-white/10 w-full h-full max-w-[90vw] max-h-[85vh]"
                                style={{
                                    aspectRatio: `${data.width} / ${data.height}`,
                                }}
                            >
                                <video
                                    src={data.project.thumbnail}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                    loop
                                    controls
                                    playsInline
                                />
                                
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsFullscreen(false);
                                    }}
                                    className="absolute top-8 right-8 p-3 bg-black/60 hover:bg-white hover:text-black text-white rounded-2xl transition-all z-50 shadow-lg border border-white/10 backdrop-blur-xl"
                                >
                                    <X size={24} />
                                </button>

                                <div className="absolute top-8 left-10 pointer-events-none">
                                    <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                                        <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">
                                            Studio Preview • {Math.round(data.width ?? 512)}×{Math.round(data.height ?? 512)}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                            
                            {/* Backdrop Click */}
                            <div 
                                className="absolute inset-0 -z-10 cursor-pointer" 
                                onClick={() => setIsFullscreen(false)}
                            />
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};
