import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProxyFetcher, PROXY_API_KEY } from './proxyFetcher';

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200 });
}

describe('createProxyFetcher', () => {
    const endpoint = 'https://img.example.com/v1';
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('routes endpoint-host URLs through /api/ai/proxy and strips Authorization', async () => {
        const proxyFetch = createProxyFetcher(() => endpoint);
        await proxyFetch(`${endpoint}/models`, { headers: { Authorization: `Bearer ${PROXY_API_KEY}` } });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        // The proxy path is relative to the endpoint's HOST root, so /v1 stays in the path.
        expect(url).toBe('/api/ai/proxy/v1/models');
        expect(new Headers(init.headers).get('authorization')).toBeNull();
    });

    it('proxies host-root-level native routes (no /vN prefix) with the key', async () => {
        const proxyFetch = createProxyFetcher(() => endpoint);
        await proxyFetch('https://img.example.com/api/inference/images/generate', { method: 'POST', headers: { Authorization: `Bearer ${PROXY_API_KEY}` } });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('/api/ai/proxy/api/inference/images/generate');
        expect(new Headers(init.headers).get('authorization')).toBeNull();
    });

    it('preserves query strings when proxying', async () => {
        const proxyFetch = createProxyFetcher(() => endpoint);
        await proxyFetch(`${endpoint}/models?limit=5`);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/proxy/v1/models?limit=5');
    });

    it('normalizes trailing slashes on the configured endpoint', async () => {
        const proxyFetch = createProxyFetcher(() => 'https://img.example.com/v1/');
        await proxyFetch(`${endpoint}/models`);
        expect(fetchMock.mock.calls[0][0]).toBe('/api/ai/proxy/v1/models');
    });

    it('fetches foreign hosts directly', async () => {
        const proxyFetch = createProxyFetcher(() => endpoint);
        await proxyFetch('https://cdn.example.com/img.png');
        expect(fetchMock.mock.calls[0][0]).toBe('https://cdn.example.com/img.png');
    });

    it('passes data: URLs through unchanged', async () => {
        const proxyFetch = createProxyFetcher(() => endpoint);
        await proxyFetch('data:image/png;base64,abc');
        expect(fetchMock.mock.calls[0][0]).toBe('data:image/png;base64,abc');
    });

    it('passes relative ComfyUI paths through unchanged', async () => {
        const proxyFetch = createProxyFetcher(() => endpoint);
        await proxyFetch('/comfy-api/queue');
        expect(fetchMock.mock.calls[0][0]).toBe('/comfy-api/queue');
    });

    it('falls back to direct fetch when no endpoint is configured', async () => {
        const proxyFetch = createProxyFetcher(() => '');
        await proxyFetch(`${endpoint}/models`);
        expect(fetchMock.mock.calls[0][0]).toBe(`${endpoint}/models`);
    });
});
