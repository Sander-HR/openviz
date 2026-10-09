import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComputeSettings, TargetCapabilities } from '@/types/executionTarget.types';
import { comfyConnectionManager } from '@/services/ai/comfyConnectionManager';
import { imageApiProxyFetcher, PROXY_API_KEY } from '@/services/ai/proxyFetcher';
import { createOpenAIImageTarget } from '@/services/ai/targets/openAIImageTarget';
import { useStore } from '@/store/useStore';

type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'unavailable';

export function useAIComputeSettings() {
    const settings = useStore((state) => state.computeSettings);
    const setLocalEndpoint = useStore((state) => state.setLocalComfyEndpoint);
    const setHostedEndpoint = useStore((state) => state.setHostedComfyEndpoint);
    const setTargetKind = useStore((state) => state.setExecutionTargetKind);
    const setProtocol = useStore((state) => state.setExecutionTargetProtocol);
    const setImageApiEndpoint = useStore((state) => state.setImageApiEndpoint);
    const setImageApiKey = useStore((state) => state.setImageApiKey);
    const setImageApiKeyless = useStore((state) => state.setImageApiKeyless);
    const setImageApiModels = useStore((state) => state.setImageApiModels);
    const setImageApiModel = useStore((state) => state.setImageApiModel);
    const setImageApiSize = useStore((state) => state.setImageApiSize);
    const setEndpointConcurrency = useStore((state) => state.setEndpointConcurrency);
    const setBenchmarkGateEnabled = useStore((state) => state.setBenchmarkGateEnabled);
    const applyComputeSettings = useStore((state) => state.applyComputeSettings);
    const setPreference = useStore((state) => state.setComputePreference);
    // Persisted IndexedDB snapshots can predate the image API settings. Keep
    // hydration backward-compatible instead of passing undefined to controls.
    const protocol = settings.protocol ?? 'comfyui';
    const imageApiEndpoint = settings.imageApiEndpoint ?? '';
    const imageApiKey = settings.imageApiKey ?? '';
    const imageApiKeyless = settings.imageApiKeyless ?? false;
    const imageApiModels = settings.imageApiModels ?? [];
    const imageApiModel = settings.imageApiModel ?? '';
    const imageApiSize = settings.imageApiSize ?? '1024x1024';
    const endpointConcurrency = Math.max(1, Math.min(3, settings.endpointConcurrency ?? 2));
    const benchmarkGateEnabled = settings.benchmarkGateEnabled ?? false;
    const endpoint = settings.targetKind === 'hosted' ? (settings.hostedEndpoint ?? '') : (settings.localEndpoint ?? '');
    const setEndpoint = settings.targetKind === 'hosted' ? setHostedEndpoint : setLocalEndpoint;
    const [status, setStatus] = useState<ConnectionStatus>('idle');
    const [capabilities, setCapabilities] = useState<TargetCapabilities | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
    const [hasStoredImageApiKey, setHasStoredImageApiKey] = useState(false);
    const hydratedFromServer = useRef(false);

    useEffect(() => {
        let cancelled = false;
        setSyncStatus('loading');
        fetch('/api/ai/settings')
            .then(async (response) => {
                if (!response.ok) throw new Error('Unable to load AI settings.');
                return response.json() as Promise<{ settings: { targetKind: ComputeSettings['targetKind']; protocol: ComputeSettings['protocol']; preference: ComputeSettings['preference']; localEndpoint: string; hostedEndpoint: string; imageApiEndpoint: string; imageApiKeyless: boolean; imageApiModel: string; imageApiSize: string; endpointConcurrency: number; hasImageApiKey: boolean } | null }>;
            })
            .then((payload) => {
                if (cancelled) return;
                if (payload.settings) {
                    applyComputeSettings(payload.settings);
                    setHasStoredImageApiKey(Boolean(payload.settings.hasImageApiKey));
                    if (!payload.settings.hasImageApiKey) setImageApiKey('');
                }
                hydratedFromServer.current = true;
                setSyncStatus('saved');
            })
            .catch(() => {
                if (!cancelled) setSyncStatus('error');
            });
        return () => { cancelled = true; };
    }, [applyComputeSettings, setImageApiKey]);

    const saveSettings = useCallback(async (): Promise<void> => {
        setSyncStatus('saving');
        try {
            const response = await fetch('/api/ai/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetKind: settings.targetKind,
                    protocol,
                    preference: settings.preference,
                    localEndpoint: settings.localEndpoint,
                    hostedEndpoint: settings.hostedEndpoint,
                    imageApiEndpoint,
                    imageApiKey: imageApiKey || undefined,
                    imageApiKeyless,
                    imageApiModel,
                    imageApiSize,
                    endpointConcurrency,
                }),
            });
            if (!response.ok) throw new Error('Unable to save AI settings.');
            const payload = await response.json() as { settings: { hasImageApiKey?: boolean } | null };
            setHasStoredImageApiKey(Boolean(payload.settings?.hasImageApiKey));
            setSyncStatus('saved');
        } catch {
            setSyncStatus('error');
        }
    }, [endpointConcurrency, imageApiEndpoint, imageApiKey, imageApiKeyless, imageApiModel, imageApiSize, protocol, settings.hostedEndpoint, settings.localEndpoint, settings.preference, settings.targetKind]);

    useEffect(() => {
        if (!hydratedFromServer.current) return;
        const timer = window.setTimeout(() => {
            void saveSettings();
        }, 700);
        return () => window.clearTimeout(timer);
    }, [saveSettings]);

    // Gated by the shared manager: /object_info only runs after a successful
    // reachability probe, so a down endpoint costs exactly one request.
    const refreshCapabilities = useCallback(async () => {
        const state = await comfyConnectionManager.check(endpoint, { force: true });
        setCapabilities(state.capabilities);
    }, [endpoint]);

    const testConnection = useCallback(async () => {
        setStatus('checking');
        try {
            if (protocol === 'openai-image') {
                // Persist first: the proxy route authenticates against what the
                // server stores, so a freshly typed endpoint/key is tested as-is.
                await saveSettings();
                const target = createOpenAIImageTarget({
                    id: 'image-api',
                    endpoint: imageApiEndpoint,
                    model: imageApiModel,
                    apiKey: imageApiKey || PROXY_API_KEY,
                    keyless: imageApiKeyless,
                    fetcher: imageApiProxyFetcher,
                });
                const health = await target.health();
                setImageApiModels(health.capabilities?.availableModels ?? []);
                setStatus(health.status === 'ready' ? 'connected' : 'unavailable');
                return;
            }
            const state = await comfyConnectionManager.check(endpoint, { force: true });
            setStatus(state.status === 'ready' ? 'connected' : 'unavailable');
        } catch {
            setStatus('unavailable');
        }
    }, [endpoint, imageApiEndpoint, imageApiKey, imageApiKeyless, imageApiModel, protocol, saveSettings, setImageApiModels]);

    // Live ComfyUI status via the shared connection manager: one probe per
    // failure TTL while down (the old 10s retry loop), and background refresh
    // while up. No per-component interval anymore.
    useEffect(() => {
        if (protocol !== 'comfyui' || !endpoint) return;
        const unsubscribe = comfyConnectionManager.subscribe((state) => {
            if (state.endpoint !== endpoint) return;
            setStatus(state.status === 'ready' ? 'connected' : 'unavailable');
        });
        comfyConnectionManager.watch(endpoint);
        void comfyConnectionManager.check(endpoint);
        return () => {
            unsubscribe();
            comfyConnectionManager.unwatch(endpoint);
        };
    }, [protocol, endpoint]);

    return {
        endpoint,
        setEndpoint,
        targetKind: settings.targetKind,
        setTargetKind,
        protocol,
        setProtocol,
        imageApiEndpoint,
        setImageApiEndpoint,
        imageApiKey,
        setImageApiKey,
        imageApiKeyless,
        setImageApiKeyless,
        imageApiModels,
        setImageApiModels,
        imageApiModel,
        setImageApiModel,
        imageApiSize,
        setImageApiSize,
        endpointConcurrency,
        setEndpointConcurrency,
        benchmarkGateEnabled,
        setBenchmarkGateEnabled,
        status,
        preference: settings.preference,
        setPreference,
        capabilities,
        refreshCapabilities,
        testConnection,
        saveSettings,
        syncStatus,
        hasStoredImageApiKey,
    };
}
