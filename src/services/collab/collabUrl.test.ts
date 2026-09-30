import { describe, expect, it } from 'vitest';
import { resolveCollabServerUrl } from './collabUrl';

describe('resolveCollabServerUrl', () => {
    it('uses the configured URL when one is provided', () => {
        expect(resolveCollabServerUrl('wss://collab.example.test/socket')).toBe('wss://collab.example.test/socket');
    });

    it('uses the remote page hostname instead of localhost', () => {
        expect(resolveCollabServerUrl(undefined, { protocol: 'http:', hostname: '100.77.89.74' }))
            .toBe('ws://100.77.89.74:1234');
    });

    it('matches secure pages with a secure WebSocket', () => {
        expect(resolveCollabServerUrl(undefined, { protocol: 'https:', hostname: 'openviz.example.test' }))
            .toBe('wss://openviz.example.test:1234');
    });

    it('keeps localhost as the server-side fallback', () => {
        expect(resolveCollabServerUrl(undefined, undefined)).toBe('ws://localhost:1234');
    });
});
