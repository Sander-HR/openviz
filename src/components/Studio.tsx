import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Toolbar } from './studio/Toolbar';
import { CanvasViewport } from './studio/CanvasViewport';
import { CanvasControls } from './studio/CanvasControls';
import { BottomLeftControls } from './studio/BottomLeftControls';
import { ResultsPanel } from './studio/ResultsPanel';
import { PreviewStatus } from './studio/PreviewStatus';
import { ModifyPanel } from './studio/ModifyPanel';
import { RenderPanel } from './studio/RenderPanel';
import type { StudioWorkflowTab } from './studio/WorkflowTabs';
import { AdjustPanel } from './studio/AdjustPanel';
import { VariationPanel } from './studio/VariationPanel';
import { StudioToolRail, type StudioUtilityTab } from './studio/StudioToolRail';
import { StudioUtilityPanel } from './studio/StudioUtilityPanel';
import { Make3DPanel } from './studio/Make3DPanel';
import { ProjectHeader } from './common/ProjectHeader';
import { useStore } from '../store/useStore';
import { useStudioPanels } from './studio/hooks/useStudioPanels';
import { useStudioShortcuts } from './studio/hooks/useStudioShortcuts';
import { studioPanelVariants } from './studio/hooks/useStudioTransitions';
import { useShallow } from 'zustand/react/shallow';

export const Studio: React.FC<{ active?: boolean }> = ({ active = true }) => {
    const rasterizeActiveLayerRef = useRef<(() => boolean) | null>(null);
    const [activeWorkflow, setActiveWorkflow] = useState<StudioWorkflowTab>('generate');
    const [activeUtility, setActiveUtility] = useState<StudioUtilityTab>('layers');
    const [collapsedWorkflows, setCollapsedWorkflows] = useState<Partial<Record<StudioWorkflowTab, boolean>>>({});
    const createPanelCollapsed = collapsedWorkflows[activeWorkflow] ?? false;
    const setCreatePanelCollapsed = (collapsed: boolean) => {
        setCollapsedWorkflows((current) => ({ ...current, [activeWorkflow]: collapsed }));
    };
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
        createPanelCollapsed,
    });
    useStudioShortcuts({ enabled: active && !isExitingStudio, setActiveTool, undo, redo });

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-neutral-100 flex flex-col antialiased selection:bg-primary/30">
            {/* Canvas Layer - Background */}
            <div className="absolute inset-0 overflow-hidden">
                <CanvasViewport onRasterizeReady={(rasterize) => { rasterizeActiveLayerRef.current = rasterize; }} />
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
                    className="flex justify-center px-4 pb-4 pt-2 pointer-events-auto"
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
                        <StudioUtilityPanel activeUtility={activeUtility} />
                    </motion.div>
                    <motion.div
                        ref={containerRef}
                        className="pointer-events-auto fixed inset-y-0 right-0 z-50 flex w-[min(100vw,18.6rem)] justify-end gap-2 overflow-visible"
                        initial="visible"
                        animate={isExitingStudio ? "hiddenRight" : "visible"}
                        variants={studioPanelVariants}
                    >
                        <div className="relative flex min-w-0 flex-1 flex-col gap-[1.6px] overflow-visible py-2 pl-0">
                            <div className="h-full min-h-0 w-full flex-shrink-0" style={{ height: renderPanelHeight }}>
                                {activeWorkflow === 'generate' ? <Make3DPanel collapsed={createPanelCollapsed} onCollapsedChange={setCreatePanelCollapsed} /> : activeWorkflow === 'modify' ? <ModifyPanel height={renderPanelHeight} collapsed={createPanelCollapsed} onCollapsedChange={setCreatePanelCollapsed} /> : activeWorkflow === 'adjust' ? <AdjustPanel collapsed={createPanelCollapsed} onCollapsedChange={setCreatePanelCollapsed} onRasterize={() => rasterizeActiveLayerRef.current?.() ?? false} /> : activeWorkflow === 'variation' ? <VariationPanel collapsed={createPanelCollapsed} onCollapsedChange={setCreatePanelCollapsed} /> : <RenderPanel height={renderPanelHeight} collapsed={createPanelCollapsed} onCollapsedChange={setCreatePanelCollapsed} />}
                            </div>
                            {resultsPanelOpen && !createPanelCollapsed && <div
                                className="hidden h-[5px] !cursor-row-resize touch-none select-none bg-primary/10 hover:bg-primary/40 transition-colors flex-shrink-0 pointer-events-auto sm:block"
                                onPointerDown={handleResizeStart}
                                role="separator"
                                aria-label="Resize Create and Results panels"
                                aria-orientation="horizontal"
                                title="Drag to resize panels"
                            />}
                            <ResultsPanel height={resultsPanelHeight} />
                        </div>
                        <StudioToolRail active={activeWorkflow} onChange={setActiveWorkflow} activeUtility={activeUtility} onUtilityChange={setActiveUtility} />
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
