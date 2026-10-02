import { normalizeComfyCapabilities } from './targets/comfyCapabilitiesService';
import { fetchComfyQueueInfo, normalizeImageApiEndpoint, type ComfyQueueInfo } from './computeStatusService';
import type { TargetCapabilities } from '@/types/executionTarget.types';

export type ComfyConnectionStatus = 'checking' | 'ready' | 'unavailable';

/**
 * Shared snapshot of one ComfyUI endpoint. `capabilities` and `queue` are only
 * populated after a successful probe, so callers never fan out follow-up
 * requests against an unreachable endpoint.
 */
export interface ComfyEndpointState {
    endpoint: string;
    status: ComfyConnectionStatus;
    message?: string;
    capabilities: TargetCapabilities | null;
    queue: ComfyQueueInfo | null;
    lastCheckedAt: number | null;
}

export interface ComfyConnectionManagerOptions {
    fetcher?: typeof fetch;
    now?: () => number;
    /** Timeout for the reachability probe (GET /system_stats). */
    probeTimeoutMs?: number;
    /** How long a failed result is trusted before re-probing. */
    failureTtlMs?: number;
    /** How long a successful result is trusted before refreshing. */
    successTtlMs?: number;
    /** Tick size of the shared poll timer that drives watched endpoints. */
    pollIntervalMs?: number;
}

export interface ComfyConnectionManager {
    /** Synchronous view of the latest cached state ('checking' when unknown). */
    getState(endpoint: string): ComfyEndpointState;
    /**
     * TTL-aware, coalesced check. Concurrent calls share one in-flight probe;
     * fresh cache hits perform no network I/O. `force` bypasses the TTL.
     */
    check(endpoint: string, options?: { force?: boolean }): Promise<ComfyEndpointState>;
    /** Register an endpoint for shared-interval refresh (no-op if already watched). */
    watch(endpoint: string): void;
    unwatch(endpoint: string): void;
    subscribe(listener: (state: ComfyEndpointState) => void): () => void;
    /** Drop all cache, watchers, listeners, and the poll timer (test hook). */
    reset(): void;
}

interface CacheEntry {
    /** Absent while the first probe for this endpoint is in flight. */
    state?: ComfyEndpointState;
    expiresAt?: number;
    inflight?: Promise<ComfyEndpointState>;
}

const DEFAULTS = {
    probeTimeoutMs: 2000,
    failureTtlMs: 10_000,
    successTtlMs: 30_000,
    pollIntervalMs: 10_000,
};

