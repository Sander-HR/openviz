'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import type { GenerationTaskApi } from './useRenderTask';
import { useAIReadiness } from './useAIReadiness';

const PILL_BUTTON_CLASS = 'nodrag flex shrink-0 items-center gap-1 rounded-md border border-viz-border bg-viz-surface px-2 py-0.5 text-[10px] font-medium text-white transition-colors hover:border-viz-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent';

type PillTone = 'ok' | 'busy' | 'warn' | 'error' | 'muted';

interface PillContent {
    tone: PillTone;
    icon: ReactNode;
    message: string;
    detail?: string;
    action?: ReactNode;
}

const TONE_TEXT_CLASS: Record<PillTone, string> = {
    ok: 'text-white/90',
    busy: 'text-white/90',
    warn: 'text-amber-200',
    error: 'text-red-200',
    muted: 'text-viz-muted',
};

function spinner(): ReactNode {
    return <Loader2 size={13} className="shrink-0 animate-spin text-viz-accent" aria-hidden="true" />;
}

/** Maps the task lifecycle onto one status message: issues, queue position, active job. */
function buildPillContent(task: GenerationTaskApi, ready: boolean, reason: string | undefined): PillContent {
    switch (task.status) {
        case 'queued':
            return {
                tone: 'busy',
                icon: spinner(),
                message: task.queuePosition != null ? `Queued · position ${task.queuePosition}` : 'Queued…',
                action: (
                    <button type="button" onClick={task.cancel} className={PILL_BUTTON_CLASS}>
                        <XCircle size={11} aria-hidden="true" />Cancel
                    </button>
                ),
            };
        case 'active':
            return {
                tone: 'busy',
                icon: spinner(),
                message: 'Generating…',
                action: (
                    <button type="button" onClick={task.cancel} className={PILL_BUTTON_CLASS}>
                        <XCircle size={11} aria-hidden="true" />Cancel
                    </button>
                ),
            };
        case 'failed':
            return {
                tone: 'error',
                icon: <XCircle size={13} className="shrink-0 text-red-400" aria-hidden="true" />,
                message: task.error ?? 'The render task failed.',
                action: (
                    <button type="button" onClick={task.retry} className={PILL_BUTTON_CLASS}>
                        Retry
                    </button>
                ),
            };
        case 'completed':
            return {
                tone: 'ok',
                icon: <CheckCircle2 size={13} className="shrink-0 text-viz-accent" aria-hidden="true" />,
                message: task.outputs.length > 0 ? `Done · ${task.outputs.length} output${task.outputs.length === 1 ? '' : 's'}` : 'Done',
            };
        case 'partial':
            return {
                tone: 'warn',
                icon: <AlertTriangle size={13} className="shrink-0 text-amber-400" aria-hidden="true" />,
                message: 'Partial — some outputs failed',
            };
        case 'cancelled':
            return {
                tone: 'muted',
                icon: <XCircle size={13} className="shrink-0 text-viz-muted" aria-hidden="true" />,
                message: 'Cancelled',
            };
        case 'interrupted':
            return {
                tone: 'muted',
                icon: <AlertTriangle size={13} className="shrink-0 text-viz-muted" aria-hidden="true" />,
                message: 'Interrupted',
            };
        default:
            // idle
            return ready
                ? {
                    tone: 'ok',
                    icon: <Circle size={8} fill="currentColor" className="shrink-0 text-viz-accent" aria-hidden="true" />,
                    message: 'AI ready',
                }
                : {
                    tone: 'warn',
                    icon: <AlertTriangle size={13} className="shrink-0 text-amber-400" aria-hidden="true" />,
                    message: 'AI not ready',
                    detail: reason ?? 'no image backend configured',
                };
    }
}

/** Queue state for the details panel: waiting position, running, or empty. */
function describeQueue(task: GenerationTaskApi): string {
    if (task.status === 'queued') return task.queuePosition != null ? `Position ${task.queuePosition} in queue` : 'Waiting for a free slot';
    if (task.status === 'active') return 'Running now';
    return 'Empty';
}

function PanelSection({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-viz-muted">{label}</p>
            <div className="mt-1 space-y-1">{children}</div>
        </div>
    );
}

/**
 * Top-right status messages pill for the generation lab. It is the single home
 * for generate issues (errors, readiness), queue position and the active job —
 * the generation node card itself stays free of task status. Clicking the pill
 * opens a details panel with the render queue, current status and the job.
 */
