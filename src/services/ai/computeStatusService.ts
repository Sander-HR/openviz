import type { ComputeSettings, ExecutionTargetProtocol } from '@/types/executionTarget.types';

type Fetcher = typeof fetch;

export interface ResolvedComputeEndpoint {
    protocol: ExecutionTargetProtocol;
    /** Normalized endpoint used for queue scoping and requests. */
    endpoint: string;
    /** Copy-safe label for the UI (falls back to a hint when unconfigured). */
    displayEndpoint: string;
}

export interface ComfyQueueInfo {
    active: number;
    queued: number;
}

/** T031 (spec edge case: model/backend unavailable): whether an image backend is configured. */
export interface ImageBackendReadiness {
    ready: boolean;
    reason?: string;
}

/** Derive readiness from persisted compute settings (no network probe). */
export function isImageBackendReady(settings: ComputeSettings): ImageBackendReadiness {
    if (settings.protocol === 'openai-image') {
        const endpoint = normalizeImageApiEndpoint(settings.imageApiEndpoint ?? '');
        if (!endpoint) return { ready: false, reason: 'No image API configured' };
        return { ready: true };
    }
    // ComfyUI always has a default local endpoint; live connection health is handled separately.
    return { ready: true };
}

/** Strip whitespace and trailing slashes so queue keys and URLs stay consistent. */
export function normalizeImageApiEndpoint(endpoint: string): string {
    return endpoint.trim().replace(/\/+$/, '');
}

/** Resolve the active compute endpoint from persisted AI settings. */
export function resolveComputeEndpoint(settings: ComputeSettings): ResolvedComputeEndpoint {
    if (settings.protocol === 'openai-image') {
        const endpoint = normalizeImageApiEndpoint(settings.imageApiEndpoint ?? '');
        return {
            protocol: 'openai-image',
            endpoint,
            displayEndpoint: endpoint || 'No image API configured',
        };
    }
    const endpoint = (settings.localEndpoint ?? '').trim() || '/comfy-api';
    return { protocol: 'comfyui', endpoint, displayEndpoint: endpoint };
}

/**
 * Best-effort read of ComfyUI's server-side queue (GET /queue). Older builds
 * do not expose the route, so callers must treat `null` as "not available"
 * rather than an endpoint failure.
 */
export async function fetchComfyQueueInfo(endpoint: string, fetcher: Fetcher = fetch): Promise<ComfyQueueInfo | null> {
    try {
        const response = await fetcher(`${normalizeImageApiEndpoint(endpoint)}/queue`, { signal: AbortSignal.timeout(3000) });
        if (!response.ok) return null;
        const body = (await response.json()) as { queue_running?: unknown[]; queue_pending?: unknown[] };
        return {
            active: Array.isArray(body.queue_running) ? body.queue_running.length : 0,
            queued: Array.isArray(body.queue_pending) ? body.queue_pending.length : 0,
        };
    } catch {
        return null;
    }
}
