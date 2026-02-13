import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Toolbar } from './studio/Toolbar';
import { RenderPanel } from './studio/RenderPanel';
import { LayerPanel } from './studio/LayerPanel';
import { CanvasViewport } from './studio/CanvasViewport';
import { CanvasControls } from './studio/CanvasControls';
import { BottomLeftControls } from './studio/BottomLeftControls';
import { ResultsPanel } from './studio/ResultsPanel';
import { PreviewStatus } from './studio/PreviewStatus';
import { useStore } from '../store/useStore';

export const Studio: React.FC = () => {
    const { setActiveTool, isExitingStudio, undo, redo } = useStore();
    const [renderPanelHeight, setRenderPanelHeight] = useState(320);
    const [resultsPanelHeight, setResultsPanelHeight] = useState(200);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartY = useRef(0);
    const startRenderHeight = useRef(0);
    const startResultsHeight = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        resizeStartY.current = e.clientY;
        startRenderHeight.current = renderPanelHeight;
        startResultsHeight.current = resultsPanelHeight;
    }, [renderPanelHeight, resultsPanelHeight]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!isResizing) return;
        
        const deltaY = e.clientY - resizeStartY.current;
        const newRenderHeight = Math.max(200, Math.min(500, startRenderHeight.current + deltaY));
        const newResultsHeight = Math.max(100, Math.min(400, startResultsHeight.current - deltaY));
        
        setRenderPanelHeight(newRenderHeight);
        setResultsPanelHeight(newResultsHeight);
    }, [isResizing]);

    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
        }
        
        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Undo/Redo shortcuts
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        redo();
                    } else {
                        e.preventDefault();
                        undo();
                    }
                    return;
                }
                if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    redo();
                    return;
                }
            }

            switch (e.key.toLowerCase()) {
                case 'b': setActiveTool('brush'); break;
                case 'e': setActiveTool('eraser'); break;
                case 's': setActiveTool('select'); break;
                case 'r': setActiveTool('rectangle'); break;
                case 'o': setActiveTool('circle'); break;
                case 'l': setActiveTool('line'); break;
                case 'g': setActiveTool('paintbucket'); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setActiveTool, undo, redo]);

    const panelVariants = {
        visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
        hiddenTop: { opacity: 0, y: -20, transition: { duration: 0.4, ease: "easeIn" } },
        hiddenLeft: { opacity: 0, x: -20, transition: { duration: 0.4, ease: "easeIn" } },
        hiddenRight: { opacity: 0, x: 20, transition: { duration: 0.4, ease: "easeIn" } },
        hiddenBottom: { opacity: 0, y: 20, transition: { duration: 0.4, ease: "easeIn" } }
    };

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-neutral-100 flex flex-col antialiased selection:bg-primary/30">
            {/* Canvas Layer - Background */}
            <div className="absolute inset-0 overflow-hidden">
                <CanvasViewport />
            </div>

            {/* UI Overlay Layers */}
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
                {/* Top Toolbar */}
                <motion.div
                    className="flex justify-center p-4 pointer-events-auto"
                    initial="visible"
                    animate={isExitingStudio ? "hiddenTop" : "visible"}
                    variants={panelVariants}
                >
                    <Toolbar />
                </motion.div>

                {/* Main Workspace Area (Sidelines) */}
                <div className="flex flex-1 justify-between p-4 pointer-events-none relative">
                    <motion.div
                        className="pointer-events-none flex flex-col gap-4 fixed top-4 left-4 bottom-4 z-50 w-60"
                        initial="visible"
                        animate={isExitingStudio ? "hiddenLeft" : "visible"}
                        variants={panelVariants}
                    >
                        <LayerPanel />
                    </motion.div>
                    <motion.div
                        ref={containerRef}
                        className="pointer-events-none flex flex-col fixed top-4 right-4 bottom-4 z-50 w-60"
                        initial="visible"
                        animate={isExitingStudio ? "hiddenRight" : "visible"}
                        variants={panelVariants}
                    >
                        <RenderPanel height={renderPanelHeight} />
                        <div 
                            className="h-[5px] cursor-row-resize hover:bg-primary/30 transition-colors flex-shrink-0 pointer-events-auto"
                            onMouseDown={handleResizeStart}
                            title="Drag to resize panels"
                        />
                        <ResultsPanel height={resultsPanelHeight} />
                    </motion.div>
                </div>

                {/* Bottom controls */}
                <motion.div
                    className="flex justify-between p-4 pointer-events-none mt-auto"
                    initial="visible"
                    animate={isExitingStudio ? "hiddenBottom" : "visible"}
                    variants={panelVariants}
                >
                    <div className="pointer-events-auto">
                        <BottomLeftControls />
                    </div>
                    <div className="pointer-events-auto">
                        <CanvasControls />
                    </div>
                </motion.div>
            </div>

            {/* Preview Status Overlay */}
            <PreviewStatus />
        </div>
    );
};