export function GenerationStatusPill({ task }: { task: GenerationTaskApi }) {
    const readiness = useAIReadiness();
    const lastRequest = useStore((state) => state.lastRenderRequest);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const content = buildPillContent(task, readiness.ready, readiness.reason);

    // Dismiss on outside mousedown (studio LayerDropdown pattern).
    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open]);

    // Dismiss on Escape.
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    const hasJob = Boolean(task.taskId || lastRequest);

    return (
        <div ref={containerRef} role="status" aria-live="polite" className="absolute right-4 top-4 z-30 max-w-md">
            <div className="flex h-9 items-center gap-1 rounded-lg border border-viz-border bg-viz-panel/95 px-2 pr-3 shadow-viz">
                <button
                    type="button"
                    onClick={() => setOpen((visible) => !visible)}
                    aria-expanded={open}
                    aria-controls="render-task-panel"
                    className="nodrag flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-viz-surface focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                >
                    {content.icon}
                    {content.tone === 'error' ? (
                        <span role="alert" title={content.message} className="min-w-0 truncate text-xs font-medium text-red-200">{content.message}</span>
                    ) : (
                        <span title={content.message} className={cn('min-w-0 truncate text-xs font-medium', TONE_TEXT_CLASS[content.tone])}>{content.message}</span>
                    )}
                    {content.detail && <span className="hidden min-w-0 max-w-52 truncate text-[10px] text-viz-muted sm:block">{content.detail}</span>}
                </button>
                {content.action}
            </div>

            {open && (
                <div id="render-task-panel" role="region" aria-label="Render task details" className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-viz-border bg-viz-surface p-3 shadow-viz">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-white">Render status</h4>
                        <button
                            type="button"
                            aria-label="Close render status"
                            onClick={() => setOpen(false)}
                            className="nodrag flex h-6 w-6 items-center justify-center rounded-md text-viz-muted transition-colors hover:bg-viz-panel hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-viz-accent"
                        >
                            <X size={13} aria-hidden="true" />
                        </button>
                    </div>

                    <div className="mt-2 space-y-3">
                        <PanelSection label="Queue">
                            <p className="text-xs text-white/90">{describeQueue(task)}</p>
                        </PanelSection>

                        <PanelSection label="Status">
                            <p className={cn('text-xs font-medium capitalize', TONE_TEXT_CLASS[content.tone])}>{task.status}</p>
                            {task.error && <p className="text-xs text-red-200">{task.error}</p>}
                        </PanelSection>

                        <PanelSection label="Jobs">
                            {hasJob ? (
                                <>
                                    {lastRequest && (
                                        <div className="rounded-md border border-viz-border bg-viz-panel px-2 py-1.5">
                                            <p className="truncate text-[10px] font-medium text-white/90">
                                                {lastRequest.kind}
                                                {lastRequest.aspectRatio ? ` · ${lastRequest.aspectRatio}` : ''}
                                                {lastRequest.seed !== undefined ? ` · seed ${lastRequest.seed}` : ''}
                                            </p>
                                            {lastRequest.prompt && <p className="mt-0.5 line-clamp-2 text-[10px] text-viz-muted">{lastRequest.prompt}</p>}
                                        </div>
                                    )}
                                    {task.outputs.length > 0 ? (
                                        <ul className="space-y-1">
                                            {task.outputs.map((output, index) => (
                                                <li key={output.id} className="flex items-center gap-2 rounded-md border border-viz-border bg-viz-panel px-2 py-1">
                                                    {output.url ? (
                                                        <img src={output.url} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                                                    ) : (
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-viz-panel text-viz-muted"><Circle size={7} aria-hidden="true" /></span>
                                                    )}
                                                    <span className="min-w-0 flex-1 truncate text-[10px] text-white/90">Output {index + 1}</span>
                                                    {output.seed !== undefined && <span className="shrink-0 text-[9px] text-viz-muted">seed {output.seed}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-[10px] text-viz-muted">{task.status === 'queued' || task.status === 'active' ? 'No outputs yet — the job is still running.' : 'No outputs recorded for this job.'}</p>
                                    )}
                                </>
                            ) : (
                                <p className="text-[10px] text-viz-muted">No jobs yet.</p>
                            )}
                        </PanelSection>
                    </div>
                </div>
            )}
        </div>
    );
}
