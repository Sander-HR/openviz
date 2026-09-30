import React from 'react';
import { CheckCircle2, CircleAlert, Cpu, LoaderCircle } from 'lucide-react';
import { cn } from '@/components/nodes/nodeUi';

export type ComputeChipStatus = 'ready' | 'checking' | 'degraded' | 'unavailable';

interface ComputeStatusChipProps {
    status: ComputeChipStatus;
    targetName: string;
    tier: string;
}

const statusLabels: Record<ComputeChipStatus, string> = {
    ready: 'Ready',
    checking: 'Checking',
    degraded: 'Degraded',
    unavailable: 'Unavailable',
};

export const ComputeStatusChip: React.FC<ComputeStatusChipProps> = ({ status, targetName, tier }) => {
    const Icon = status === 'ready' ? CheckCircle2 : status === 'checking' ? LoaderCircle : CircleAlert;
    return (
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1.5 text-xs text-zinc-700 shadow-lg backdrop-blur">
            <Icon size={13} className={cn(
                status === 'ready' && 'text-emerald-500',
                status === 'checking' && 'animate-spin text-violet-500',
                status === 'degraded' && 'text-amber-500',
                status === 'unavailable' && 'text-rose-500',
            )} />
            <span className="font-medium">{targetName}</span>
            <span className="text-zinc-400">{statusLabels[status]}</span>
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                <Cpu size={10} /> {tier}
            </span>
        </div>
    );
};
