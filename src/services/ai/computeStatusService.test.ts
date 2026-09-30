import { describe, expect, it, vi } from 'vitest';
import type { ComputeSettings } from '@/types/executionTarget.types';
import {
    fetchComfyQueueInfo,
    normalizeImageApiEndpoint,
    resolveComputeEndpoint,
} from './computeStatusService';

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
        ...overrides,
    };
}

describe('normalizeImageApiEndpoint', () => {
    it('trims whitespace and strips trailing slashes', () => {
        expect(normalizeImageApiEndpoint('  http://localhost:8001/v1///  ')).toBe('http://localhost:8001/v1');
        expect(normalizeImageApiEndpoint('')).toBe('');
    });
});

describe('resolveComputeEndpoint', () => {
    it('resolves the local ComfyUI proxy by default', () => {
        const resolved = resolveComputeEndpoint(makeSettings());
        expect(resolved).toEqual({ protocol: 'comfyui', endpoint: '/comfy-api', displayEndpoint: '/comfy-api' });
    });

    it('falls back to /comfy-api when the local endpoint is blank', () => {
        const resolved = resolveComputeEndpoint(makeSettings({ localEndpoint: '   ' }));
        expect(resolved.endpoint).toBe('/comfy-api');
    });

    it('resolves the image API endpoint and normalizes trailing slashes', () => {
        const resolved = resolveComputeEndpoint(
            makeSettings({ protocol: 'openai-image', imageApiEndpoint: 'http://localhost:8001/v1/' }),
        );
        expect(resolved).toEqual({
            protocol: 'openai-image',
            endpoint: 'http://localhost:8001/v1',
            displayEndpoint: 'http://localhost:8001/v1',
        });
    });

    it('reports an unconfigured image API with a hint instead of an empty URL', () => {
        const resolved = resolveComputeEndpoint(makeSettings({ protocol: 'openai-image' }));
        expect(resolved.endpoint).toBe('');
        expect(resolved.displayEndpoint).toBe('No image API configured');
    });
});

describe('fetchComfyQueueInfo', () => {
    it('parses running and pending counts from GET /queue', async () => {
        const fetcher = vi.fn(async (input: RequestInfo | URL) => {
            expect(String(input)).toBe('/comfy-api/queue');
            return new Response(JSON.stringify({ queue_running: [{ a: 1 }, { b: 2 }], queue_pending: [{ c: 3 }] }), { status: 200 });
        });

        await expect(fetchComfyQueueInfo('/comfy-api', fetcher)).resolves.toEqual({ active: 2, queued: 1 });
    });

    it('returns null when the route is missing (older ComfyUI builds)', async () => {
        const fetcher = vi.fn(async () => new Response('Not Found', { status: 404 }));
        await expect(fetchComfyQueueInfo('/comfy-api', fetcher)).resolves.toBeNull();
    });

    it('returns null on network failure instead of throwing', async () => {
        const fetcher = vi.fn(async () => {
            throw new Error('offline');
        });
        await expect(fetchComfyQueueInfo('/comfy-api', fetcher)).resolves.toBeNull();
    });

    it('treats malformed payloads as unavailable', async () => {
        const fetcher = vi.fn(async () => new Response('not json', { status: 200 }));
        await expect(fetchComfyQueueInfo('/comfy-api', fetcher)).resolves.toBeNull();
    });
});
