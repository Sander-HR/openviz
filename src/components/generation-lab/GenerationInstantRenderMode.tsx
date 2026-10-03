import { motion, useReducedMotion } from 'framer-motion';
import { WandSparkles } from 'lucide-react';
import { nodeCardBodyClass } from '@/components/nodes/nodeUi';
import { ProductArtwork } from './ProductArtwork';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import { ModeHeader, NODE_BUTTON_CLASS, NODE_CONTROL_CLASS, PromptEditor, SectionLabel } from './GenerationModeControls';

interface GenerationInstantRenderModeProps {
    state: GenerationPlaygroundState;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (label: string) => void;
    onBack: () => void;
}

export function GenerationInstantRenderMode({ state, onUpdate, onGenerate, onBack }: GenerationInstantRenderModeProps) {
    const reduceMotion = useReducedMotion();
    const canGenerate = state.prompt.trim().length > 0;

    return (
        <>
            <ModeHeader mode="instant-render" title="Instant Render" icon={WandSparkles} onBack={onBack} />
            <div className={nodeCardBodyClass()}>
                <div className="space-y-1.5">
                    <SectionLabel>Reference image</SectionLabel>
                    <div className="flex items-center gap-2 rounded-lg border border-viz-border bg-viz-surface p-1.5">
                        <ProductArtwork className="h-9 w-9 shrink-0 rounded-md" />
                        <label htmlFor="instant-render-reference" className="sr-only">Reference image</label>
                        <input id="instant-render-reference" aria-label="Reference image" readOnly value="Arc lamp · connected" className={`${NODE_CONTROL_CLASS} min-w-0 border-0 bg-transparent px-1 py-1 focus:border-0`} />
                        <span className="shrink-0 rounded bg-viz-panel px-1.5 py-1 text-[9px] text-viz-muted">1 ref</span>
                    </div>
                </div>
                <PromptEditor id="instant-render-prompt" autoFocus value={state.prompt} onChange={(prompt) => onUpdate({ prompt })} />
                <motion.button
                    type="button"
                    disabled={!canGenerate}
                    onClick={() => onGenerate('Instant Render')}
                    initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 28, delay: 0.04 }}
                    className={`${NODE_BUTTON_CLASS} flex w-full items-center justify-center gap-1.5`}
                >
                    <WandSparkles size={14} aria-hidden="true" />Generate
                </motion.button>
            </div>
        </>
    );
}
