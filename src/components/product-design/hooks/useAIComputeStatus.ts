import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import {
    comfyConnectionManager,
    type ComfyEndpointState,
} from '@/services/ai/comfyConnectionManager';
import { imageApiProxyFetcher, PROXY_API_KEY } from '@/services/ai/proxyFetcher';
import { createOpenAIImageTarget } from '@/services/ai/targets/openAIImageTarget';
import { imageApiQueue } from '@/services/renderService';
import {
    resolveComputeEndpoint,
    type ComfyQueueInfo,
} from '@/services/ai/computeStatusService';
import {
    probeEndpointCapabilities,
    type EndpointCapabilityProbe,
} from '@/services/ai/targets/openApiDiscovery';
import type {
    ComfyDeviceCapability,
    ExecutionTargetProtocol,
    ExecutionTargetStatus,
} from '@/types/executionTarget.types';

export interface AIComputeQueueState {
    active: number;
    queued: number;
    concurrency: number;
}

export interface AIComputeStatus {
    protocol: ExecutionTargetProtocol;
    endpoint: string;
    displayEndpoint: string;
    status: ExecutionTargetStatus;
    message?: string;
    selectedModel: string;
    models: string[];
    devices: ComfyDeviceCapability[];
    /** Client-side OpenViz queue for the image API (this session only). */
    queue: AIComputeQueueState | null;
    /** Server-side ComfyUI queue when the endpoint exposes GET /queue. */
    comfyQueue: ComfyQueueInfo | null;
    /** Optional OpenAPI-discovered capabilities for image API endpoints. */
    endpointProbe: EndpointCapabilityProbe | null;
    lastCheckedAt: number | null;
    isRefreshing: boolean;
}

/** Project a shared manager snapshot onto the popup view model. */
function applyComfyState(prev: AIComputeStatus, state: ComfyEndpointState): AIComputeStatus {
    if (prev.protocol !== 'comfyui') return prev;
    return {
        ...prev,
        status: state.status === 'ready' ? 'ready' : 'unavailable',
        message: state.status === 'ready' ? undefined : state.message,
        devices: state.capabilities?.devices ?? [],
        comfyQueue: state.queue,
        lastCheckedAt: state.lastCheckedAt ?? prev.lastCheckedAt,
    };
}

function initialStatus(protocol: ExecutionTargetProtocol, displayEndpoint: string): AIComputeStatus {
    return {
        protocol,
        endpoint: '',
        displayEndpoint,
        status: 'checking',
        selectedModel: '',
        models: [],
        devices: [],
        queue: null,
        comfyQueue: null,
        endpointProbe: null,
        lastCheckedAt: null,
        isRefreshing: false,
    };
}

/**
 * Live compute status for the workbench Compute popup. Derives the active
 * endpoint from persisted AI settings, probes it through the existing target
 * adapters, and tracks the client-side generation queue. All fetch/effect
 * logic lives here; components only render the returned view model.
 */