async function fetchWithTimeout(
    fetcher: typeof fetch,
    resource: string,
    timeoutMs: number,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetcher(resource, { signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function initialState(endpoint: string): ComfyEndpointState {
    return { endpoint, status: 'checking', capabilities: null, queue: null, lastCheckedAt: null };
}

export function createComfyConnectionManager(options: ComfyConnectionManagerOptions = {}): ComfyConnectionManager {
    // Resolve the global lazily per call so test stubs installed after module
    // import (vi.stubGlobal) are picked up.
    const fetcher = options.fetcher ?? ((resource: RequestInfo | URL, init?: RequestInit) => fetch(resource, init));
    // Lazy so vi.useFakeTimers() (which swaps the global Date after import)
    // is honored.
    const now = options.now ?? (() => Date.now());
    const probeTimeoutMs = options.probeTimeoutMs ?? DEFAULTS.probeTimeoutMs;
    const failureTtlMs = options.failureTtlMs ?? DEFAULTS.failureTtlMs;
    const successTtlMs = options.successTtlMs ?? DEFAULTS.successTtlMs;
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULTS.pollIntervalMs;

    const entries = new Map<string, CacheEntry>();
    const watchers = new Set<string>();
    const listeners = new Set<(state: ComfyEndpointState) => void>();
    let timer: ReturnType<typeof setInterval> | null = null;

    function notify(state: ComfyEndpointState): void {
        listeners.forEach((listener) => listener(state));
    }

    async function probeStats(endpoint: string): Promise<unknown> {
        const response = await fetchWithTimeout(fetcher, `${endpoint}/system_stats`, probeTimeoutMs);
        if (!response.ok) throw new Error(`ComfyUI probe failed (HTTP ${response.status}).`);
        return response.json();
    }

    async function fetchObjectInfo(endpoint: string): Promise<unknown | null> {
        try {
            const response = await fetchWithTimeout(fetcher, `${endpoint}/object_info`, 5000);
            if (!response.ok) return null;
            return await response.json();
        } catch {
            return null;
        }
    }

    async function runCheck(endpoint: string): Promise<ComfyEndpointState> {
        let state: ComfyEndpointState;
        try {
            const stats = await probeStats(endpoint);
            // Dependent calls only happen after a successful probe.
            const [objectInfo, queue] = await Promise.all([
                fetchObjectInfo(endpoint),
                fetchComfyQueueInfo(endpoint, fetcher),
            ]);
            state = {
                endpoint,
                status: 'ready',
                capabilities: objectInfo === null ? null : normalizeComfyCapabilities(stats, objectInfo, now()),
                queue,
                lastCheckedAt: now(),
            };
        } catch {
            state = {
                endpoint,
                status: 'unavailable',
                message: 'Unable to reach the compute endpoint.',
                capabilities: null,
                queue: null,
                lastCheckedAt: now(),
            };
        }

        entries.set(endpoint, {
            state,
            expiresAt: now() + (state.status === 'ready' ? successTtlMs : failureTtlMs),
        });
        notify(state);
        return state;
    }

    function check(endpoint: string, checkOptions?: { force?: boolean }): Promise<ComfyEndpointState> {
        const normalized = normalizeImageApiEndpoint(endpoint);
        if (!normalized) {
            const state: ComfyEndpointState = {
                endpoint: '',
                status: 'unavailable',
                message: 'No endpoint configured.',
                capabilities: null,
                queue: null,
                lastCheckedAt: now(),
            };
            return Promise.resolve(state);
        }

        const force = checkOptions?.force ?? false;
        const existing = entries.get(normalized);
        if (!force && existing?.inflight) return existing.inflight;
        if (
            !force
            && existing?.state
            && existing.expiresAt !== undefined
            && now() < existing.expiresAt
        ) {
            return Promise.resolve(existing.state);
        }

        pruneExpired();
        const entry: CacheEntry = {};
        entries.set(normalized, entry);
        entry.inflight = runCheck(normalized).finally(() => {
            const current = entries.get(normalized);
            if (current === entry) current.inflight = undefined;
        });
        return entry.inflight;
    }

    function pruneExpired(): void {
        if (entries.size <= 10) return;
        for (const [endpoint, entry] of entries) {
            if (
                !watchers.has(endpoint)
                && entry.expiresAt !== undefined
                && now() >= entry.expiresAt
                && !entry.inflight
            ) {
                entries.delete(endpoint);
            }
        }
    }

    function getState(endpoint: string): ComfyEndpointState {
        const normalized = normalizeImageApiEndpoint(endpoint);
        return entries.get(normalized)?.state ?? initialState(normalized);
    }

    function tick(): void {
        for (const endpoint of watchers) {
            void check(endpoint).catch(() => undefined);
        }
    }

    function ensureTimer(): void {
        if (timer === null && watchers.size > 0) {
            timer = setInterval(tick, pollIntervalMs);
        }
    }

    function stopTimerIfIdle(): void {
        if (watchers.size === 0 && timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }

    return {
        getState,
        check,
        watch(endpoint) {
            const normalized = normalizeImageApiEndpoint(endpoint);
            if (!normalized) return;
            watchers.add(normalized);
            ensureTimer();
        },
        unwatch(endpoint) {
            watchers.delete(normalizeImageApiEndpoint(endpoint));
            stopTimerIfIdle();
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        reset() {
            entries.clear();
            watchers.clear();
            listeners.clear();
            if (timer !== null) {
                clearInterval(timer);
                timer = null;
            }
        },
    };
}

/**
 * Shared browser-side manager. Every ComfyUI status/capability/queue check in
 * the app goes through this instance so an unreachable endpoint costs at most
 * one probe per failure TTL, no matter how many UIs are mounted.
 */
export const comfyConnectionManager: ComfyConnectionManager = createComfyConnectionManager();
