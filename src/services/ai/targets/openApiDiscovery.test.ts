import { describe, expect, it, vi } from 'vitest';
import { probeEndpointCapabilities, resolveOpenApiUrl } from './openApiDiscovery';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

const fullSchema = {
    openapi: '3.0.0',
    info: { title: 'Unsloth', version: '1' },
    paths: {
        '/v1/generate-progress': { get: { operationId: 'progress' } },
        '/v1/load-progress': { get: { operationId: 'loadProgress' } },
        '/v1/cancel': { post: { operationId: 'cancel' } },
    },
};

const videoSchema = {
    openapi: '3.0.0',
    info: { title: 'Unsloth', version: '1' },
    paths: {
        '/api/inference/video/generate': { post: { operationId: 'videoGenerate' } },
        '/v1/videos': { post: { operationId: 'createVideoJob' } },
    },
};

describe('resolveOpenApiUrl', () => {
    it('derives the schema from the server root for versioned endpoints', () => {
        expect(resolveOpenApiUrl('http://localhost:8001/v1')).toBe('http://localhost:8001/openapi.json');
        expect(resolveOpenApiUrl('http://localhost:8001/v1/')).toBe('http://localhost:8001/openapi.json');
    });

    it('keeps the conventional path for bare roots', () => {
        expect(resolveOpenApiUrl('http://localhost:8001')).toBe('http://localhost:8001/openapi.json');
    });

    it('returns an empty string for an empty endpoint', () => {
        expect(resolveOpenApiUrl('   ')).toBe('');
    });
});

describe('probeEndpointCapabilities', () => {
    it('reports supported with all optional capabilities when the schema exposes them', async () => {
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            expect(String(input)).toBe('http://localhost:8001/openapi.json');
            return jsonResponse(200, fullSchema);
        });

        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher })).resolves.toEqual({
            schemaAvailable: true,
            outcome: 'supported',
            progressTelemetry: true,
            loadProgress: true,
            cancellation: true,
            videoGenerateNative: false,
            videoJobs: false,
        });
    });

    it('reports supported with no optional capabilities for a plain OpenAI-compatible schema', async () => {
        const fetcher = vi.fn(async () => jsonResponse(200, { openapi: '3.0.0', paths: { '/v1/models': { get: {} } } }));

        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher })).resolves.toMatchObject({
            schemaAvailable: true,
            outcome: 'supported',
            progressTelemetry: false,
            loadProgress: false,
            cancellation: false,
        });
    });

    it('reports the Unsloth video routes when the schema exposes them (R1)', async () => {
        const fetcher = vi.fn(async () => jsonResponse(200, videoSchema));

        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher })).resolves.toMatchObject({
            schemaAvailable: true,
            outcome: 'supported',
            videoGenerateNative: true,
            videoJobs: true,
        });
    });

    it('does not confuse the image generate route with the native video route', async () => {
        const fetcher = vi.fn(async () => jsonResponse(200, { openapi: '3.0.0', paths: { '/api/inference/images/generate': { post: {} } } }));

        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher })).resolves.toMatchObject({
            videoGenerateNative: false,
            videoJobs: false,
        });
    });

    it('reports unavailable when the schema route is missing', async () => {
        const fetcher = vi.fn(async () => jsonResponse(404, {}));
        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher })).resolves.toMatchObject({
            schemaAvailable: false,
            outcome: 'unavailable',
        });
    });

    it('reports unauthorized for 401/403 responses', async () => {
        const fetcher = vi.fn(async () => jsonResponse(401, {}));
        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher })).resolves.toMatchObject({
            schemaAvailable: false,
            outcome: 'unauthorized',
        });
    });

    it('reports network for CORS or connectivity failures without throwing', async () => {
        const fetcher = vi.fn(async () => {
            throw new Error('blocked by CORS');
        });
        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher })).resolves.toMatchObject({
            schemaAvailable: false,
            outcome: 'network',
        });
    });

    it('reports malformed for unparseable or empty schemas', async () => {
        const badJson = vi.fn(async () => new Response('not json', { status: 200 }));
        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher: badJson })).resolves.toMatchObject({
            outcome: 'malformed',
        });

        const emptyPaths = vi.fn(async () => jsonResponse(200, { openapi: '3.0.0', paths: {} }));
        await expect(probeEndpointCapabilities('http://localhost:8001/v1', { fetcher: emptyPaths })).resolves.toMatchObject({
            outcome: 'malformed',
        });
    });

    it('sends the Bearer token only when an API key is configured and not keyless', async () => {
        const withKey = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer secret-key');
            return jsonResponse(200, fullSchema);
        });
        await probeEndpointCapabilities('http://localhost:8001/v1', { apiKey: 'secret-key', fetcher: withKey });

        const keyless = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(new Headers(init?.headers).get('Authorization')).toBeNull();
            return jsonResponse(200, fullSchema);
        });
        await probeEndpointCapabilities('http://localhost:8001/v1', { apiKey: 'secret-key', keyless: true, fetcher: keyless });

        const noKey = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            expect(init?.headers).toBeUndefined();
            return jsonResponse(200, fullSchema);
        });
        await probeEndpointCapabilities('http://localhost:8001/v1', { fetcher: noKey });
    });

    it('returns unavailable without fetching when the endpoint is empty', async () => {
        const fetcher = vi.fn();
        await expect(probeEndpointCapabilities('', { fetcher })).resolves.toMatchObject({ outcome: 'unavailable' });
        expect(fetcher).not.toHaveBeenCalled();
    });
});
