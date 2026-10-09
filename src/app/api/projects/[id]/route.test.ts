import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();

// Drizzle calls in this route's GET, in order: project → membership → main scene.
let selectQueue: unknown[][] = [];
let updateCalledWith: Array<{ set: unknown; where: unknown }> = [];

vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => authMock(...args),
    db: {
        select: () => {
            const chain = {
                from: () => chain,
                where: () => chain,
                limit: () => chain,
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                    Promise.resolve(selectQueue.shift() ?? []).then(resolve, reject),
            };
            return chain;
        },
        update: () => {
            const chainMeta: { set?: unknown; where?: unknown } = {};
            const chain = {
                set: (set: unknown) => {
                    chainMeta.set = set;
                    return chain;
                },
                where: (where: unknown) => {
                    updateCalledWith.push({ set: chainMeta.set, where });
                    return chain;
                },
                returning: () => Promise.resolve([{ id: 'p-1' }]),
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                    Promise.resolve([{ id: 'p-1' }]).then(resolve, reject),
            };
            return chain;
        },
    },
}));

import { GET, stripInlineData } from './route';
import { POST } from './viewed/route';

function get(projectId = 'p-1', headers: Record<string, string> = {}) {
    return GET(new Request(`http://localhost/api/projects/${projectId}`, { headers }), {
        params: Promise.resolve({ id: projectId }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    selectQueue = [];
    updateCalledWith = [];
});

describe('GET /api/projects/:id', () => {
    it('returns the project with scene and an ETag header', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [], connections: [] }, version: 7 }],
        ];
        const res = await get();
        expect(res.status).toBe(200);
        const body = (await res.json()) as { sceneVersion?: number; name?: string };
        expect(body.name).toBe('Proj');
        expect(body.sceneVersion).toBe(7);
        expect(res.headers.get('etag')).toBeTruthy();
    });

    it('does NOT update lastViewedAt on read', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [], connections: [] }, version: 7 }],
        ];
        await get();
        expect(updateCalledWith).toHaveLength(0);
    });

    it('returns 304 when If-None-Match matches the current body', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        const rows = () => [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [], connections: [] }, version: 7 }],
        ];

        selectQueue = rows();
        const first = await get();
        expect(first.status).toBe(200);
        const etag = first.headers.get('etag');
        expect(etag).toBeTruthy();

        selectQueue = rows();
        const second = await get('p-1', { 'if-none-match': etag! });
        expect(second.status).toBe(304);
        expect(await second.text()).toBe('');
    });

    it('returns 200 (not 304) when the scene changed since the stored ETag', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [], connections: [] }, version: 7 }],
        ];
        const first = await get();
        const etag = first.headers.get('etag')!;

        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [{ id: 'n-1' }], connections: [] }, version: 8 }], // changed scene
        ];
        const second = await get('p-1', { 'if-none-match': etag });
        expect(second.status).toBe(200);
    });

    it('sets a short private cache on the response', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [], connections: [] }, version: 7 }],
        ];
        const res = await get();
        expect(res.headers.get('cache-control')).toBe('private, max-age=5, stale-while-revalidate=60');
    });
});

describe('stripInlineData (?lite=1)', () => {
    it('replaces long data URLs with a marker, recursively', () => {
        type TestNode = { id: string; src?: string; meta?: { list: string[] } };
        const scene: { nodes: TestNode[]; connections: unknown[] } = {
            nodes: [
                { id: 'n-1', src: `data:image/png;base64,${'A'.repeat(200)}` },
                { id: 'n-2', meta: { list: [`data:image/webp;base64,${'B'.repeat(100)}`, 'plain'] } },
            ],
            connections: [],
        };
        const stripped = stripInlineData(scene) as typeof scene;
        expect(stripped.nodes[0]!.src).toBe('[stripped-inline-data]');
        expect(stripped.nodes[1]!.meta!.list[0]).toBe('[stripped-inline-data]');
        expect(stripped.nodes[1]!.meta!.list[1]).toBe('plain');
    });

    it('keeps short strings, numbers and nulls untouched', () => {
        expect(stripInlineData({ a: 'data:', b: 42, c: null, d: undefined })).toEqual({ a: 'data:', b: 42, c: null, d: undefined });
    });
});

describe('GET /api/projects/:id?lite=1', () => {
    it('strips base64 payloads from the scene but keeps the structure', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        const bigDataUrl = `data:image/png;base64,${'A'.repeat(500)}`;
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [{ id: 'n-1', src: bigDataUrl, label: 'keep me' }], connections: [] }, version: 3 }],
        ];
        const res = await GET(new Request('http://localhost/api/projects/p-1?lite=1'), {
            params: Promise.resolve({ id: 'p-1' }),
        });
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain('base64');
        expect(text).toContain('[stripped-inline-data]');
        expect(text).toContain('keep me');
    });

    it('leaves the default response unchanged', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        const bigDataUrl = `data:image/png;base64,${'A'.repeat(500)}`;
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
            [{ data: { nodes: [{ id: 'n-1', src: bigDataUrl }], connections: [] }, version: 3 }],
        ];
        const res = await get();
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain('base64');
    });
});

describe('POST /api/projects/:id/viewed', () => {
    it('updates lastViewedAt and returns ok', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-1' }],
            [{ workspaceId: 'ws-1', userId: 'u-1' }],
        ];
        const res = await POST(new Request('http://localhost/api/projects/p-1/viewed', { method: 'POST' }), {
            params: Promise.resolve({ id: 'p-1' }),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(updateCalledWith).toHaveLength(1);
        expect(JSON.stringify(updateCalledWith[0].set)).toContain('lastViewedAt');
    });

    it('returns 401 without a session', async () => {
        authMock.mockResolvedValue(null);
        const res = await POST(new Request('http://localhost/api/projects/p-1/viewed', { method: 'POST' }), {
            params: Promise.resolve({ id: 'p-1' }),
        });
        expect(res.status).toBe(401);
    });

    it('returns 403 for a project in another workspace', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        selectQueue = [
            [{ id: 'p-1', name: 'Proj', workspaceId: 'ws-other' }],
            [], // no membership for ws-other
        ];
        const res = await POST(new Request('http://localhost/api/projects/p-1/viewed', { method: 'POST' }), {
            params: Promise.resolve({ id: 'p-1' }),
        });
        expect(res.status).toBe(403);
    });
});
