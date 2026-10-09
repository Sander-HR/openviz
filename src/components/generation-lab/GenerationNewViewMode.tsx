'use client';

import { useState } from 'react';
import { ChevronDown, Rotate3DIcon } from 'lucide-react';
import { VIEW_NAMES, type ViewName } from '@/types';
import { CUBE_VISIBLE_VIEWS, ViewCubePicker } from '@/components/nodes/ViewCubePicker';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import { ModeHeader, NODE_BUTTON_CLASS, ReferenceThumb } from './GenerationModeControls';

interface GenerationNewViewModeProps {
    state: GenerationPlaygroundState;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (request: RenderTaskRequest) => void;
    onBack: () => void;
}

export function GenerationNewViewMode({ state, references, task, onUpdate, onGenerate, onBack }: GenerationNewViewModeProps) {
    const primaryReference = references[0];
    const [showViews, setShowViews] = useState(false);
    // NewViewNode parity: hovering the cube previews that view in the label.
    const [hoveredView, setHoveredView] = useState<ViewName | null>(null);
    const selectedView = (VIEW_NAMES as readonly string[]).includes(state.selectedView) ? state.selectedView as ViewName : null;
    const hasReference = references.length > 0;
    const canGenerate = Boolean(selectedView) && hasReference && (task.status === 'idle' || task.status === 'completed' || task.status === 'partial' || task.status === 'failed');
    // The cube only shows ten of the fourteen views; the rest are dropdown-only.
    const cubeViews = VIEW_NAMES.filter((name) => CUBE_VISIBLE_VIEWS.includes(name));
    const hiddenViews = VIEW_NAMES.filter((name) => !CUBE_VISIBLE_VIEWS.includes(name));

    const renderViewOption = (name: ViewName) => (
        <button key={name} type="button" role="option" aria-selected={selectedView === name} onClick={() => { onUpdate({ selectedView: name }); setShowViews(false); }} className={`nodrag block w-full px-3 py-2 text-left text-xs hover:bg-white/10 ${selectedView === name ? 'text-viz-accent' : 'text-white/85'}`}>{name}</button>
    );

    const generate = () => {
        if (!canGenerate || !selectedView) return;
        onGenerate({
            kind: 'new-view',
            targetView: selectedView,
            referenceImageId: references[0]?.id,
            advanced: { steps: state.advanced.steps, guidance: state.advanced.guidance, referenceResolution: state.advanced.referenceResolution },
        });
    };

    return (
        <>
            <ModeHeader mode="new-view" title="New view" icon={Rotate3DIcon} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                {!hasReference && (
                    <p role="note" className="rounded-lg border border-dashed border-viz-border bg-viz-panel px-2.5 py-2 text-[10px] text-viz-muted">Connect an image before generating a new view.</p>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Select a view</span>
                    {hasReference && primaryReference && <ReferenceThumb reference={primaryReference} number={1} sizeClass="h-5 w-5 rounded" />}
                </div>
                <ViewCubePicker selectedView={selectedView} onSelect={(view) => onUpdate({ selectedView: view })} onHover={setHoveredView} />
                <div className="relative">
                    <button type="button" aria-label={selectedView ?? hoveredView ?? 'Select a view'} aria-expanded={showViews} aria-haspopup="listbox" onClick={() => setShowViews((visible) => !visible)} className="nodrag flex w-full items-center justify-between gap-2 rounded-lg border border-viz-border bg-viz-surface px-3 py-2 text-left text-xs transition-colors hover:border-viz-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                        <span className={`truncate ${selectedView ?? hoveredView ? 'text-white' : 'text-viz-muted'}`}>{selectedView ?? hoveredView ?? 'Select a view'}</span>
                        <ChevronDown size={12} className="shrink-0 text-viz-muted" aria-hidden="true" />
                    </button>
                    {showViews && (
                        <div role="listbox" aria-label="Available views" className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-48 overflow-y-auto rounded-lg border border-viz-border bg-viz-surface shadow-viz">
                            {cubeViews.map(renderViewOption)}
                            <div className="mx-3 mt-1 border-t border-viz-border pt-1.5" role="presentation">
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-viz-muted">Hidden views</span>
                            </div>
                            {hiddenViews.map(renderViewOption)}
                        </div>
                    )}
                </div>
                {state.prompt.trim() && <p className="truncate text-[10px] text-viz-muted">{state.prompt}</p>}
                <button type="button" disabled={!canGenerate} onClick={generate} className={`${NODE_BUTTON_CLASS} w-full`}>
                    Generate
                </button>
            </div>
        </>
    );
}
