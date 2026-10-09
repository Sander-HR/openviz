import { act, renderHook, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComputeSettings } from '@/types/executionTarget.types';

const { storeState, notifyStore, subscribeStore, queueState } = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    return {
        storeState: {
            computeSettings: {} as ComputeSettings,
        },
        notifyStore: () => listeners.forEach((listener) => listener()),
        subscribeStore: (listener: () => void) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        queueState: {
            snapshot: { endpoint: '', active: 0, queued: 0, concurrency: 2 },
            listeners: [] as Array<(snapshot: { endpoint: string; active: number; queued: number; concurrency: number }) => void>,
        },
    };
});

vi.mock('@/store/useStore', () => ({
    // The proxy fetcher resolves the active endpoint via useStore.getState() at call time.
    useStore: Object.assign(
        (selector?: (state: typeof storeState) => unknown) =>
            useSyncExternalStore(
                subscribeStore,
                () => (selector ? selector(storeState) : storeState),
            ),
        { getState: () => storeState },
    ),
}));

vi.mock('@/services/renderService', () => ({
    renderService: { checkConnection: vi.fn().mockResolvedValue(true) },
    imageApiQueue: {
        getSnapshot: (_endpoint: string) => queueState.snapshot,
        subscribe: (listener: (snapshot: { endpoint: string; active: number; queued: number; concurrency: number }) => void) => {
            queueState.listeners.push(listener);
            return () => {
                queueState.listeners = queueState.listeners.filter((item) => item !== listener);
            };
        },
    },
}));

import { useAIComputeStatus } from './useAIComputeStatus';

function makeSettings(overrides: Partial<ComputeSettings> = {}): ComputeSettings {
    return {
        targetKind: 'local',
        protocol: 'comfyui',
        preference: 'automatic',
        localEndpoint: '/comfy-api',
        hostedEndpoint: '',
        imageApiEndpoint: '',
        imageApiKey: '',
        imageApiKeyless: false,
        imageApiModels: [],
        imageApiModel: '',
        imageApiSize: '1024x1024',
        endpointConcurrency: 2,
        benchmarkGateEnabled: true,
        ...overrides,
    };
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
    vi.unstubAllGlobals();
    queueState.snapshot = { endpoint: '', active: 0, queued: 0, concurrency: 2 };
    queueState.listeners = [];
});

describe('useAIComputeStatus', () => {
    it('re-checks when the configured endpoint changes', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
        });

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(200, { data: [{ id: 'model-a' }] });
            return jsonResponse(404, {});
        });
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useAIComputeStatus(false));
        await waitFor(() => expect(result.current.status).toBe('ready'));
        const callsAfterFirst = fetchMock.mock.calls.length;

        act(() => {
            storeState.computeSettings = makeSettings({
                protocol: 'openai-image',
                imageApiEndpoint: 'http://localhost:8002/v1',
                imageApiKeyless: true,
            });
            notifyStore();
        });
        await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst));
        await waitFor(() => expect(result.current.endpoint).toBe('http://localhost:8002/v1'));
    });

    it('ignores stale responses when a newer check starts', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
        });

        let resolveFirst: ((response: Response) => void) | undefined;
        const firstCall = new Promise<Response>((resolve) => {
            resolveFirst = resolve;
        });
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (!url.endsWith('/models')) return jsonResponse(404, {});
            if (fetchMock.mock.calls.length === 1) return firstCall;
            return jsonResponse(200, { data: [{ id: 'fresh-model' }] });
        });
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useAIComputeStatus(false));
        await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1));

        // Start a second check while the first is still in flight.
        act(() => {
            storeState.computeSettings = makeSettings({
                protocol: 'openai-image',
                imageApiEndpoint: 'http://localhost:8001/v1',
                imageApiKeyless: true,
                imageApiModel: 'fresh-model',
            });
            notifyStore();
        });

        await waitFor(() => expect(result.current.status).toBe('ready'));
        act(() => {
            resolveFirst?.(jsonResponse(200, { data: [{ id: 'stale-model' }] }));
        });

        // The stale response must not overwrite the fresh result.
        await act(async () => undefined);
        expect(result.current.models).toEqual(['fresh-model']);
    });

    it('tracks the client queue only for the active endpoint', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
        });

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(200, { data: [{ id: 'model-a' }] });
            return jsonResponse(404, {});
        }));

        const { result } = renderHook(() => useAIComputeStatus(false));
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(queueState.listeners.length).toBe(1);

        // A snapshot for a different endpoint must be ignored.
        act(() => {
            queueState.listeners.forEach((listener) => listener({ endpoint: 'http://other:9000/v1', active: 5, queued: 5, concurrency: 2 }));
        });
        expect(result.current.queue).toBeNull();

        // A matching snapshot updates the view model.
        act(() => {
            queueState.listeners.forEach((listener) => listener({ endpoint: 'http://localhost:8001/v1', active: 1, queued: 2, concurrency: 2 }));
        });
        expect(result.current.queue).toEqual({ active: 1, queued: 2, concurrency: 2 });
    });

    it('reports unavailable with a hint when no image API endpoint is configured', async () => {
        storeState.computeSettings = makeSettings({ protocol: 'openai-image' });

        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useAIComputeStatus(false));
        await waitFor(() => expect(result.current.status).toBe('unavailable'));
        expect(result.current.message).toBe('No image API endpoint configured.');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
