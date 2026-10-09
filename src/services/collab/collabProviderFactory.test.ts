import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { HocuspocusProviderWebsocket, type HocuspocusProvider as HocuspocusProviderType } from '@hocuspocus/provider';
import { getNodesMap } from './sceneDocMapping';
import { createCollabProvider, collabOriginFor, applyLocalTransaction, getRemoteAwarenessStates } from './collabProviderFactory';

/** Minimal stand-in for HocuspocusProvider — records wiring, no network. */
class FakeAwareness {
    static nextClientID = 1;
    clientID: number;
    local: Record<string, unknown> = {};

    constructor() {
        // Like the real y-protocols Awareness: unique per instance/client.
        this.clientID = FakeAwareness.nextClientID++;
    }
    states = new Map<number, Record<string, unknown>>();

    getLocal(): Record<string, unknown> {
        return this.local;
    }

    getStates(): Map<number, Record<string, unknown>> {
        return this.states;
    }
}

class FakeProvider {
    static instances: FakeProvider[] = [];
    config: Record<string, unknown>;
    awareness = new FakeAwareness();
    isAttached = false;

    constructor(config: Record<string, unknown>) {
        this.config = config;
        // Seed our own awareness state (local client is never a remote).
        this.awareness.states.set(this.awareness.clientID, {});
        FakeProvider.instances.push(this);
    }

    setAwarenessField(key: string, value: unknown): void {
        this.awareness.local[key] = value;
        this.awareness.states.set(this.awareness.clientID, this.awareness.local);
    }

    on(): FakeProvider {
        return this;
    }

    attach(): void {
        this.isAttached = true;
    }

    detach(): void {
        this.isAttached = false;
    }

    destroy(): void {
        this.detach();
        this.awareness.states.clear();
    }
}

beforeEach(() => {
    FakeProvider.instances = [];
});

const config = {
    url: 'ws://localhost:1234',
    token: 'tok.abc',
    sceneId: 'scene-42',
    userId: 'u-1',
    userName: 'Ada',
};

describe('createCollabProvider', () => {
    it('configures the room provider without auto-connect and exposes websocket lifecycle control', () => {
        const handle = createCollabProvider(config, { ProviderClass: FakeProvider as unknown as typeof HocuspocusProviderType });
        const fake = FakeProvider.instances[0];
        expect(fake.config.name).toBe('scene-42');
        expect(fake.config.token).toBe('tok.abc');
        expect(fake.config.url).toBe('ws://localhost:1234');
        const websocketProvider = fake.config.websocketProvider as HocuspocusProviderWebsocket;
        expect(websocketProvider.configuration.autoConnect).toBe(false);
        expect(handle.provider.isAttached).toBe(true);
        expect(typeof handle.connect).toBe('function');
        expect(handle.doc).toBe(fake.config.document);
        handle.destroy();
    });

    it('attaches externally managed providers so websocket lifecycle events reach the session', () => {
        const handle = createCollabProvider(config);
        expect(handle.provider.isAttached).toBe(true);
        handle.destroy();
        expect(handle.provider.isAttached).toBe(false);
    });

    it('forwards websocket status events through the attached room provider', () => {
        const handle = createCollabProvider(config);
        const events: string[] = [];
        handle.provider.on('status', (event: { status: string }) => events.push(event.status));
        const websocketEvents = handle.provider.configuration.websocketProvider as unknown as {
            emit(eventName: string, event: { status: string }): boolean;
        };
        websocketEvents.emit('status', { status: 'connected' });

        expect(events).toEqual(['connected']);
        handle.destroy();
    });

    it('exposes a Y.Doc with the scene keyed collections', () => {
        const handle = createCollabProvider(config, { ProviderClass: FakeProvider as unknown as typeof HocuspocusProviderType });
        expect(handle.doc).toBeInstanceOf(Y.Doc);
        expect(getNodesMap(handle.doc)).toBeInstanceOf(Y.Map);
        handle.destroy();
    });

    it('publishes the local user to awareness on creation', () => {
        const handle = createCollabProvider(config, { ProviderClass: FakeProvider as unknown as typeof HocuspocusProviderType });
        // The fake records setAwarenessField calls on its own awareness stand-in.
        const awareness = (handle.provider as unknown as { awareness: FakeAwareness }).awareness;
        expect(awareness.getLocal()).toMatchObject({ user: { id: 'u-1', name: 'Ada' } });
        handle.destroy();
    });

    it('gives each client a distinct origin even for the same user (multi-tab undo isolation)', () => {
        const handleA = createCollabProvider(config, { ProviderClass: FakeProvider as unknown as typeof HocuspocusProviderType });
        const handleB = createCollabProvider(config, { ProviderClass: FakeProvider as unknown as typeof HocuspocusProviderType });
        expect(handleA.origin).toContain('u-1');
        expect(handleA.origin).not.toBe(handleB.origin);
        handleA.destroy();
        handleB.destroy();
    });

    it('tags local transactions with the per-user origin (undo tracking input)', () => {
        const handle = createCollabProvider(config, { ProviderClass: FakeProvider as unknown as typeof HocuspocusProviderType });
        expect(collabOriginFor('u-1')).toBe('user:u-1');

        // yjs 13.6: the 'update' event carries (bytes, origin, doc, transaction).
        const origins: unknown[] = [];
        handle.doc.on('update', (_update, origin) => origins.push(origin));

        // A local-only UndoManager must track exactly the transactions we apply.
        const undo = new Y.UndoManager(handle.doc, { trackedOrigins: new Set([handle.origin]) });

        applyLocalTransaction(handle, () => {
            getNodesMap(handle.doc).set('n1', { id: 'n1', position: { x: 0, y: 0 } });
        });

        expect(origins).toEqual([handle.origin]);
        // yjs 13.6 exposes undoStack/redoStack arrays.
        expect(undo.undoStack.length).toBe(1);
        expect(undo.canUndo()).toBe(true);
        handle.destroy();
    });
});

describe('getRemoteAwarenessStates', () => {
    it('excludes the local client and returns only remote states', () => {
        const handle = createCollabProvider(config, { ProviderClass: FakeProvider as unknown as typeof HocuspocusProviderType });
        const fake = FakeProvider.instances[0];

        // Alone in the room: no remote states.
        expect(getRemoteAwarenessStates(handle.provider)).toEqual([]);

        // A peer joins (clientID after our own).
        const peerClientId = fake.awareness.clientID + 1;
        fake.awareness.states.set(peerClientId, { user: { id: 'u-2', name: 'Grace' }, cursor: { x: 5, y: 6 } });
        const remotes = getRemoteAwarenessStates(handle.provider);
        expect(remotes).toHaveLength(1);
        expect(remotes[0].clientId).toBe(peerClientId);
        expect(remotes[0].state.user).toEqual({ id: 'u-2', name: 'Grace' });
        handle.destroy();
    });
});
