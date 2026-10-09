'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useViewport } from '@xyflow/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AdvancedConfiguration } from './generationNodeMockup.types';

const STEP_OPTIONS = [20, 30, 40, 50];
const RESOLUTION_OPTIONS: Array<AdvancedConfiguration['referenceResolution']> = [512, 1024, 2048];

const FIELD_CLASS = 'nodrag w-full rounded-lg border border-viz-border bg-viz-surface px-2 py-1.5 text-xs text-white outline-none transition-colors focus:border-viz-accent';
const LABEL_CLASS = 'text-[10px] font-bold uppercase tracking-wider text-viz-muted';

interface GenerationAdvancedSettingsBodyProps {
    value: AdvancedConfiguration;
    onChange: (patch: Partial<AdvancedConfiguration>) => void;
}

/**
 * FR-003: exactly the MVP power-user set — generation quality/steps, prompt
 * adherence and reference resolution. Deferred controls (mask, LoRA, control
 * conditioning, upscale) must not appear here.
 */
export function GenerationAdvancedSettingsBody({ value, onChange }: GenerationAdvancedSettingsBodyProps) {
    return (
        <div role="region" aria-label="Advanced settings" className="space-y-2">
            <div className="space-y-1">
                <label htmlFor="advanced-steps" className={LABEL_CLASS}>Generation quality (steps)</label>
                <select
                    id="advanced-steps"
                    value={String(value.steps)}
                    onChange={(event) => onChange({ steps: Number(event.target.value) })}
                    className={FIELD_CLASS}
                >
                    {STEP_OPTIONS.map((steps) => (
                        <option key={steps} value={steps}>{steps}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1">
                <label htmlFor="advanced-guidance" className={LABEL_CLASS}>Prompt adherence</label>
                <input
                    id="advanced-guidance"
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={value.guidance}
                    onChange={(event) => onChange({ guidance: Number(event.target.value) })}
                    className="nodrag w-full accent-viz-accent"
                />
                <span className="text-right text-[10px] text-viz-muted">{value.guidance.toFixed(1)}</span>
            </div>

            <div className="space-y-1">
                <label htmlFor="advanced-resolution" className={LABEL_CLASS}>Reference resolution</label>
                <select
                    id="advanced-resolution"
                    value={String(value.referenceResolution)}
                    onChange={(event) => onChange({ referenceResolution: Number(event.target.value) as AdvancedConfiguration['referenceResolution'] })}
                    className={FIELD_CLASS}
                >
                    {RESOLUTION_OPTIONS.map((resolution) => (
                        <option key={resolution} value={resolution}>{resolution}px</option>
                    ))}
                </select>
            </div>
        </div>
    );
}

/** Flow-space anchor of the generate node (top-left + card width). */
export interface GenerationAdvancedToolbarAnchor {
    flowX: number;
    flowY: number;
    width: number;
}

interface GenerationAdvancedToolbarProps {
    anchor: GenerationAdvancedToolbarAnchor;
    value: AdvancedConfiguration;
    onChange: (patch: Partial<AdvancedConfiguration>) => void;
}

/**
 * Floating toolbar anchored above the generate node (workbench overlay pattern,
 * ui-translation §5): a single settings icon that reveals the advanced-settings
 * panel as a popover. Screen position = flow anchor × viewport transform,
 * recomputed on every `useViewport()` change — the same math the workbench uses
 * for its floating overlays. The root is `pointer-events-none`; the toolbar
 * opts back in with `pointer-events-auto`.
 */
export function GenerationAdvancedToolbar({ anchor, value, onChange }: GenerationAdvancedToolbarProps) {
    const viewport = useViewport();
    const screenX = (anchor.flowX + anchor.width / 2) * viewport.zoom + viewport.x;
    const screenY = anchor.flowY * viewport.zoom + viewport.y;

    return (
        <div className="pointer-events-none absolute inset-0 z-30">
            {/* Dynamic coordinates require inline positioning; static styling is in classes. */}
            <div
                className="nodrag nopan pointer-events-auto absolute rounded-xl2 border border-viz-border bg-viz-panel p-1 shadow-viz"
                style={{ left: `${screenX}px`, top: `${screenY - 8}px`, transform: 'translate(-50%, -100%)' }}
            >
                <Popover open={value.open} onOpenChange={(open) => onChange({ open })}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            aria-label="Advanced settings"
                            title="Advanced settings"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                        >
                            <SlidersHorizontal size={14} aria-hidden="true" />
                        </button>
                    </PopoverTrigger>
                    {/* Opens above the toolbar (away from the node); Radix flips on collision. */}
                    <PopoverContent align="center" side="top" sideOffset={8} className="w-56">
                        <GenerationAdvancedSettingsBody value={value} onChange={onChange} />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
