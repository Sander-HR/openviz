import React, { useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { NodeResizer, useStore } from '@xyflow/react';
import { Play, Maximize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { VideoNode as VideoNodeType } from '../../types';
import { mediaNodeFrameClass, resizeHandleClassName } from './nodeUi';

interface VideoNodeData extends VideoNodeType {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onResizeEnd?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
}

interface VideoNodeProps {
    id: string;
    data: VideoNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

export const VideoNode = React.memo(({ id, data, selected, width, height }: VideoNodeProps) => {
    const internalSelected = useStore((state) => state.nodeLookup.get(id)?.selected === true);
    const isSelected = selected || internalSelected;
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [nodeSize, setNodeSize] = useState({ width: width || 256, height: height || 256 });

    // Sprint 3: the card shows the captured poster (or a placeholder) — no
    // <video> element and no video bytes in the workbench. The full video URL
    // lives on the Studio layer; `project.thumbnail` carries it for legacy
    // nodes. Only the fullscreen modal ever mounts a <video>.
    const posterUrl = data.project?.posterUrl ?? null;
    const videoUrl = data.project?.layers?.find((layer) => layer.image)?.image ?? data.project?.thumbnail ?? null;

    // useLayoutEffect: during a snap-corrected resize the prop size updates
    // every frame and must win over the raw onResize write before paint.
    useLayoutEffect(() => {
        if (width && height && width > 0 && height > 0) {
            setNodeSize({ width, height });
        }
    }, [width, height]);

    const openFullscreen = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFullscreen(true);
    };

    return (
        <div style={{ width: nodeSize.width, height: nodeSize.height }}>
            <div
                className={mediaNodeFrameClass(isSelected)}
            >
                {data.status === 'rendering' ? (
                    <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center animate-pulse">
                        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <span className="text-gray-400 text-xs font-medium">Rendering Video...</span>
                    </div>
                ) : videoUrl ? (
                    <div className="relative w-full h-full group">
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt={data.name}
                                className="w-full h-full object-cover"
                                draggable={false}
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                <Play size={28} className="text-gray-500 fill-gray-500" />
                            </div>
                        )}
                        <button
                            onClick={openFullscreen}
                            aria-label="Play video"
                            className="absolute inset-0 flex items-center justify-center cursor-pointer transition-opacity duration-200 bg-black/30 hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        >
                            <span className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all transform hover:scale-110">
                                <Play size={24} className="text-white fill-white ml-1" />
                            </span>
                        </button>

                        <button
                            onClick={openFullscreen}
                            className="absolute bottom-3 right-3 p-2 bg-black/40 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-white hover:text-black z-10"
                            title="Fullscreen Preview"
                        >
                            <Maximize2 size={16} />
                        </button>
                    </div>                ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">No video</span>
                    </div>
                )}
            </div>
            <NodeResizer
                isVisible={isSelected && data.status !== 'rendering'}
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
                    transform: `scale(1)`,
                    transformOrigin: 'center'
                }}
                onResize={(_, resizeParams) => {
                    const newWidth = (resizeParams.width && Number.isFinite(resizeParams.width)) ? resizeParams.width : nodeSize.width;
                    const newHeight = (resizeParams.height && Number.isFinite(resizeParams.height)) ? resizeParams.height : nodeSize.height;
                    const newX = Number.isFinite(resizeParams.x) ? resizeParams.x : undefined;
                    const newY = Number.isFinite(resizeParams.y) ? resizeParams.y : undefined;
                    if (Number.isFinite(newWidth) && Number.isFinite(newHeight) && newWidth > 0 && newHeight > 0) {
                        setNodeSize({ width: newWidth, height: newHeight });
                        data.onResize?.(id, newWidth, newHeight, newX, newY);
                    }
                }}
                onResizeEnd={(_, resizeParams) => {
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
                                    src={videoUrl ?? undefined}
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
                                    aria-label="Close fullscreen"
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
                            
                            <div 
                                className="absolute inset-0 -z-10 cursor-pointer" 
                                onClick={() => setIsFullscreen(false)}
                            />
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
});

VideoNode.displayName = 'VideoNode';
