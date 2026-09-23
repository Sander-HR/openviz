import React from 'react';
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
import { useStudioPanels } from './studio/hooks/useStudioPanels';
import { useStudioShortcuts } from './studio/hooks/useStudioShortcuts';
import { studioPanelVariants } from './studio/hooks/useStudioTransitions';
import { useShallow } from 'zustand/react/shallow';

export const Studio: React.FC = () => {
    const { setActiveTool, isExitingStudio, undo, redo, resultsPanelOpen } = useStore(
        useShallow((state) => ({
            setActiveTool: state.setActiveTool,
            isExitingStudio: state.isExitingStudio,
            undo: state.undo,
            redo: state.redo,
            resultsPanelOpen: state.resultsPanelOpen,
        }))
    );
    const { containerRef, renderPanelHeight, resultsPanelHeight, handleResizeStart } = useStudioPanels({
        resultsPanelOpen,
    });
    useStudioShortcuts({ setActiveTool, undo, redo });

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
                    variants={studioPanelVariants}
                >
                    <ProjectHeader mode="studio" />
                </motion.div>

                {/* Top Toolbar */}
                <motion.div
                    className="flex justify-center p-4 pointer-events-auto"
                    initial="visible"
                    animate={isExitingStudio ? "hiddenTop" : "visible"}
                    variants={studioPanelVariants}
                >
                    <Toolbar />
                </motion.div>

                {/* Main Workspace Area (Sidelines) */}
                <div className="flex flex-1 justify-between p-4 pointer-events-none relative">
                    <motion.div
                        className="pointer-events-none flex flex-col gap-4 fixed top-20 left-4 bottom-4 z-50 w-60"
                        initial="visible"
                        animate={isExitingStudio ? "hiddenLeft" : "visible"}
                        variants={studioPanelVariants}
                    >
                        <LayerPanel />
                    </motion.div>
                    <motion.div
                        ref={containerRef}
                        className="pointer-events-none flex flex-col fixed top-4 right-4 bottom-4 z-50 w-60"
                        initial="visible"
                        animate={isExitingStudio ? "hiddenRight" : "visible"}
                        variants={studioPanelVariants}
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
                    variants={studioPanelVariants}
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
