import React, { useState } from 'react';
import { ChevronDown, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react';
import { useAIComputeStatus, type AIComputeStatus } from './hooks/useAIComputeStatus';
import { useStore } from '@/store/useStore';
import type { ExecutionTargetStatus } from '@/types/executionTarget.types';

interface ComputePopoverProps {
    onOpenSettings?: () => void;
}

const statusPresentation: Record<ExecutionTargetStatus, { label: string; dot: string; text: string }> = {
    ready: { label: 'Connected', dot: 'bg-emerald-500', text: 'text-emerald-600' },
    checking: { label: 'Checking', dot: 'bg-violet-400 animate-pulse', text: 'text-violet-600' },
    unknown: { label: 'Unknown', dot: 'bg-zinc-300', text: 'text-zinc-500' },
    degraded: { label: 'Degraded', dot: 'bg-amber-400', text: 'text-amber-600' },
    'auth-required': { label: 'Auth required', dot: 'bg-orange-400', text: 'text-orange-600' },
    unavailable: { label: 'Offline', dot: 'bg-rose-500', text: 'text-rose-600' },
};

function formatBytes(bytes: number | null): string {
    if (bytes === null || !Number.isFinite(bytes)) return '—';
    const gib = bytes / 1024 ** 3;
    return gib >= 1 ? `${gib.toFixed(1)} GB` : `${Math.max(0, Math.round(bytes / 1024 ** 2))} MB`;
}

function formatCheckedAt(timestamp: number | null): string {
    if (!timestamp) return 'never';
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
}

function pillLabel(status: AIComputeStatus): string {
    if (status.protocol === 'comfyui') return 'ComfyUI';
    const model = status.selectedModel;
    if (!model) return 'Endpoint';
    return model.length > 20 ? `${model.slice(0, 19)}…` : model;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{children}</p>;
}

function QueueRow({ label, active, queued, concurrency }: { label: string; active: number; queued: number; concurrency?: number }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{label}</span>
            <span className="font-mono text-zinc-700">
                {active}{concurrency !== undefined ? `/${concurrency}` : ''} active · {queued} queued
            </span>
        </div>
    );
}

function StatusPanel({ status, onRefresh }: { status: AIComputeStatus; onRefresh: () => void }) {
    const presentation = statusPresentation[status.status];
    const isImageApi = status.protocol === 'openai-image';
    const setImageApiModel = useStore((s) => s.setImageApiModel);
    const modelOptions = status.selectedModel && !status.models.includes(status.selectedModel)
        ? [status.selectedModel, ...status.models]
        : status.models;

    return (
        <div className="space-y-2">
            <div role="status" aria-live="polite" className="flex items-center justify-between gap-2">
                <span className={`flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium ${presentation.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${presentation.dot}`} />
                    {status.status === 'checking' && status.isRefreshing ? <LoaderCircle size={11} className="animate-spin" /> : null}
                    {presentation.label}
                </span>
                <span className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400">Checked {formatCheckedAt(status.lastCheckedAt)}</span>
                    <button type="button" onClick={onRefresh} aria-label="Refresh compute status" className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">
                        <RefreshCw size={12} className={status.isRefreshing ? 'animate-spin' : undefined} />
                    </button>
                </span>
            </div>

            {(status.queue || status.comfyQueue) && (
                <div className="space-y-1">
                    <SectionLabel>Job queue</SectionLabel>
                    {status.queue && <QueueRow label="OpenViz queue" active={status.queue.active} queued={status.queue.queued} concurrency={status.queue.concurrency} />}
                    {status.comfyQueue && <QueueRow label="ComfyUI server" active={status.comfyQueue.active} queued={status.comfyQueue.queued} />}
                </div>
            )}

            {isImageApi && (
                <div>
                    <SectionLabel>Model</SectionLabel>
                    {modelOptions.length === 0 ? (
                        <p className="text-xs text-zinc-500">{status.status === 'ready' ? 'No models reported.' : 'Unavailable while disconnected.'}</p>
                    ) : (
                        <select
                            aria-label="Active model"
                            value={status.selectedModel}
                            onChange={(event) => setImageApiModel(event.target.value)}
                            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-300"
                        >
                            {modelOptions.map((model) => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {isImageApi && status.endpointProbe && (
                <div>
                    <SectionLabel>Capabilities</SectionLabel>
                    <div className="flex flex-wrap gap-1">
                        {status.endpointProbe.schemaAvailable ? (
                            <>
                                {status.endpointProbe.progressTelemetry && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Progress telemetry</span>}
                                {status.endpointProbe.loadProgress && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Load progress</span>}
                                {status.endpointProbe.cancellation && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Cancellation</span>}
                            </>
                        ) : (
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">Generic OpenAI-compatible endpoint</span>
                        )}
                    </div>
                </div>
            )}

            {!isImageApi && status.devices.length > 0 && (
                <div>
                    <SectionLabel>Hardware</SectionLabel>
                    <ul className="space-y-1">
                        {status.devices.slice(0, 3).map((device) => (
                            <li key={`${device.name}-${device.index}`} className="flex items-center justify-between text-xs">
                                <span className="truncate text-zinc-600">{device.name} <span className="text-zinc-400">({device.type})</span></span>
                                <span className="font-mono text-zinc-500">
                                    {formatBytes(device.vramFreeBytes)} / {formatBytes(device.vramTotalBytes)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {status.message && status.status !== 'ready' && (
                <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{status.message}</p>
            )}
        </div>
    );
}

export const ComputePopover: React.FC<ComputePopoverProps> = ({ onOpenSettings }) => {
    const [open, setOpen] = useState(false);
    const status = useAIComputeStatus(open);
    const presentation = statusPresentation[status.status];

    return (
        <div className="relative">
            <button type="button" aria-label="Compute details" title={status.displayEndpoint} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white/90 px-2.5 py-1.5 text-xs text-zinc-700 shadow-lg backdrop-blur hover:bg-white">
                <span className={`h-1.5 w-1.5 rounded-full ${presentation.dot}`} /> {pillLabel(status)} <ChevronDown size={12} />
            </button>
            {open && (
                <div role="dialog" aria-label="Compute status" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-zinc-200 bg-white p-3 text-zinc-700 shadow-2xl">
                    <StatusPanel status={status} onRefresh={status.refresh} />
                    <button type="button" onClick={onOpenSettings ?? (() => { window.location.href = '/settings'; })} className="mt-3 flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium hover:bg-zinc-50">
                        <span>Open AI &amp; Compute settings</span><ExternalLink size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};
