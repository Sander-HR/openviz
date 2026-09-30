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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface CanvasControlsProps {
    zoomLevel?: number;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    /** Absolute zoom presets (25/50/75/100%) from the percentage popover. */
    onSetZoom?: (zoom: number) => void;
    onFitToScreen?: () => void;
}

export const CanvasControls: React.FC<CanvasControlsProps> = ({
    zoomLevel: propZoomLevel,
    onZoomIn,
    onZoomOut,
    onSetZoom,
    onFitToScreen
}) => {
    const { project, setZoom, setPan } = useStore();
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [zoomPresetsOpen, setZoomPresetsOpen] = useState(false);

    // §3.5: percentage button opens a popover with quick presets (25/50/75/100/fit).
    const applyZoomPreset = (preset: number) => {
        if (onSetZoom) {
            onSetZoom(preset);
        } else {
            animateZoom(preset);
        }
        setZoomPresetsOpen(false);
    };

    const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1];
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
            <div className="flex items-center gap-1 rounded-xl2 border border-viz-border bg-viz-panel px-1.5 py-1 shadow-viz text-viz-muted">
                <button onClick={handleFullscreen} className="rounded-lg p-1.5 hover:bg-viz-surface hover:text-white transition-colors" title="Toggle Fullscreen">
                    <Maximize2 size={14} />
                </button>
                <button onClick={handleFitToScreen} className="rounded-lg p-1.5 hover:bg-viz-surface hover:text-white transition-colors" title="Fit to Canvas">
                    <Maximize size={14} />
                </button>

                <div className="w-px h-3 bg-viz-border mx-0.5" />

                <button onClick={handleZoomOut} className="rounded-lg p-1.5 hover:bg-viz-surface hover:text-white transition-colors" title="Zoom Out">
                    <ZoomOut size={14} />
                </button>

                <Popover open={zoomPresetsOpen} onOpenChange={setZoomPresetsOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="min-w-[40px] rounded-lg px-1.5 font-mono text-[10px] font-bold text-center hover:bg-viz-surface hover:text-white transition-colors"
                            title="Zoom presets"
                            aria-label={`Zoom ${zoomPercent} percent — open presets`}
                        >
                            {zoomPercent}%
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" sideOffset={8} className="w-32 p-1">
                        {ZOOM_PRESETS.map((preset) => (
                            <button
                                key={preset}
                                onClick={() => applyZoomPreset(preset)}
                                className={cn(
                                    'flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5',
                                    Math.abs(currentZoom - preset) < 0.001 && 'text-viz-accent'
                                )}
                            >
                                {Math.round(preset * 100)}%
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                handleFitToScreen();
                                setZoomPresetsOpen(false);
                            }}
                            className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-white/5"
                        >
                            Fit to canvas
                        </button>
                    </PopoverContent>
                </Popover>

                <button onClick={handleZoomIn} className="rounded-lg p-1.5 hover:bg-viz-surface hover:text-white transition-colors" title="Zoom In">
                    <ZoomIn size={14} />
                </button>

                <div className="w-px h-3 bg-viz-border mx-0.5" />

                <button 
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className={cn("rounded-lg p-1.5 hover:bg-viz-surface hover:text-white transition-colors", showShortcuts && "text-white bg-white/10")} 
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
                        className="absolute bottom-full right-0 mb-4 w-64 bg-viz-surface border border-viz-border rounded-lg shadow-viz overflow-hidden z-[100] pointer-events-auto nowheel"
                    >
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-white">Shortcuts</h3>
                            <button onClick={() => setShowShortcuts(false)} className="text-viz-muted hover:text-white transition-colors">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-3 space-y-1.5">
                            {shortcuts.map((s, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px]">
                                    <span className="text-viz-muted">{s.label}</span>
                                    <span className="px-1.5 py-0.5 bg-white/10 border border-viz-border rounded text-[9px] font-mono text-white font-semibold">
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
