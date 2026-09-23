/**
 * Signed, short-lived room tokens for the collaboration server.
 *
 * Tokens are compact HMAC-SHA256 signed payloads (base64url) shared by the
 * Next.js token-issuance route and the standalone Hocuspocus server, so this
 * module is intentionally isomorphic (Web Crypto only — no node: imports).
 */

export const ROOM_TOKEN_TTL_MS = 5 * 60_000;

export interface RoomTokenPayload {
    projectId: string;
    sceneId: string;
    userId: string;
    issuedAt: number;
    expiresAt: number;
}

export type RoomTokenVerifyResult =
    | { ok: true; payload: RoomTokenPayload }
    | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'out-of-scope' };

interface IssueRoomTokenOptions {
    projectId: string;
    sceneId: string;
    userId: string;
    secret: string;
    /** Injectable clock for tests. */
    now?: number;
    ttlMs?: number;
}

interface VerifyRoomTokenOptions {
    secret: string;
    expectedSceneId: string;
    /** Injectable clock for tests. */
    now?: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array | null {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    try {
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch {
        return null;
    }
}

async function hmacSignature(secret: string, data: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

export async function issueRoomToken(options: IssueRoomTokenOptions): Promise<string> {
    const now = options.now ?? Date.now();
    const ttlMs = options.ttlMs ?? ROOM_TOKEN_TTL_MS;
    const payload: RoomTokenPayload = {
        projectId: options.projectId,
        sceneId: options.sceneId,
        userId: options.userId,
        issuedAt: now,
        expiresAt: now + ttlMs,
    };
    const payloadPart = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const signature = await hmacSignature(options.secret, payloadPart);
    return `${payloadPart}.${signature}`;
}

export async function verifyRoomToken(token: string, options: VerifyRoomTokenOptions): Promise<RoomTokenVerifyResult> {
    const now = options.now ?? Date.now();
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { ok: false, reason: 'malformed' };
    }

    const [payloadPart, signaturePart] = parts;
    const expectedSignature = await hmacSignature(options.secret, payloadPart);
    if (!timingSafeEqual(signaturePart, expectedSignature)) {
        return { ok: false, reason: 'bad-signature' };
    }

    const payloadBytes = base64UrlDecode(payloadPart);
    if (!payloadBytes) return { ok: false, reason: 'malformed' };

    let payload: RoomTokenPayload;
    try {
        payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as RoomTokenPayload;
    } catch {
        return { ok: false, reason: 'malformed' };
    }

    if (
        typeof payload.projectId !== 'string' ||
        typeof payload.sceneId !== 'string' ||
        typeof payload.userId !== 'string' ||
        typeof payload.issuedAt !== 'number' ||
        typeof payload.expiresAt !== 'number'
    ) {
        return { ok: false, reason: 'malformed' };
    }

    if (now >= payload.expiresAt) {
        return { ok: false, reason: 'expired' };
    }
    if (payload.sceneId !== options.expectedSceneId) {
        return { ok: false, reason: 'out-of-scope' };
    }

    return { ok: true, payload };
}
