import React, { useState } from 'react';
import { ChevronDown, Rotate3DIcon } from 'lucide-react';

import type { NewViewWorkbenchNode, ViewName } from '@/types';
import { VIEW_NAMES } from '@/types';
import { useNewViewNodeActions } from './hooks/useNewViewNodeActions';
import { cn, NodeCardHeader, nodeCardBodyClass, nodeCardClass, NodeTargetHandle } from './nodeUi';
import { ViewCubePicker } from './ViewCubePicker';

interface NewViewNodeData extends NewViewWorkbenchNode {
    onResize?: (nodeId: string, width: number, height: number, x?: number, y?: number) => void;
    onDataChange?: (nodeId: string, data: Partial<NewViewWorkbenchNode['data']>) => void;
}

interface NewViewNodeProps {
    id: string;
    data: NewViewNodeData;
    selected: boolean;
    width?: number;
    height?: number;
}

/**
 * New view generation node (spec 008 FR-005): an interactive view cube plus a
 * clickable view label (default "Select a view"), and a Generate button that
 * stays disabled until a view is selected AND at least one reference image is
 * connected (the connection itself is visible on the canvas).
 */
export const NewViewNode = React.memo(({ id, data, selected }: NewViewNodeProps) => {
    const [showViews, setShowViews] = useState(false);
    const [hoveredView, setHoveredView] = useState<ViewName | null>(null);
    const { view, isGenerating, isHoverConnectable, setIsHovered, referenceCount, handleGenerate } = useNewViewNodeActions(id, data);

    const prompt = data.data?.prompt ?? '';
    const canGenerate = view !== null && referenceCount > 0 && !isGenerating;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(nodeCardClass(selected), isHoverConnectable && 'border-viz-accent')}
        >
            <NodeTargetHandle id="newview-target-visible" selected={selected} />

            <NodeCardHeader icon={Rotate3DIcon} label="New View" />

            <div className={nodeCardBodyClass()}>
                <ViewCubePicker
                    selectedView={view}
                    onSelect={(name) => data.onDataChange?.(id, { view: name })}
                    onHover={setHoveredView}
                />

                <div className="relative">
                    <button
                        type="button"
                        aria-expanded={showViews}
                        aria-haspopup="listbox"
                        onClick={(event) => {
                            event.stopPropagation();
                            setShowViews((visible) => !visible);
                        }}
                        className="nodrag flex w-full items-center justify-between gap-2 rounded-lg border border-viz-border bg-viz-surface px-3 py-2 text-left text-xs transition-colors hover:border-viz-muted"
                    >
                        <span className={cn('truncate', !view && 'text-viz-muted')}>{view ?? hoveredView ?? 'Select a view'}</span>
                        <ChevronDown size={12} className="shrink-0 text-viz-muted" aria-hidden="true" />
                    </button>
                    {showViews && (
                        <div
                            role="listbox"
                            aria-label="View"
                            className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-lg border border-viz-border bg-viz-surface shadow-xl"
                        >
                            {VIEW_NAMES.map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    role="option"
                                    aria-selected={view === name}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        data.onDataChange?.(id, { view: name });
                                        setShowViews(false);
                                    }}
                                    className={cn(
                                        'nodrag w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/10',
                                        view === name ? 'text-viz-accent' : 'text-white/85',
                                    )}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {prompt.trim() && <p className="truncate text-[10px] text-viz-muted">{prompt}</p>}

                <button
                    type="button"
                    disabled={!canGenerate}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (canGenerate) void handleGenerate();
                    }}
                    className={cn(
                        'nodrag w-full rounded-xl py-2.5 text-xs font-bold transition-colors',
                        canGenerate ? 'bg-viz-accent text-white hover:bg-viz-accent/90' : 'cursor-not-allowed bg-viz-surface text-viz-muted',
                    )}
                >
                    {isGenerating ? 'Generating…' : 'Generate'}
                </button>
            </div>
        </div>
    );
});

NewViewNode.displayName = 'NewViewNode';
