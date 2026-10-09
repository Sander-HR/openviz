'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import type { GenerationMode, GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';
import type { RenderTaskRequest } from '@/types/renderTask.types';
import type { GenerationTaskApi } from './useRenderTask';
import { GenerationBaseMode } from './GenerationBaseMode';
import { GenerationModifyMode } from './GenerationModifyMode';
import { GenerationAnimateMode } from './GenerationAnimateMode';
import { GenerationInstantRenderMode } from './GenerationInstantRenderMode';
import { GenerationExtractMode } from './GenerationExtractMode';
import { GenerationNewViewMode } from './GenerationNewViewMode';
import { GenerationVariationMode } from './GenerationVariationMode';

interface GenerationModePanelProps {
    state: GenerationPlaygroundState;
    references: RenderTaskReference[];
    task: GenerationTaskApi;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (request: RenderTaskRequest) => void;
}

export function GenerationModePanel({ state, references, task, onUpdate, onGenerate }: GenerationModePanelProps) {
    const reduceMotion = useReducedMotion();
    const setMode = (mode: GenerationMode) => onUpdate({ mode });
    const backToBase = () => setMode('base');

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={state.mode}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
                data-mode={state.mode}
            >
                {state.mode === 'base' && <GenerationBaseMode onSelect={setMode} />}
                {state.mode === 'modify' && <GenerationModifyMode state={state} onUpdate={onUpdate} references={references} task={task} onGenerate={onGenerate} onBack={backToBase} />}
                {state.mode === 'animate' && <GenerationAnimateMode state={state} onUpdate={onUpdate} references={references} task={task} onGenerate={onGenerate} onBack={backToBase} />}
                {state.mode === 'instant-render' && <GenerationInstantRenderMode state={state} onUpdate={onUpdate} references={references} task={task} onGenerate={onGenerate} onBack={backToBase} />}
                {state.mode === 'variation' && <GenerationVariationMode state={state} onUpdate={onUpdate} references={references} task={task} onGenerate={onGenerate} onBack={backToBase} />}
                {state.mode === 'new-view' && <GenerationNewViewMode state={state} references={references} task={task} onUpdate={onUpdate} onGenerate={onGenerate} onBack={backToBase} />}
                {state.mode === 'extract' && <GenerationExtractMode state={state} onUpdate={onUpdate} references={references} task={task} onGenerate={onGenerate} onBack={backToBase} />}
            </motion.div>
        </AnimatePresence>
    );
}
