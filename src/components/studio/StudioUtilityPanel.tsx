import React from 'react';
import { Box, CircleHelp, FolderOpen, Layers3 } from 'lucide-react';
import { LayerPanel } from './LayerPanel';
import type { StudioUtilityTab } from './StudioToolRail';

interface StudioUtilityPanelProps {
    activeUtility: StudioUtilityTab;
}

const utilityCopy: Record<Exclude<StudioUtilityTab, 'layers'>, { title: string; description: string; icon: React.ElementType }> = {
    assets: {
        title: 'Assets',
        description: 'Uploaded references and generated media will appear here.',
        icon: FolderOpen,
    },
    objects: {
        title: 'Canvas objects',
        description: 'Select an object on the canvas to inspect and organize it here.',
        icon: Box,
    },
    help: {
        title: 'Help',
        description: 'Keyboard shortcuts and workflow guidance for OpenViz.',
        icon: CircleHelp,
    },
};

export const StudioUtilityPanel: React.FC<StudioUtilityPanelProps> = ({ activeUtility }) => {
    if (activeUtility === 'layers') {
        return <LayerPanel />;
    }

    const { title, description, icon: Icon } = utilityCopy[activeUtility];
    return (
        <section className="flex h-fit max-h-[calc(100vh-120px)] min-h-48 w-full flex-col overflow-hidden rounded-xl2 border border-viz-border bg-viz-panel text-white shadow-viz" aria-labelledby="studio-utility-panel-title">
            <header className="flex h-10 shrink-0 items-center gap-2 px-3">
                <Icon size={15} className="text-viz-muted" aria-hidden="true" />
                <h2 id="studio-utility-panel-title" className="text-xs font-semibold">{title}</h2>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <Layers3 size={28} className="text-primary/80" aria-hidden="true" />
                <p className="text-xs leading-5 text-text-secondary">{description}</p>
                <span className="rounded-full border border-panel-border px-3 py-1 text-[10px] text-text-secondary">Coming next in the studio roadmap</span>
            </div>
        </section>
    );
};
