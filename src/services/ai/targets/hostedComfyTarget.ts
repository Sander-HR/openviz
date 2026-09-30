import type { ExecutionTargetAdapter } from '@/types/executionTarget.types';
import { createLocalComfyTarget } from './localComfyTarget';

type Fetcher = typeof fetch;

interface HostedComfyTargetOptions {
    id: string;
    endpoint: string;
    token: string;
    fetcher?: Fetcher;
}

export function createHostedComfyTarget(options: HostedComfyTargetOptions): ExecutionTargetAdapter {
    return createLocalComfyTarget({
        id: options.id,
        endpoint: options.endpoint,
        fetcher: options.fetcher,
        headers: { Authorization: `Bearer ${options.token}` },
    });
}
