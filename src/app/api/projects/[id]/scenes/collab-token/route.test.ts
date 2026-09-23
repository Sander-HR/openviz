import { describe, it, expect, vi, beforeEach } from 'vitest';

const authMock = vi.fn();

// Drizzle query results are consumed in route order: project → membership → main scene.
let resultQueue: unknown[][] = [];

vi.mock('@/lib/auth', () => ({
    auth: (...args: unknown[]) => authMock(...args),
    db: {
        select: () => {
            const chain = {
                from: () => chain,
                where: () => chain,
                limit: () => chain,
                then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                    Promise.resolve(resultQueue.shift() ?? []).then(resolve, reject),
            };
            return chain;
        },
    },
}));

import { POST } from './route';

function post(projectId = 'project-1') {
    return POST(new Request(`http://localhost/api/projects/${projectId}/scenes/collab-token`, { method: 'POST' }), {
        params: Promise.resolve({ id: projectId }),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    resultQueue = [];
});

describe('POST /api/projects/:id/scenes/collab-token', () => {
    it('returns 401 without an authenticated session', async () => {
        authMock.mockResolvedValue(null);
        const res = await post();
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 404 when the project does not exist', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        resultQueue = [[]]; // no project row
        const res = await post();
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'Not Found' });
    });

    it('returns 403 for a user without workspace membership (SC-006)', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        resultQueue = [[{ id: 'project-1', workspaceId: 'w-1' }], []]; // project exists, no membership
        const res = await post();
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'Forbidden' });
    });

    it('returns 404 when the project has no main scene', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        resultQueue = [
            [{ id: 'project-1', workspaceId: 'w-1' }],
            [{ workspaceId: 'w-1', userId: 'u-1', role: 'member' }],
            [], // no main scene
        ];
        const res = await post();
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'No main scene' });
    });

    it('returns a scoped token for a workspace member', async () => {
        const original = process.env.COLLAB_TOKEN_SECRET;
        process.env.COLLAB_TOKEN_SECRET = 'route-test-secret';
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        resultQueue = [
            [{ id: 'project-1', workspaceId: 'w-1' }],
            [{ workspaceId: 'w-1', userId: 'u-1', role: 'member' }],
            [{ id: 'scene-main', projectId: 'project-1', isMain: true }],
        ];
        try {
        const res = await post();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.sceneId).toBe('scene-main');
        expect(body.projectId).toBe('project-1');
        expect(typeof body.expiresAt).toBe('number');
        expect(body.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

        // The token must verify against the configured secret and scope to the main scene.
        const { verifyRoomToken } = await import('@/services/collab/roomTokenService');
        const result = await verifyRoomToken(body.token, {
            secret: 'route-test-secret',
            expectedSceneId: 'scene-main',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.payload.userId).toBe('u-1');
            expect(result.payload.projectId).toBe('project-1');
        }
        } finally {
            if (original === undefined) delete process.env.COLLAB_TOKEN_SECRET;
            else process.env.COLLAB_TOKEN_SECRET = original;
        }
    });

    it('returns 503 when the collaboration secret is not configured', async () => {
        authMock.mockResolvedValue({ user: { id: 'u-1' } });
        resultQueue = [
            [{ id: 'project-1', workspaceId: 'w-1' }],
            [{ workspaceId: 'w-1', userId: 'u-1', role: 'member' }],
            [{ id: 'scene-main', projectId: 'project-1', isMain: true }],
        ];
        const original = process.env.COLLAB_TOKEN_SECRET;
        delete process.env.COLLAB_TOKEN_SECRET;
        try {
            const res = await post();
            expect(res.status).toBe(503);
        } finally {
            if (original !== undefined) process.env.COLLAB_TOKEN_SECRET = original;
        }
    });
});
