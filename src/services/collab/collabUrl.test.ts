import { describe, expect, it } from 'vitest';
import { parseCollabUrlMap, resolveCollabServerUrl } from './collabUrl';

describe('parseCollabUrlMap', () => {
    it('parses comma-separated host=url pairs and lower-cases hosts', () => {
        expect(parseCollabUrlMap('localhost=ws://localhost:1234, Example.Com = wss://example.com'))
            .toEqual({
                localhost: 'ws://localhost:1234',
                'example.com': 'wss://example.com',
            });
    });

    it('skips malformed entries without breaking the rest', () => {
        expect(parseCollabUrlMap('noSeparator, =ws://x.test, localhost=ws://localhost:1234'))
            .toEqual({ localhost: 'ws://localhost:1234' });
    });

    it('returns an empty map for unset input', () => {
        expect(parseCollabUrlMap(undefined)).toEqual({});
        expect(parseCollabUrlMap('')).toEqual({});
    });
});

describe('resolveCollabServerUrl', () => {
    it('prefers an exact hostname match over the single configured URL', () => {
        const url = resolveCollabServerUrl(
            { url: 'wss://everywhere.test', byHost: { localhost: 'ws://localhost:1234' } },
            { protocol: 'http:', hostname: 'localhost' },
        );
        expect(url).toBe('ws://localhost:1234');
    });

    it('matches hosts case-insensitively', () => {
        const url = resolveCollabServerUrl(
            { byHost: parseCollabUrlMap('Example.Com=wss://example.com') },
            { protocol: 'https:', hostname: 'EXAMPLE.COM' },
        );
        expect(url).toBe('wss://example.com');
    });

    it('falls back to the single configured URL when no host matches', () => {
        const url = resolveCollabServerUrl(
            { url: 'wss://collab.example.test/socket', byHost: { localhost: 'ws://localhost:1234' } },
            { protocol: 'https:', hostname: 'other-host.test' },
        );
        expect(url).toBe('wss://collab.example.test/socket');
    });

    it('uses the remote page hostname instead of localhost', () => {
        expect(resolveCollabServerUrl(undefined, { protocol: 'http:', hostname: '100.77.89.74' }))
            .toBe('ws://100.77.89.74:1234');
    });

    it('matches secure pages with a secure WebSocket', () => {
        expect(resolveCollabServerUrl(undefined, { protocol: 'https:', hostname: 'openviz.example.test' }))
            .toBe('wss://openviz.example.test:1234');
    });

    it('derives devtunnels hosts without an explicit port', () => {
        // The tunnel subdomain encodes the forwarded port (`-1234`); appending
        // a port would dial a closed port on the tunnel host.
        expect(
            resolveCollabServerUrl(undefined, { protocol: 'https:', hostname: 'ztkvr5bx-1234.euw.devtunnels.ms' }),
        ).toBe('wss://ztkvr5bx-1234.euw.devtunnels.ms');
    });

    it('keeps localhost as the server-side fallback', () => {
        expect(resolveCollabServerUrl(undefined, undefined)).toBe('ws://localhost:1234');
    });

    it('prefers the configured URL over derivation on the server side', () => {
        expect(resolveCollabServerUrl({ url: 'wss://collab.example.test' }, undefined))
            .toBe('wss://collab.example.test');
    });
});
