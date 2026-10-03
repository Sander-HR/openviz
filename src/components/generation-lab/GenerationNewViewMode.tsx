import { useState } from 'react';
import { ChevronDown, Rotate3DIcon } from 'lucide-react';
import { VIEW_NAMES, type ViewName } from '@/types';
import { ViewCubePicker } from '@/components/nodes/ViewCubePicker';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import { ModeHeader, NODE_BUTTON_CLASS } from './GenerationModeControls';

interface GenerationNewViewModeProps {
    state: GenerationPlaygroundState;
    referenceCount: number;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (label: string) => void;
    onBack: () => void;
}

export function GenerationNewViewMode({ state, referenceCount, onUpdate, onGenerate, onBack }: GenerationNewViewModeProps) {
    const [showViews, setShowViews] = useState(false);
    const selectedView = (VIEW_NAMES as readonly string[]).includes(state.selectedView) ? state.selectedView as ViewName : null;
    const canGenerate = Boolean(selectedView) && referenceCount > 0;

    return (
        <>
            <ModeHeader mode="new-view" title="New view" icon={Rotate3DIcon} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">Select a view</span>
                    <span className="rounded bg-viz-surface px-2 py-1 text-[10px] text-viz-muted">{referenceCount} ref</span>
                </div>
                <ViewCubePicker selectedView={selectedView} onSelect={(view) => onUpdate({ selectedView: view })} />
                <div className="relative">
                    <button type="button" aria-label={selectedView ?? 'Select a view'} aria-expanded={showViews} aria-haspopup="listbox" onClick={() => setShowViews((visible) => !visible)} className="nodrag flex w-full items-center justify-between gap-2 rounded-lg border border-viz-border bg-viz-surface px-3 py-2 text-left text-xs transition-colors hover:border-viz-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent">
                        <span className={`truncate ${selectedView ? 'text-white' : 'text-viz-muted'}`}>{selectedView ?? 'Select a view'}</span>
                        <ChevronDown size={12} className="shrink-0 text-viz-muted" aria-hidden="true" />
                    </button>
                    {showViews && (
                        <div role="listbox" aria-label="Available views" className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-40 overflow-y-auto rounded-lg border border-viz-border bg-viz-surface shadow-viz">
                            {VIEW_NAMES.map((view) => <button key={view} type="button" role="option" aria-selected={selectedView === view} onClick={() => { onUpdate({ selectedView: view }); setShowViews(false); }} className={`nodrag block w-full px-3 py-2 text-left text-xs hover:bg-white/10 ${selectedView === view ? 'text-viz-accent' : 'text-white/85'}`}>{view}</button>)}
                        </div>
                    )}
                </div>
                {state.prompt.trim() && <p className="truncate text-[10px] text-viz-muted">{state.prompt}</p>}
                <button type="button" disabled={!canGenerate} onClick={() => onGenerate('New view')} className={`${NODE_BUTTON_CLASS} w-full`}>
                    Generate
                </button>
            </div>
        </>
    );
}
