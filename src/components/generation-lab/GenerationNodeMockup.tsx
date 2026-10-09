'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react';
import {
    Camera,
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
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { useWorkbenchThemeStore } from '@/store/slices/workbenchThemeSlice';
import type { RenderTaskReference } from '@/store/slices/renderTaskSlice';
import { GenerationLabCanvas } from './GenerationLabCanvas';
import { useRenderTask, type GenerationTaskApi } from './useRenderTask';
import { GenerationStatusPill } from './GenerationStatusPill';
import type { GenerationPlaygroundState, GenerationStatePatch } from './generationNodeMockup.types';

import { DEMO_REFERENCE_DATA_URL } from './demoReference';

const INITIAL_STATE: GenerationPlaygroundState = {
    mode: 'base',
    prompt: '',
    instantRatio: '1:1',
    instantStyle: 'cinematic',
    advanced: { open: false, steps: 30, guidance: 4, referenceResolution: 1024 },
    modify: { aspectRatio: '1:1', fidelity: 0.9 },
    animate: { styleId: 'standard_video', duration: '4s' },
    variation: {
        kind: 'form',
        preset: 'Expression',
        axisLabels: { top: 'Complex', bottom: 'Simple', left: 'Geometric', right: 'Organic' },
        position: { x: 50, y: 50 },
        magnitude: 0.5,
        paletteName: '',
        swatches: ['#111111', '#52627b', '#9fa8d0', '#313236'],
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
    const updateState = useCallback((patch: GenerationStatePatch) => setState((current) => ({ ...current, ...patch })), []);
    const references = useStore((store) => store.renderReferences);
    const addRenderReference = useStore((store) => store.addRenderReference);
    const task = useRenderTask();

    // The mockup ships with one connected demo reference so every mode is usable.
    useEffect(() => {
        if (useStore.getState().renderReferences.length === 0) {
            addRenderReference('Arc Lamp', DEMO_REFERENCE_DATA_URL);
        }
    }, [addRenderReference]);

    return (
        <ReactFlowProvider>
            <LabShell state={state} references={references} task={task} onUpdate={updateState} onGenerate={task.submit} />
        </ReactFlowProvider>
    );
}

interface LabShellProps {
    state: GenerationPlaygroundState;
    references: RenderTaskReference[];
    task: ReturnType<typeof useRenderTask>;
    onUpdate: (patch: GenerationStatePatch) => void;
    onGenerate: (request: Parameters<ReturnType<typeof useRenderTask>['submit']>[0]) => void;
}

function LabShell({ state, references, task, onUpdate, onGenerate }: LabShellProps) {
    // FR-015 parity: the canvas surface follows the workbench theme.
    const canvasTheme = useWorkbenchThemeStore((store) => store.canvasTheme);

    return (
        <main className={cn('relative h-dvh overflow-hidden', canvasTheme === 'dark' ? 'bg-viz-bg' : 'bg-white')} aria-label="Workbench mockup">
            <h1 className="sr-only">Workbench shared generation node mockup</h1>
            <GenerationLabCanvas state={state} references={references} task={task} onUpdate={onUpdate} onGenerate={onGenerate} />
            <WorkbenchMockChrome reference={references[0]} task={task} />
        </main>
    );
}

function WorkbenchMockChrome({ reference, task }: { reference?: RenderTaskReference; task: GenerationTaskApi }) {
    const prependRenderReference = useStore((store) => store.prependRenderReference);
    const { zoomIn, zoomOut } = useReactFlow();
    const { zoom } = useViewport();

    // A user photo becomes the primary source (references[0]) for every mode.
    const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') prependRenderReference(file.name, reader.result);
        };
        reader.readAsDataURL(file);
    };

    return (
        <>
            <div className="absolute left-4 top-4 z-30 flex h-9 items-center gap-2 rounded-lg border border-viz-border bg-viz-panel/95 px-3 shadow-viz">
                <span className="text-xs font-semibold text-white">OpenViz</span>
                <span className="h-4 w-px bg-viz-border" aria-hidden="true" />
                <span className="max-w-40 truncate text-xs text-white/80">{reference?.name ?? 'Arc lamp study'}</span>
                <label
                    htmlFor="reference-image-upload"
                    className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-viz-muted transition-colors hover:bg-viz-surface hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                >
                    <Camera size={13} aria-hidden="true" />
                    {reference ? 'Replace with photo' : 'Add photo'}
                </label>
                <input id="reference-image-upload" type="file" accept="image/*" className="sr-only" onChange={handleUpload} />
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
            {/* Top-right status messages pill: generate issues, queue position and the active job. */}
            <GenerationStatusPill task={task} />
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-xl2 border border-viz-border bg-viz-panel px-1.5 py-1 shadow-viz">
                <button type="button" aria-label="Zoom out" onClick={() => zoomOut({ duration: 300 })} className={TOOL_CLASS}><ZoomOut size={15} aria-hidden="true" /></button>
                <span className="min-w-10 text-center text-xs text-white/80">{Math.round(zoom * 100)}%</span>
                <button type="button" aria-label="Zoom in" onClick={() => zoomIn({ duration: 300 })} className={TOOL_CLASS}><ZoomIn size={15} aria-hidden="true" /></button>
            </div>
        </>
    );
}
