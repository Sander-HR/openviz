import { describe, it, expect } from 'vitest';
import { encodeAssetKey, decodeAssetKey, buildAssetUrl } from './assetUrl';

describe('assetUrl', () => {
    it('round-trips a key through encode/decode', () => {
        const key = 'uploads/user-123/1700000000-image.png';
        expect(decodeAssetKey(encodeAssetKey(key))).toBe(key);
    });

    it('produces URL-path-safe tokens (no +, /, or padding)', () => {
        const token = encodeAssetKey('renders/p1/j1/out-0.png');
        expect(token).not.toMatch(/[+/=]/);
    });

    it('builds the app-relative resolve URL from a key', () => {
        expect(buildAssetUrl('thumbnails/p1/thumb.png')).toBe(
            `/api/assets/${encodeAssetKey('thumbnails/p1/thumb.png')}`,
        );
    });

    it.each(['uploads/u/a.png', 'renders/p/j/x.mp4', 'thumbnails/p/t.png'])(
        'accepts allowed prefix %s',
        (key) => {
            expect(decodeAssetKey(encodeAssetKey(key))).toBe(key);
        },
    );

    it('rejects keys outside the allowed asset prefixes', () => {
        expect(decodeAssetKey(encodeAssetKey('secrets/keys.json'))).toBeNull();
        expect(decodeAssetKey(encodeAssetKey('../etc/passwd'))).toBeNull();
    });

    it('returns null for empty or malformed tokens', () => {
        expect(decodeAssetKey('')).toBeNull();
        expect(decodeAssetKey('!!!not-base64!!!')).toBeNull();
    });
});
