import React from 'react';
import { Box, CircleHelp, Cuboid, Layers3, MousePointer2, PanelsTopLeft, SlidersHorizontal, Sparkles, Shuffle } from 'lucide-react';
import type { StudioWorkflowTab } from './WorkflowTabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StudioToolRailProps {
    active: StudioWorkflowTab;
    onChange: (tab: StudioWorkflowTab) => void;
    activeUtility: StudioUtilityTab;
    onUtilityChange: (tab: StudioUtilityTab) => void;
}

export type StudioUtilityTab = 'layers' | 'assets' | 'objects' | 'help';

type RailTool = { id: string; label: string; description: string; icon: React.ElementType };

const tools: Array<RailTool & { id: StudioWorkflowTab }> = [
    { id: 'modify', label: 'Modify', description: 'Request any edit to reshape, recolor, or reimagine your idea.', icon: MousePointer2 },
    { id: 'variation', label: 'Variation', description: "Quickly iterate on your product's color, form, and details.", icon: Shuffle },
    { id: 'generate', label: 'Make 3D', description: 'Transform 2D designs into interactive 3D models with depth and dimension.', icon: Cuboid },
    { id: 'legacy', label: 'Create (Legacy)', description: 'Render your sketch with a prompt and palette. Or guide it with a style, material, or color reference.', icon: PanelsTopLeft },
];

const utilityTools: Array<RailTool & { id: StudioUtilityTab }> = [
    { id: 'layers', label: 'Layers and library', description: 'Organize the layers and library assets of your drawing.', icon: Layers3 },
    { id: 'assets', label: 'Assets', description: 'Uploaded references and generated media will appear here.', icon: Sparkles },
    { id: 'objects', label: 'Canvas objects', description: 'Select an object on the canvas to inspect and organize it here.', icon: Box },
];

const railButtonClass = (isActive: boolean) =>
    `flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 ${
        isActive ? 'bg-viz-accent text-white' : 'text-viz-muted hover:bg-white/10 hover:text-white'
    }`;

function RailTooltip({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
    return (
        <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side="left" className="w-52 rounded-lg border border-viz-border bg-viz-surface px-3 py-2.5 text-left shadow-viz">
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="mt-1 text-[11px] leading-4 text-viz-muted">{description}</p>
            </TooltipContent>
        </Tooltip>
    );
}

export const StudioToolRail: React.FC<StudioToolRailProps> = ({ active, onChange, activeUtility, onUtilityChange }) => (
    <aside className="pointer-events-auto flex h-full w-11 shrink-0 flex-col items-center bg-viz-bg px-1 py-3 text-white" aria-label="Studio utility rail">
        <TooltipProvider delayDuration={250}>
            <div className="flex flex-col items-center gap-2">
                {tools.map(({ id, label, description, icon: Icon }) => (
                    <RailTooltip key={id} label={label} description={description}>
                        <button
                            type="button"
                            aria-label={label}
                            aria-pressed={active === id}
                            onClick={() => onChange(id)}
                            className={railButtonClass(active === id)}
                        >
                            <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                        </button>
                    </RailTooltip>
                ))}
            </div>
            <div className="my-4 h-px w-8 bg-white/20" />
            <div className="flex flex-col items-center gap-2">
                <RailTooltip label="Adjust" description="Dial in the brightness, contrast, and saturation of your render. Remove background and enhance.">
                    <button
                        type="button"
                        aria-label="Adjust"
                        aria-pressed={active === 'adjust'}
                        onClick={() => onChange('adjust')}
                        className={railButtonClass(active === 'adjust')}
                    >
                        <SlidersHorizontal size={18} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                </RailTooltip>
                {utilityTools.map(({ id, label, description, icon: Icon }) => (
                    <RailTooltip key={id} label={label} description={description}>
                        <button
                            type="button"
                            aria-label={label}
                            aria-pressed={activeUtility === id}
                            onClick={() => onUtilityChange(id)}
                            className={railButtonClass(activeUtility === id)}
                        >
                            <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                        </button>
                    </RailTooltip>
                ))}
            </div>
            <div className="mt-auto flex flex-col items-center gap-2">
                <RailTooltip label="Help" description="Keyboard shortcuts and workflow guidance for OpenViz.">
                    <button
                        type="button"
                        aria-label="Help"
                        aria-pressed={activeUtility === 'help'}
                        onClick={() => onUtilityChange('help')}
                        className={railButtonClass(activeUtility === 'help')}
                    >
                        <CircleHelp size={18} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                </RailTooltip>
            </div>
        </TooltipProvider>
    </aside>
);