export function useAIComputeStatus(open: boolean) {
    const computeSettings = useStore((state) => state.computeSettings);
    const resolved = resolveComputeEndpoint(computeSettings);

    const [status, setStatus] = useState<AIComputeStatus>(() =>
        initialStatus(resolved.protocol, resolved.displayEndpoint),
    );
    const sequenceRef = useRef(0);
    const probeCacheRef = useRef(new Map<string, EndpointCapabilityProbe>());

    const runCheck = useCallback(async () => {
        const seq = ++sequenceRef.current;
        setStatus((prev) => ({ ...prev, isRefreshing: true }));

        try {
            if (resolved.protocol === 'openai-image') {
                if (!resolved.endpoint) {
                    if (seq === sequenceRef.current) {
                        setStatus((prev) => ({
                            ...prev,
                            status: 'unavailable',
                            message: 'No image API endpoint configured.',
                            models: [],
                            devices: [],
                            selectedModel: '',
                            lastCheckedAt: Date.now(),
                        }));
                    }
                    return;
                }

                const target = createOpenAIImageTarget({
                    id: 'image-api',
                    endpoint: resolved.endpoint,
                    model: computeSettings.imageApiModel ?? '',
                    apiKey: computeSettings.imageApiKey || PROXY_API_KEY,
                    keyless: computeSettings.imageApiKeyless ?? false,
                    fetcher: imageApiProxyFetcher,
                });
                const health = await target.health();

                // Optional OpenAPI discovery — never blocks or fails the check.
                let probe = probeCacheRef.current.get(resolved.endpoint) ?? null;
                if (!probe) {
                    probe = await probeEndpointCapabilities(resolved.endpoint, {
                        apiKey: computeSettings.imageApiKey || PROXY_API_KEY,
                        keyless: computeSettings.imageApiKeyless ?? false,
                        fetcher: imageApiProxyFetcher,
                    });
                    probeCacheRef.current.set(resolved.endpoint, probe);
                }

                if (seq !== sequenceRef.current) return;
                setStatus((prev) => ({
                    ...prev,
                    protocol: 'openai-image',
                    endpoint: resolved.endpoint,
                    displayEndpoint: resolved.displayEndpoint,
                    status: health.status === 'ready' ? 'ready' : health.status,
                    message: health.status === 'ready' ? undefined : health.message,
                    selectedModel: computeSettings.imageApiModel ?? '',
                    models: health.capabilities?.availableModels ?? [],
                    devices: [],
                    endpointProbe: probe,
                    lastCheckedAt: Date.now(),
                }));
            } else {
                // Shared manager: one probe, and /object_info + /queue only
                // fire after a successful reachability check.
                const state = await comfyConnectionManager.check(resolved.endpoint);
                if (seq !== sequenceRef.current) return;
                setStatus((prev) => ({
                    ...prev,
                    protocol: 'comfyui',
                    endpoint: resolved.endpoint,
                    displayEndpoint: resolved.displayEndpoint,
                    status: state.status === 'ready' ? 'ready' : 'unavailable',
                    message: state.status === 'ready' ? undefined : state.message,
                    selectedModel: '',
                    models: [],
                    devices: state.capabilities?.devices ?? [],
                    comfyQueue: state.queue,
                    endpointProbe: null,
                    lastCheckedAt: state.lastCheckedAt ?? Date.now(),
                }));
            }
        } catch {
            if (seq !== sequenceRef.current) return;
            setStatus((prev) => ({
                ...prev,
                status: 'unavailable',
                message: 'Unable to reach the compute endpoint.',
                lastCheckedAt: Date.now(),
            }));
        } finally {
            if (seq === sequenceRef.current) {
                setStatus((prev) => ({ ...prev, isRefreshing: false }));
            }
        }
    }, [resolved.protocol, resolved.endpoint, resolved.displayEndpoint, computeSettings.imageApiModel, computeSettings.imageApiKey, computeSettings.imageApiKeyless]);

    // Re-check whenever the active endpoint or credentials change. The first
    // probe is deferred to idle time (Sprint 4): ComputePopover mounts with the
    // workbench on every project open, and probing an external AI endpoint in
    // that window competes with canvas setup for network + main thread.
    useEffect(() => {
        setStatus((prev) => ({
            ...initialStatus(resolved.protocol, resolved.displayEndpoint),
            lastCheckedAt: prev.lastCheckedAt,
        }));
        const run = () => void runCheck();
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(run, { timeout: 8000 });
            return () => window.cancelIdleCallback(idleId);
        }
        const timerId = setTimeout(run, 500);
        return () => clearTimeout(timerId);
    }, [resolved.protocol, resolved.endpoint, resolved.displayEndpoint, computeSettings.imageApiKey, computeSettings.imageApiKeyless, runCheck]);

    // Refresh on open; while the popup is open the shared manager's poll
    // timer keeps the ComfyUI endpoint fresh (no per-popup interval needed).
    useEffect(() => {
        if (!open) return;
        void runCheck();
    }, [open, runCheck]);

    // Watch the ComfyUI endpoint while the popup is open so the shared poll
    // timer refreshes it, and listen for background probe results.
    useEffect(() => {
        if (resolved.protocol !== 'comfyui' || !resolved.endpoint) return;
        const unsubscribe = comfyConnectionManager.subscribe((state) => {
            if (state.endpoint !== resolved.endpoint) return;
            setStatus((prev) => applyComfyState(prev, state));
        });
        if (open) {
            comfyConnectionManager.watch(resolved.endpoint);
        }
        return () => {
            unsubscribe();
            if (open) comfyConnectionManager.unwatch(resolved.endpoint);
        };
    }, [open, resolved.protocol, resolved.endpoint]);

    // Track the client-side image API queue for the active endpoint.
    useEffect(() => {
        if (resolved.protocol !== 'openai-image' || !resolved.endpoint) {
            setStatus((prev) => (prev.queue === null ? prev : { ...prev, queue: null }));
            return;
        }
        const apply = (snapshot: { endpoint: string; active: number; queued: number; concurrency: number }) => {
            if (snapshot.endpoint !== resolved.endpoint) return;
            setStatus((prev) => ({
                ...prev,
                queue: { active: snapshot.active, queued: snapshot.queued, concurrency: snapshot.concurrency },
            }));
        };
        apply(imageApiQueue.getSnapshot(resolved.endpoint));
        return imageApiQueue.subscribe(apply);
    }, [resolved.protocol, resolved.endpoint]);

    const refresh = useCallback(() => {
        void runCheck();
    }, [runCheck]);

    return { ...status, refresh };
}
