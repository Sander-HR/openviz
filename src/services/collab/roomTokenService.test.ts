import { describe, it, expect } from 'vitest';
import { issueRoomToken, verifyRoomToken, ROOM_TOKEN_TTL_MS } from './roomTokenService';

const SECRET = 'test-secret-0123456789abcdef';
const NOW = 1_700_000_000_000;

describe('issueRoomToken', () => {
    it('produces a token whose payload is exactly the scoped fields', async () => {
        const token = await issueRoomToken({
            projectId: 'p-1',
            sceneId: 's-1',
            userId: 'u-1',
            secret: SECRET,
            now: NOW,
        });
        const [payloadPart] = token.split('.');
        const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
        expect(Object.keys(payload).sort()).toEqual(['expiresAt', 'issuedAt', 'projectId', 'sceneId', 'userId']);
        expect(payload.projectId).toBe('p-1');
        expect(payload.sceneId).toBe('s-1');
        expect(payload.userId).toBe('u-1');
        expect(payload.issuedAt).toBe(NOW);
    });

    it('expires after the ~5 minute TTL', async () => {
        const token = await issueRoomToken({ projectId: 'p', sceneId: 's', userId: 'u', secret: SECRET, now: NOW });
        expect(ROOM_TOKEN_TTL_MS).toBeGreaterThanOrEqual(4 * 60_000);
        expect(ROOM_TOKEN_TTL_MS).toBeLessThanOrEqual(6 * 60_000);
        const [payloadPart] = token.split('.');
        const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
        expect(payload.expiresAt - payload.issuedAt).toBe(ROOM_TOKEN_TTL_MS);
    });
});

describe('verifyRoomToken', () => {
    it('accepts a valid token for the expected scene', async () => {
        const token = await issueRoomToken({ projectId: 'p-1', sceneId: 's-1', userId: 'u-1', secret: SECRET, now: NOW });
        const result = await verifyRoomToken(token, { secret: SECRET, expectedSceneId: 's-1', now: NOW + 60_000 });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.payload.userId).toBe('u-1');
            expect(result.payload.sceneId).toBe('s-1');
        }
    });

    it('rejects an expired token', async () => {
        const token = await issueRoomToken({ projectId: 'p-1', sceneId: 's-1', userId: 'u-1', secret: SECRET, now: NOW });
        const result = await verifyRoomToken(token, { secret: SECRET, expectedSceneId: 's-1', now: NOW + ROOM_TOKEN_TTL_MS + 1 });
        expect(result).toEqual({ ok: false, reason: 'expired' });
    });

    it('rejects a tampered token', async () => {
        const token = await issueRoomToken({ projectId: 'p-1', sceneId: 's-1', userId: 'u-1', secret: SECRET, now: NOW });
        const [, signaturePart] = token.split('.');
        const forged = btoa(JSON.stringify({
            projectId: 'p-1',
            sceneId: 's-1',
            userId: 'attacker',
            issuedAt: NOW,
            expiresAt: NOW + ROOM_TOKEN_TTL_MS,
        }));
        const forgedUrl = forged.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const result = await verifyRoomToken(`${forgedUrl}.${signaturePart}`, {
            secret: SECRET,
            expectedSceneId: 's-1',
            now: NOW + 1000,
        });
        expect(result).toEqual({ ok: false, reason: 'bad-signature' });
    });

    it('rejects a token signed with a different secret', async () => {
        const token = await issueRoomToken({ projectId: 'p-1', sceneId: 's-1', userId: 'u-1', secret: 'other-secret', now: NOW });
        const result = await verifyRoomToken(token, { secret: SECRET, expectedSceneId: 's-1', now: NOW + 1000 });
        expect(result).toEqual({ ok: false, reason: 'bad-signature' });
    });

    it('rejects an out-of-scope token (scene mismatch)', async () => {
        const token = await issueRoomToken({ projectId: 'p-1', sceneId: 's-1', userId: 'u-1', secret: SECRET, now: NOW });
        const result = await verifyRoomToken(token, { secret: SECRET, expectedSceneId: 's-2', now: NOW + 1000 });
        expect(result).toEqual({ ok: false, reason: 'out-of-scope' });
    });

    it('rejects malformed tokens', async () => {
        expect(await verifyRoomToken('not-a-token', { secret: SECRET, expectedSceneId: 's-1', now: NOW }))
            .toEqual({ ok: false, reason: 'malformed' });
        expect(await verifyRoomToken('', { secret: SECRET, expectedSceneId: 's-1', now: NOW }))
            .toEqual({ ok: false, reason: 'malformed' });
    });
});
