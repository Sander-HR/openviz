import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const getSettingsMock = vi.fn();
const getSecretMock = vi.fn();
let upstreamFetch: ReturnType<typeof vi.fn>;

vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock('@/services/ai/databaseAISettingsRepository', () => ({
    createDatabaseAISettingsRepository: () => ({
        get: (...args: unknown[]) => getSettingsMock(...args),
        getSecret: (...args: unknown[]) => getSecretMock(...args),
    }),
}));

import { GET, POST } from './route';

type Context = { params: Promise<{ path: string[] }> };

function call(handler: (request: Request, context: Context) => Promise<Response>, url: string, init?: RequestInit, path: string[] = ['v1', 'models']) {
    return handler(new Request(url, init), { params: Promise.resolve({ path }) });
}

function settings(overrides: Record<string, unknown> = {}) {
    return {
        targetKind: 'local',
        protocol: 'openai-image',
        preference: 'automatic',
        localEndpoint: '/comfy-api',
        hostedEndpoint: '',
        imageApiEndpoint: 'https://img.example.com/v1',
        imageApiKeyless: false,
        imageApiModels: [],
        imageApiModel: 'flux-1',
        imageApiSize: '1024x1024',
        endpointConcurrency: 2,
        hasImageApiKey: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    upstreamFetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', upstreamFetch);
    authMock.mockResolvedValue({ user: { id: 'u-1' } });
    getSettingsMock.mockResolvedValue(settings());
    getSecretMock.mockResolvedValue('sk-stored-key');
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('GET /api/ai/proxy/[...path]', () => {
    it('returns 401 without an authenticated session', async () => {
        authMock.mockResolvedValue(null);
        const res = await call(GET, 'http://localhost/api/ai/proxy/models');
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'Unauthorized' });
        expect(upstreamFetch).not.toHaveBeenCalled();
    });

    it('returns 400 when no image API endpoint is configured', async () => {
        getSettingsMock.mockResolvedValue(settings({ imageApiEndpoint: '' }));
        const res = await call(GET, 'http://localhost/api/ai/proxy/models');
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'No image API endpoint configured.' });
        expect(upstreamFetch).not.toHaveBeenCalled();
    });

    it('forwards to the configured endpoint and injects the stored key', async () => {
        const res = await call(GET, 'http://localhost/api/ai/proxy/v1/models');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ data: [] });
        expect(upstreamFetch).toHaveBeenCalledTimes(1);
        const [url, init] = upstreamFetch.mock.calls[0] as [string, RequestInit];
        // The proxy path is relative to the endpoint's HOST root (trailing /vN stripped).
        expect(url).toBe('https://img.example.com/v1/models');
        expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-stored-key');
    });

    it('forwards host-root-level native routes below the /vN prefix', async () => {
        await call(GET, 'http://localhost/api/ai/proxy/api/inference/images/generate', undefined, ['api', 'inference', 'images', 'generate']);
        const [url, init] = upstreamFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://img.example.com/api/inference/images/generate');
        expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-stored-key');
    });

    it('does not inject Authorization in keyless mode and never reads the secret', async () => {
        getSettingsMock.mockResolvedValue(settings({ imageApiKeyless: true }));
        await call(GET, 'http://localhost/api/ai/proxy/models');
        expect(new Headers((upstreamFetch.mock.calls[0] as [string, RequestInit])[1].headers).get('authorization')).toBeNull();
        expect(getSecretMock).not.toHaveBeenCalled();
    });

    it('strips a client-provided Authorization header', async () => {
        await call(GET, 'http://localhost/api/ai/proxy/v1/models', { headers: { authorization: 'Bearer client-secret' } });
        const [url, init] = upstreamFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://img.example.com/v1/models');
        expect(new Headers(init.headers).get('authorization')).toBe('Bearer sk-stored-key');
    });

    it('appends the query string to the upstream URL', async () => {
        await call(GET, 'http://localhost/api/ai/proxy/v1/models?limit=5');
        expect(upstreamFetch.mock.calls[0][0]).toBe('https://img.example.com/v1/models?limit=5');
    });

    it('passes upstream errors through unchanged', async () => {
        upstreamFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid api key' }), { status: 401, headers: { 'content-type': 'application/json' } }));
        const res = await call(GET, 'http://localhost/api/ai/proxy/v1/models');
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'invalid api key' });
    });
});

describe('POST /api/ai/proxy/[...path]', () => {
    it('forwards method, multi-segment path, content type, and body', async () => {
        const body = JSON.stringify({ prompt: 'a cat' });
        const res = await call(
            POST,
            'http://localhost/api/ai/proxy/v1/images/generations',
            { method: 'POST', headers: { 'content-type': 'application/json' }, body },
            ['v1', 'images', 'generations'],
        );
        expect(res.status).toBe(200);
        const [url, init] = upstreamFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://img.example.com/v1/images/generations');
        expect(init.method).toBe('POST');
        expect(new Headers(init.headers).get('content-type')).toBe('application/json');
        expect(await new Response(init.body as ReadableStream).text()).toBe(body);
    });
});
