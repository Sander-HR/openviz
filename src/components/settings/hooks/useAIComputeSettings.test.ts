import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/store/useStore';
import { useAIComputeSettings } from './useAIComputeSettings';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

describe('useAIComputeSettings (openai-image protocol)', () => {
    beforeEach(() => {
        useStore.setState((state) => ({
            ...state,
            computeSettings: {
                ...state.computeSettings,
                protocol: 'openai-image',
                imageApiEndpoint: 'https://img.example.com/v1',
                imageApiKey: '',
                imageApiKeyless: false,
                imageApiModel: 'flux-1',
            },
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('persists settings before testing through the proxy so the server-side key is used', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/api/ai/settings') && init?.method === 'PATCH') return jsonResponse(200, { settings: { hasImageApiKey: false } });
            if (url.includes('/api/ai/settings')) return jsonResponse(200, { settings: null });
            if (url.includes('/api/ai/proxy/v1/models')) return jsonResponse(200, { data: [{ id: 'flux-1' }] });
            return jsonResponse(404, {});
        });
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useAIComputeSettings());
        await act(async () => {
            await result.current.testConnection();
        });

        const calls = fetchMock.mock.calls.map((call) => ({
            url: String(call[0]),
            method: (call[1] as RequestInit | undefined)?.method ?? 'GET',
        }));
        const patchIndex = calls.findIndex((entry) => entry.url.includes('/api/ai/settings') && entry.method === 'PATCH');
        const probeIndex = calls.findIndex((entry) => entry.url.includes('/api/ai/proxy/v1/models'));
        expect(patchIndex).toBeGreaterThan(-1);
        expect(probeIndex).toBeGreaterThan(-1);
        // The test must run against what the server stores, not stale client state.
        expect(patchIndex).toBeLessThan(probeIndex);
        expect(result.current.status).toBe('connected');
    });

    it('reports unavailable when the proxied endpoint rejects the stored key', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/api/ai/settings') && init?.method === 'PATCH') return jsonResponse(200, { settings: { hasImageApiKey: true } });
            if (url.includes('/api/ai/settings')) return jsonResponse(200, { settings: null });
            if (url.includes('/api/ai/proxy/v1/models')) return jsonResponse(401, { error: 'invalid api key' });
            return jsonResponse(404, {});
        });
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useAIComputeSettings());
        await act(async () => {
            await result.current.testConnection();
        });

        expect(result.current.status).toBe('unavailable');
    });
});
