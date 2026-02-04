import React, { useEffect } from 'react';
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
    const { setActiveTool } = useStore();

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

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-neutral-100 flex flex-col antialiased selection:bg-primary/30">
            {/* Canvas Layer - Background */}
            <div className="absolute inset-0 overflow-hidden">
                <CanvasViewport />
            </div>

            {/* UI Overlay Layers */}
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
                {/* Top Toolbar */}
                <div className="flex justify-center p-4 pointer-events-auto">
                    <Toolbar />
                </div>

                {/* Main Workspace Area (Sidelines) */}
                <div className="flex flex-1 justify-between p-4 pointer-events-none">
                    <div className="pointer-events-auto flex flex-col gap-4">
                        <LayerPanel />
                    </div>
                    <div className="pointer-events-auto flex flex-col gap-4 fixed top-4 right-4 bottom-4 z-50 w-80">
                        <SidebarRight />
                        <ResultsPanel />
                    </div>
                </div>

                {/* Bottom controls */}
                <div className="flex justify-between p-4 pointer-events-none mt-auto">
                    <div className="pointer-events-auto">
                        <BottomLeftControls />
                    </div>
                    <div className="pointer-events-auto">
                        <BottomRightControls />
                    </div>
                </div>
            </div>

            {/* Preview Status Overlay */}
            <PreviewStatus />
        </div>
    );
};

export default Studio;
