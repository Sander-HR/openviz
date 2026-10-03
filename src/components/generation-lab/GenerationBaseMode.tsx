import { CopyPlus, Rotate3DIcon, Scissors, Sparkles, Video, Wand2, WandSparkles } from 'lucide-react';
import { NodeCardHeader, nodeCardBodyClass } from '@/components/nodes/nodeUi';
import type { GenerationMode } from './generationNodeMockup.types';

interface GenerationBaseModeProps {
    onSelect: (mode: GenerationMode) => void;
}

const ACTIONS = [
    { mode: 'modify' as const, label: 'Modify', icon: Wand2, disabled: false },
    { mode: 'animate' as const, label: 'Animate', icon: Video, disabled: false },
    { mode: 'instant-render' as const, label: 'Instant Render', icon: WandSparkles, disabled: false },
    { mode: 'variation' as const, label: 'Variate form and color', icon: CopyPlus, disabled: false },
    { mode: 'new-view' as const, label: 'New view', icon: Rotate3DIcon, disabled: false },
    { mode: 'expression' as const, label: 'Change expression', icon: Sparkles, disabled: true },
    { mode: 'extract' as const, label: 'Extract', icon: Scissors, disabled: false },
];

export function GenerationBaseMode({ onSelect }: GenerationBaseModeProps) {
    return (
        <>
            <NodeCardHeader icon={Wand2} label="Modify" badge={<span className="rounded-full bg-viz-surface px-2 py-1 text-[10px] font-medium text-viz-muted">AI EDIT</span>} />
            <div className={nodeCardBodyClass()}>
                <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelect('modify');
                    }}
                    className="nodrag touch-manipulation flex min-h-11 w-full items-center gap-2 rounded-lg bg-viz-selected px-2 text-left text-xs text-white transition-colors sm:h-8 sm:min-h-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                >
                    <span className="min-w-0 flex-1 truncate">Describe your changes</span>
                </button>
                <div className="space-y-1" aria-label="Generation actions">
                    {ACTIONS.map(({ mode, label, icon: Icon, disabled }) => (
                        <button
                            key={label}
                            type="button"
                            disabled={disabled}
                            aria-label={label}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (!disabled && mode !== 'expression') onSelect(mode);
                            }}
                            className={`nodrag touch-manipulation flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors sm:h-8 sm:min-h-0 ${disabled ? 'cursor-not-allowed text-viz-muted opacity-40' : 'text-white/90 hover:bg-viz-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent'}`}
                        >
                            <Icon size={14} className="shrink-0 text-viz-muted" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {disabled && <span className="text-[9px] text-viz-muted">Soon</span>}
                        </button>
                    ))}
                </div>
                <p className="text-center text-[10px] text-viz-muted">1 source image connected</p>
            </div>
        </>
    );
}
