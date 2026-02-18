import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Toolbar } from './studio/Toolbar';
import { RenderPanel } from './studio/RenderPanel';
import { LayerPanel } from './studio/LayerPanel';
import { CanvasViewport } from './studio/CanvasViewport';
import { CanvasControls } from './studio/CanvasControls';
import { BottomLeftControls } from './studio/BottomLeftControls';
import { ResultsPanel } from './studio/ResultsPanel';
import { PreviewStatus } from './studio/PreviewStatus';
import { ProjectHeader } from './common/ProjectHeader';
import { useStore } from '../store/useStore';

const COLLAPSED_RESULTS_HEIGHT = 140;
const RENDER_PANEL_MAX = 500;
const RENDER_PANEL_MIN = 200;
const RESULTS_PANEL_MIN = 100;
const RESULTS_PANEL_MAX = 400;

export const Studio: React.FC = () => {
    const { setActiveTool, isExitingStudio, undo, redo, resultsPanelOpen } = useStore();
    const [expandedRenderHeight, setExpandedRenderHeight] = useState(320);
    const [expandedResultsHeight, setExpandedResultsHeight] = useState(200);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartY = useRef(0);
    const startRenderHeight = useRef(0);
    const startResultsHeight = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const containerHeightRef = useRef(0);

    const updateContainerHeight = useCallback(() => {
        if (containerRef.current) {
            containerHeightRef.current = containerRef.current.clientHeight - 5;
        }
    }, []);

    useEffect(() => {
        updateContainerHeight();
        window.addEventListener('resize', updateContainerHeight);
        return () => window.removeEventListener('resize', updateContainerHeight);
    }, [updateContainerHeight]);

    const { renderPanelHeight, resultsPanelHeight } = useMemo(() => {
        updateContainerHeight();
        const availableHeight = containerHeightRef.current;

        if (resultsPanelOpen) {
            const totalHeight = expandedRenderHeight + expandedResultsHeight;
            const renderHeight = Math.max(RENDER_PANEL_MIN, Math.min(RENDER_PANEL_MAX,
                (expandedRenderHeight / totalHeight) * availableHeight));
            const resultsHeight = Math.max(RESULTS_PANEL_MIN, Math.min(RESULTS_PANEL_MAX,
                availableHeight - renderHeight));
            return { renderPanelHeight: renderHeight, resultsPanelHeight: resultsHeight };
        } else {
            // When container height hasn't been measured yet (initial load), default to maximum
            const renderHeight = availableHeight > 0 
                ? Math.min(RENDER_PANEL_MAX, availableHeight - COLLAPSED_RESULTS_HEIGHT)
                : RENDER_PANEL_MAX;
            return {
                renderPanelHeight: Math.max(RENDER_PANEL_MIN, renderHeight),
                resultsPanelHeight: COLLAPSED_RESULTS_HEIGHT
            };
        }
    }, [resultsPanelOpen, expandedRenderHeight, expandedResultsHeight, updateContainerHeight]);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (!resultsPanelOpen) return;
        setIsResizing(true);
        resizeStartY.current = e.clientY;
        startRenderHeight.current = expandedRenderHeight;
        startResultsHeight.current = expandedResultsHeight;
    }, [resultsPanelOpen, expandedRenderHeight, expandedResultsHeight]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !resultsPanelOpen) return;

        const deltaY = e.clientY - resizeStartY.current;
        const newRenderHeight = Math.max(RENDER_PANEL_MIN, Math.min(RENDER_PANEL_MAX, startRenderHeight.current + deltaY));
        const newResultsHeight = Math.max(RESULTS_PANEL_MIN, Math.min(RESULTS_PANEL_MAX, startResultsHeight.current - deltaY));

        setExpandedRenderHeight(newRenderHeight);
        setExpandedResultsHeight(newResultsHeight);
    }, [isResizing, resultsPanelOpen]);

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
                {/* Top Left - Project Header */}
                <motion.div
                    className="absolute top-4 left-4 z-50"
                    initial="visible"
                    animate={isExitingStudio ? "hiddenLeft" : "visible"}
                    variants={panelVariants}
                >
                    <ProjectHeader mode="studio" />
                </motion.div>

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
                        className="pointer-events-none flex flex-col gap-4 fixed top-20 left-4 bottom-4 z-50 w-60"
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
