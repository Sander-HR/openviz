import { afterEach, describe, expect, it, vi } from 'vitest';
import { createComfyConnectionManager, type ComfyEndpointState } from './comfyConnectionManager';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

const STATS_BODY = { devices: [{ name: 'GPU', type: 'cuda', index: 0, vram_total: 10, vram_free: 5 }] };

interface Harness {
    manager: ReturnType<typeof createComfyConnectionManager>;
    fetchMock: ReturnType<typeof vi.fn>;
    setNow: (value: number) => void;
}

function makeHarness(options?: {
    failureTtlMs?: number;
    successTtlMs?: number;
    pollIntervalMs?: number;
    /** Use the ambient Date.now (vitest fakes it under vi.useFakeTimers). */
    realNow?: boolean;
}): Harness {
    let nowValue = 1_000_000;
    const fetchMock = vi.fn();
    const manager = createComfyConnectionManager({
        fetcher: fetchMock as unknown as typeof fetch,
        ...(options?.realNow ? {} : { now: () => nowValue }),
        failureTtlMs: options?.failureTtlMs,
        successTtlMs: options?.successTtlMs,
        pollIntervalMs: options?.pollIntervalMs,
    });
    return { manager, fetchMock, setNow: (value) => { nowValue = value; } };
}

/** Routes the three ComfyUI status endpoints; `down` simulates a refused connection. */
function routeComfyEndpoints(fetchMock: ReturnType<typeof vi.fn>, down = false): void {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (down) throw new Error('connect ECONNREFUSED 127.0.0.1:8188');
        if (url.endsWith('/system_stats')) return jsonResponse(200, STATS_BODY);
        if (url.endsWith('/object_info')) return jsonResponse(200, {});
        if (url.endsWith('/queue')) return jsonResponse(200, { queue_running: ['p1'], queue_pending: [] });
        return jsonResponse(404, {});
    });
}

const calledUrls = (fetchMock: ReturnType<typeof vi.fn>): string[] =>
    fetchMock.mock.calls.map((call) => String(call[0]));

afterEach(() => {
    vi.useRealTimers();
});

