import React, { useState } from 'react';
import {
    Maximize2,
    ZoomIn,
    ZoomOut,
    Maximize,
    HelpCircle,
    X
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface CanvasControlsProps {
    zoomLevel?: number;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onResetZoom?: () => void;
    onFitToScreen?: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
    zoomLevel: propZoomLevel,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onFitToScreen
}) => {
    const { project, setZoom, setPan } = useStore();
    const [showShortcuts, setShowShortcuts] = useState(false);
    
    const currentZoom = propZoomLevel ?? project.canvas.zoomLevel;
    const zoomPercent = Math.round(currentZoom * 100);

    const animateZoom = (targetZoom: number) => {
        const startZoom = project.canvas.zoomLevel;
        const center = {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        };
        const mousePointTo = {
            x: (center.x - project.canvas.panX) / startZoom,
            y: (center.y - project.canvas.panY) / startZoom,
        };

        animate(startZoom, targetZoom, {
            duration: 0.3,
            ease: "easeOut",
            onUpdate: (currentScale) => {
                const newPos = {
                    x: center.x - mousePointTo.x * currentScale,
                    y: center.y - mousePointTo.y * currentScale,
                };
                setZoom(currentScale);
                setPan(newPos.x, newPos.y);
            }
        });
    };

    const handleZoomIn = () => {
        if (onZoomIn) {
            onZoomIn();
            return;
        }
        animateZoom(Math.min(5, project.canvas.zoomLevel + 0.1));
    };
    const handleZoomOut = () => {
        if (onZoomOut) {
            onZoomOut();
            return;
        }
        animateZoom(Math.max(0.1, project.canvas.zoomLevel - 0.1));
    };
    const handleResetZoom = () => {
        if (onResetZoom) {
            onResetZoom();
            return;
        }
        animateZoom(1);
    };
    const handleFitToScreen = () => {
        if (onFitToScreen) {
            onFitToScreen();
            return;
        }
        if ((window as any).fitToScreen) {
            (window as any).fitToScreen();
        }
    };
    const handleFullscreen = () => {
        console.log("Fullscreen clicked");
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const shortcuts = [
        { key: 'S', label: 'Select Tool' },
        { key: 'B', label: 'Brush Tool' },
        { key: 'E', label: 'Eraser Tool' },
        { key: 'R', label: 'Rectangle Tool' },
        { key: 'O', label: 'Circle Tool' },
        { key: 'L', label: 'Line Tool' },
        { key: 'G', label: 'Paint Bucket' },
        { key: 'Ctrl + Z', label: 'Undo' },
        { key: 'Ctrl + Y', label: 'Redo' },
        { key: 'Wheel', label: 'Zoom' },
        { key: 'Click + Wheel', label: 'Pan' },
    ];

    return (
        <div className="relative pointer-events-auto nowheel">
            <div className="flex items-center gap-0.5 bg-panel border border-panel-border p-1 rounded-full shadow-2xl backdrop-blur-md bg-opacity-90 text-text-secondary">
                <button onClick={handleFullscreen} className="p-1.5 hover:text-white transition-colors" title="Toggle Fullscreen">
                    <Maximize2 size={14} />
                </button>
                <button onClick={handleFitToScreen} className="p-1.5 hover:text-white transition-colors" title="Fit to Canvas">
                    <Maximize size={14} />
                </button>

                <div className="w-px h-3 bg-panel-border mx-0.5" />

                <button onClick={handleZoomOut} className="p-1.5 hover:text-white transition-colors" title="Zoom Out">
                    <ZoomOut size={14} />
                </button>

                <button
                    onClick={handleResetZoom}
                    className="px-1.5 font-mono text-[10px] font-bold hover:text-white transition-colors min-w-[40px] text-center"
                    title="Reset Zoom"
                >
                    {zoomPercent}%
                </button>

                <button onClick={handleZoomIn} className="p-1.5 hover:text-white transition-colors" title="Zoom In">
                    <ZoomIn size={14} />
                </button>

                <div className="w-px h-3 bg-panel-border mx-0.5" />

                <button 
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className={cn("p-1.5 hover:text-white transition-colors", showShortcuts && "text-white bg-white/10 rounded-full")} 
                    title="Shortcuts Help"
                >
                    <HelpCircle size={14} />
                </button>
            </div>

            <AnimatePresence>
                {showShortcuts && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-4 w-64 bg-neutral-900 border border-panel-border rounded-2xl shadow-2xl overflow-hidden z-[100] pointer-events-auto nowheel"
                    >
                        <div className="p-3 border-b border-panel-border flex items-center justify-between bg-white/5">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Shortcuts</h3>
                            <button onClick={() => setShowShortcuts(false)} className="text-white/40 hover:text-white transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-3 space-y-1.5">
                            {shortcuts.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px]">
                                    <span className="text-white/60">{s.label}</span>
                                    <span className="px-1.5 py-0.5 bg-neutral-800 border border-panel-border rounded text-[9px] font-mono text-primary font-bold">
                                        {s.key}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
