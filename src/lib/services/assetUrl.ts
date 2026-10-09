/**
 * Helpers for referencing S3-backed assets by a small, URL-safe token instead of
 * inlining base64 into node state / scene data.
 *
 * Node state stores the app-relative URL returned by {@link buildAssetUrl}
 * (e.g. `/api/assets/<token>`). The token is a base64url encoding of the S3 key,
 * which lets us round-trip to the real key on read without a lookup table. The
 * resolve route mints a fresh presigned GET per request, so the 24h presign
 * expiry never leaks into persisted state.
 */

const ALLOWED_KEY_PREFIXES = ['uploads/', 'renders/', 'thumbnails/'];

/** Encode an S3 key into a URL-path-safe token (base64url, no padding). */
export function encodeAssetKey(key: string): string {
    return Buffer.from(key, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Decode a token back into an S3 key. Returns null when the token is malformed
 * or does not point at one of the allowed asset prefixes (defense against
 * arbitrary-key reads via the resolve route).
 */
export function decodeAssetKey(encoded: string): string | null {
    if (!encoded) return null;
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(pad);
    let key: string;
    try {
        key = Buffer.from(base64, 'base64').toString('utf8');
    } catch {
        return null;
    }
    if (!ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return null;
    return key;
}

/** Build the app-relative URL stored in node state for a given S3 key. */
export function buildAssetUrl(key: string): string {
    return `/api/assets/${encodeAssetKey(key)}`;
}