describe('createComfyConnectionManager', () => {
    it('probes /system_stats and returns ready with capabilities and queue when the endpoint is up', async () => {
        const { manager, fetchMock } = makeHarness();
        routeComfyEndpoints(fetchMock);

        const state = await manager.check('http://comfy');

        expect(state.status).toBe('ready');
        expect(state.capabilities?.devices[0]?.name).toBe('GPU');
        expect(state.queue).toEqual({ active: 1, queued: 0 });
        expect(state.lastCheckedAt).toBe(1_000_000);
        const urls = calledUrls(fetchMock);
        expect(urls.some((url) => url.endsWith('/system_stats'))).toBe(true);
        expect(urls.some((url) => url.endsWith('/object_info'))).toBe(true);
        expect(urls.some((url) => url.endsWith('/queue'))).toBe(true);
    });

    it('makes exactly one request when the probe fails', async () => {
        const { manager, fetchMock } = makeHarness();
        routeComfyEndpoints(fetchMock, true);

        const state = await manager.check('http://comfy');

        expect(state.status).toBe('unavailable');
        expect(state.message).toBeTruthy();
        expect(state.capabilities).toBeNull();
        expect(state.queue).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(calledUrls(fetchMock)[0]).toMatch(/\/system_stats$/);
    });

    it('does not re-probe while a failure is within the failure TTL', async () => {
        const { manager, fetchMock, setNow } = makeHarness({ failureTtlMs: 10_000 });
        routeComfyEndpoints(fetchMock, true);

        await manager.check('http://comfy');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const cached = await manager.check('http://comfy');
        expect(cached.status).toBe('unavailable');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        setNow(1_000_000 + 10_001);
        await manager.check('http://comfy');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('serves cached state without network calls within the success TTL', async () => {
        const { manager, fetchMock, setNow } = makeHarness({ successTtlMs: 30_000 });
        routeComfyEndpoints(fetchMock);

        await manager.check('http://comfy');
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const cached = await manager.check('http://comfy');
        expect(cached.status).toBe('ready');
        expect(fetchMock).toHaveBeenCalledTimes(3);

        setNow(1_000_000 + 30_001);
        await manager.check('http://comfy');
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it('coalesces concurrent checks into a single probe', async () => {
        const { manager, fetchMock } = makeHarness();
        let resolveStats: ((response: Response) => void) | undefined;
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/system_stats')) {
                return new Promise<Response>((resolve) => { resolveStats = () => resolve(jsonResponse(200, STATS_BODY)); });
            }
            if (url.endsWith('/object_info')) return jsonResponse(200, {});
            if (url.endsWith('/queue')) return jsonResponse(200, { queue_running: [], queue_pending: [] });
            return jsonResponse(404, {});
        });

        const first = manager.check('http://comfy');
        const second = manager.check('http://comfy');

        expect(first).toBe(second);
        expect(calledUrls(fetchMock).filter((url) => url.endsWith('/system_stats'))).toHaveLength(1);

        resolveStats?.(jsonResponse(200, STATS_BODY));
        const [firstState, secondState] = await Promise.all([first, second]);
        expect(firstState.status).toBe('ready');
        expect(secondState).toBe(firstState);
    });

    it('bypasses the cache when force is set', async () => {
        const { manager, fetchMock } = makeHarness();
        routeComfyEndpoints(fetchMock);

        await manager.check('http://comfy');
        expect(fetchMock).toHaveBeenCalledTimes(3);

        await manager.check('http://comfy', { force: true });
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it('stays ready with null capabilities when /object_info fails', async () => {
        const { manager, fetchMock } = makeHarness();
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/system_stats')) return jsonResponse(200, STATS_BODY);
            if (url.endsWith('/object_info')) return jsonResponse(500, {});
            if (url.endsWith('/queue')) return jsonResponse(200, { queue_running: ['p1'], queue_pending: [] });
            return jsonResponse(404, {});
        });

        const state = await manager.check('http://comfy');

        expect(state.status).toBe('ready');
        expect(state.capabilities).toBeNull();
        expect(state.queue).toEqual({ active: 1, queued: 0 });
    });

    it('does not call the network for an empty endpoint', async () => {
        const { manager, fetchMock } = makeHarness();

        const state = await manager.check('');

        expect(state.status).toBe('unavailable');
        expect(state.message).toBe('No endpoint configured.');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('keeps separate cache entries per endpoint', async () => {
        const { manager, fetchMock } = makeHarness();
        routeComfyEndpoints(fetchMock);

        await manager.check('http://a');
        await manager.check('http://b');

        expect(fetchMock).toHaveBeenCalledTimes(6);
        expect(manager.getState('http://a').status).toBe('ready');
        expect(manager.getState('http://b').status).toBe('ready');
    });

    it('reports checking state before the first probe completes', () => {
        const { manager } = makeHarness();
        const state: ComfyEndpointState = manager.getState('http://never-checked');
        expect(state.status).toBe('checking');
        expect(state.lastCheckedAt).toBeNull();
    });

    it('notifies subscribers when a check completes and supports unsubscribe', async () => {
        const { manager, fetchMock } = makeHarness();
        routeComfyEndpoints(fetchMock);

        const seen: ComfyEndpointState[] = [];
        const unsubscribe = manager.subscribe((state) => { seen.push(state); });

        await manager.check('http://comfy');
        expect(seen).toHaveLength(1);
        expect(seen[0]?.endpoint).toBe('http://comfy');
        expect(seen[0]?.status).toBe('ready');

        unsubscribe();
        await manager.check('http://other', { force: true });
        expect(seen).toHaveLength(1);
    });

    it('re-probes watched endpoints on the shared poll timer and stops when unwatched', async () => {
        vi.useFakeTimers();
        const { manager, fetchMock } = makeHarness({ failureTtlMs: 10_000, pollIntervalMs: 10_000, realNow: true });
        routeComfyEndpoints(fetchMock, true);

        manager.watch('http://comfy');
        await manager.check('http://comfy');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(10_000);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        manager.unwatch('http://comfy');
        await vi.advanceTimersByTimeAsync(30_000);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('ticks every watched endpoint once per interval', async () => {
        vi.useFakeTimers();
        const { manager, fetchMock } = makeHarness({ failureTtlMs: 10_000, pollIntervalMs: 10_000, realNow: true });
        routeComfyEndpoints(fetchMock, true);

        manager.watch('http://a');
        manager.watch('http://b');
        await Promise.all([manager.check('http://a'), manager.check('http://b')]);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(10_000);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
