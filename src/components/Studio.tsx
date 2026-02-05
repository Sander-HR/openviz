import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Toolbar from './Toolbar';
import SidebarRight from './SidebarRight';
import LayerPanel from './LayerPanel';
import CanvasViewport from './CanvasViewport';
import BottomRightControls from './BottomRightControls';
import BottomLeftControls from './BottomLeftControls';
import ResultsPanel from './ResultsPanel';
import PreviewStatus from './PreviewStatus';
import { useStore } from '../store/useStore';

const Studio: React.FC = () => {
    const { setActiveTool, isExitingStudio } = useStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key.toLowerCase()) {
                case 'b': setActiveTool('brush'); break;
                case 'e': setActiveTool('eraser'); break;
                case 's': setActiveTool('select'); break;
                case 'r': setActiveTool('rectangle'); break;
                case 'o': setActiveTool('circle'); break;
                case 'l': setActiveTool('line'); break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setActiveTool]);

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
                        className="pointer-events-auto flex flex-col gap-4"
                        initial="visible"
                        animate={isExitingStudio ? "hiddenLeft" : "visible"}
                        variants={panelVariants}
                    >
                        <SidebarLeft />
                    </motion.div>
                    <motion.div
                        className="pointer-events-auto flex flex-col gap-4 fixed top-4 right-4 bottom-4 z-50 w-80"
                        initial="visible"
                        animate={isExitingStudio ? "hiddenRight" : "visible"}
                        variants={panelVariants}
                    >
                        <SidebarRight />
                        <ResultsPanel />
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
                        <BottomRightControls />
                    </div>
                </motion.div>
            </div>

            {/* Preview Status Overlay */}
            <PreviewStatus />
        </div>
    );
};

export default Studio;
