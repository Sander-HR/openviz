'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Circle,
    Eraser,
    Image as ImageIcon,
    MousePointer2,
    Plus,
    Redo2,
    StickyNote,
    Type,
    Undo2,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { cn, mediaNodeFrameClass, mediaNodeTitleClass, nodeCardClass } from '@/components/nodes/nodeUi';
import { ProductArtwork } from './ProductArtwork';
import { GenerationModePanel } from './GenerationModePanel';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'base',
    prompt: '',
    modify: { aspectRatio: '1:1' },
    animate: { styleId: 'standard_video', duration: '4s' },
    variation: {
        kind: 'form',
        axisLabels: { top: 'Top', bottom: 'Bottom', left: 'Left', right: 'Right' },
        position: 'center',
        preset: 'Balanced',
        paletteName: 'Untitled palette',
        swatches: ['stone', 'moss', 'sea', 'ember'],
        colorCount: 4,
        formCount: 4,
    },
    selectedView: '',
    extractKind: 'color',
    sampleBy: 'Hierarchy',
    extractAttached: false,
};

const TOOL_CLASS = 'flex h-8 w-8 items-center justify-center rounded-lg text-viz-muted transition-colors hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';

export function GenerationNodeMockup() {
    const [state, setState] = useState(INITIAL_STATE);
    const [status, setStatus] = useState('');
    const updateState = (patch: GenerationStatePatch) => setState((current) => ({ ...current, ...patch }));

    return (
        <main className="relative min-h-[100dvh] overflow-x-hidden bg-white text-white" aria-label="Workbench mockup">
            <h1 className="sr-only">Workbench shared generation node mockup</h1>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#c6cfdb_1px,transparent_1px)] bg-[length:12px_12px]" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#a0afc3_1px,transparent_1px)] bg-[length:56px_56px]" aria-hidden="true" />

            <WorkbenchMockChrome />

            <section className="relative mx-auto flex min-h-[100dvh] max-w-[1440px] flex-col items-center justify-center gap-12 px-4 pb-20 pt-28 lg:flex-row lg:gap-0 lg:pt-24" aria-label="Node canvas">
                <ReferenceImageNode />
                <div className="hidden w-16 items-center lg:flex" aria-hidden="true"><span className="h-px w-full border-t border-dashed border-viz-accent/70" /></div>
                <motion.section layout transition={{ layout: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }} className={cn(nodeCardClass(true), 'z-10')} aria-label="Shared generation node">
                    <button type="button" aria-label="Connected source image input" className="nodrag absolute -left-[14px] top-1/2 z-20 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full border-2 border-viz-bg bg-viz-accent text-white shadow-viz">
                        <Plus size={15} strokeWidth={3} aria-hidden="true" />
                    </button>
                    <GenerationModePanel state={state} referenceCount={1} onUpdate={updateState} onGenerate={(action) => setStatus(`Mock generation submitted · ${action}. No API request was sent.`)} />
                </motion.section>
            </section>

            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{status}</p>
        </main>
    );
}

function WorkbenchMockChrome() {
    return (
        <>
            <div className="absolute left-4 top-4 z-30 flex h-9 items-center gap-2 rounded-lg border border-viz-border bg-viz-panel/95 px-3 shadow-viz">
                <span className="text-xs font-semibold text-white">OpenViz</span>
                <span className="h-4 w-px bg-viz-border" aria-hidden="true" />
                <span className="max-w-40 truncate text-xs text-white/80">Arc lamp study</span>
            </div>
            <nav aria-label="Workbench tools" className="absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-xl2 border border-viz-border bg-viz-panel p-1 shadow-viz lg:top-4">
                <button type="button" aria-label="Select tool" aria-pressed="true" className={`${TOOL_CLASS} bg-viz-selected text-white`}><MousePointer2 size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Add node" className={TOOL_CLASS}><Plus size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Add image" className={TOOL_CLASS}><ImageIcon size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Text tool" className={TOOL_CLASS}><Type size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Sticky note tool" className={TOOL_CLASS}><StickyNote size={16} aria-hidden="true" /></button>
                <span className="mx-0.5 h-5 w-px bg-viz-border" aria-hidden="true" />
                <button type="button" aria-label="Eraser tool" className={TOOL_CLASS}><Eraser size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Undo" className={TOOL_CLASS}><Undo2 size={16} aria-hidden="true" /></button>
                <button type="button" aria-label="Redo" className={TOOL_CLASS}><Redo2 size={16} aria-hidden="true" /></button>
            </nav>
            <div className="absolute right-4 top-4 z-30 flex h-9 items-center gap-2 rounded-lg border border-viz-border bg-viz-panel/95 px-3 shadow-viz">
                <Circle size={8} fill="currentColor" className="text-viz-accent" aria-hidden="true" />
                <span className="text-xs text-white/80">AI ready</span>
            </div>
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-xl2 border border-viz-border bg-viz-panel px-1.5 py-1 shadow-viz">
                <button type="button" aria-label="Zoom out" className={TOOL_CLASS}><ZoomOut size={15} aria-hidden="true" /></button>
                <span className="min-w-10 text-center text-xs text-white/80">100%</span>
                <button type="button" aria-label="Zoom in" className={TOOL_CLASS}><ZoomIn size={15} aria-hidden="true" /></button>
            </div>
        </>
    );
}

function ReferenceImageNode() {
    return (
        <div className="relative z-10 w-[256px]">
            <span className={mediaNodeTitleClass()}>Arc lamp · reference</span>
            <div className={cn(mediaNodeFrameClass(false), 'aspect-square')}>
                <ProductArtwork className="h-full w-full" />
            </div>
        </div>
    );
}
