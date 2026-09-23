// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { issueRoomToken } from '../../src/services/collab/roomTokenService';
import { createOnAuthenticate, hasProjectAccessForScene } from './auth';

const SECRET = 'server-test-secret';
const NOW = 1_700_000_000_000;
const SCENE_ID = 'scene-1';
const PROJECT_ID = 'project-1';

function makePayload(token: string, documentName: string) {
    return {
        token,
        documentName,
        context: {},
        instance: null,
        requestHeaders: new Headers(),
        requestParameters: new URLSearchParams(),
        request: new Request('http://localhost/'),
        socketId: 'socket-1',
        connectionConfig: {},
        providerVersion: 'test',
    } as never;
}

describe('createOnAuthenticate (SC-006)', () => {
    it('admits a valid token whose user still has project membership', async () => {
        const token = await issueRoomToken({ projectId: PROJECT_ID, sceneId: SCENE_ID, userId: 'u-1', secret: SECRET, now: NOW });
        const onAuthenticate = createOnAuthenticate({
            secret: SECRET,
            checkMembership: async (sceneId, userId) => sceneId === SCENE_ID && userId === 'u-1',
            now: NOW + 60_000,
        });
        const result = await onAuthenticate(makePayload(token, SCENE_ID));
        expect(result).toEqual({ userId: 'u-1' });
    });

    it('rejects a malformed token', async () => {
        const onAuthenticate = createOnAuthenticate({ secret: SECRET, checkMembership: async () => true });
        expect(await onAuthenticate(makePayload('garbage', SCENE_ID))).toBeNull();
        expect(await onAuthenticate(makePayload('', SCENE_ID))).toBeNull();
    });

    it('rejects an expired token even with membership', async () => {
        const token = await issueRoomToken({ projectId: PROJECT_ID, sceneId: SCENE_ID, userId: 'u-1', secret: SECRET, now: NOW - 10 * 60_000 });
        const onAuthenticate = createOnAuthenticate({ secret: SECRET, checkMembership: async () => true });
        expect(await onAuthenticate(makePayload(token, SCENE_ID))).toBeNull();
    });

    it('rejects a token whose scene scope does not match the requested room', async () => {
        const token = await issueRoomToken({ projectId: PROJECT_ID, sceneId: SCENE_ID, userId: 'u-1', secret: SECRET, now: NOW });
        const onAuthenticate = createOnAuthenticate({ secret: SECRET, checkMembership: async () => true });
        expect(await onAuthenticate(makePayload(token, 'other-scene'))).toBeNull();
    });

    it('rejects a token signed with a different secret', async () => {
        const token = await issueRoomToken({ projectId: PROJECT_ID, sceneId: SCENE_ID, userId: 'u-1', secret: 'wrong-secret', now: NOW });
        const onAuthenticate = createOnAuthenticate({ secret: SECRET, checkMembership: async () => true });
        expect(await onAuthenticate(makePayload(token, SCENE_ID))).toBeNull();
    });

    it('rejects a user who lost workspace membership since the token was issued', async () => {
        const token = await issueRoomToken({ projectId: PROJECT_ID, sceneId: SCENE_ID, userId: 'u-2', secret: SECRET, now: NOW });
        const onAuthenticate = createOnAuthenticate({
            secret: SECRET,
            checkMembership: async (sceneId, userId) => !(sceneId === SCENE_ID && userId === 'u-2'),
            now: NOW + 60_000,
        });
        expect(await onAuthenticate(makePayload(token, SCENE_ID))).toBeNull();
    });

    it('fails closed when no shared secret is configured', async () => {
        const token = await issueRoomToken({ projectId: PROJECT_ID, sceneId: SCENE_ID, userId: 'u-1', secret: SECRET, now: NOW });
        const onAuthenticate = createOnAuthenticate({ secret: undefined, checkMembership: async () => true });
        expect(await onAuthenticate(makePayload(token, SCENE_ID))).toBeNull();
    });
});

describe('hasProjectAccessForScene (real DB wiring)', () => {
    it('is exported as an async function for the default dependency', async () => {
        expect(typeof hasProjectAccessForScene).toBe('function');
    });
});
