import React, { useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';

interface StudioPanelFrameProps {
    title: string;
    children: React.ReactNode;
    className?: string;
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export const StudioPanelFrame: React.FC<StudioPanelFrameProps> = ({ title, children, className = '', collapsed, onCollapsedChange }) => {
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCollapsed = collapsed ?? internalCollapsed;
    const panelId = `studio-panel-${title.toLowerCase()}`;
    const setCollapsed = (nextCollapsed: boolean) => {
        onCollapsedChange?.(nextCollapsed);
        if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    };

    return (
        <section className={`flex h-full min-h-0 w-full max-h-full flex-col overflow-hidden rounded-xl2 border border-viz-border bg-viz-panel text-white shadow-viz ${className}`} aria-labelledby={panelId}>
            <header className="flex h-10 shrink-0 items-center justify-between px-3">
                <button type="button" aria-expanded={!isCollapsed} aria-controls={`${panelId}-content`} onClick={() => setCollapsed(!isCollapsed)} className="flex h-full min-w-0 items-center gap-2 text-left">
                    <ChevronDown size={14} strokeWidth={2} className={`shrink-0 text-viz-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                    <h2 id={panelId} className="truncate text-xs font-semibold">{title}</h2>
                </button>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-white/10 hover:text-white" aria-label={`${title} menu`}>
                    <MoreHorizontal size={16} aria-hidden="true" />
                </button>
            </header>
            {!isCollapsed && <div id={`${panelId}-content`} className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>}
        </section>
    );
};