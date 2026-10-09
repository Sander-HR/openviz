import { beforeEach, vi } from 'vitest';
import type { CollabTokenResponse } from '@/types/collab.types';
import { useStore } from '@/store/useStore';
import { createSceneDoc } from '@/services/collab/sceneDocMapping';
import type { UseCollabSessionOptions } from './useCollabSession';

export const PROJECT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
export const OTHER_PROJECT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

/** Minimal stand-in for HocuspocusProvider — records wiring, no network. */
class FakeAwareness {
    clientID = 1;
    local: Record<string, unknown> = {};
    states = new Map<number, Record<string, unknown>>([[1, {}]]);

    getLocal(): Record<string, unknown> {
        return this.local;
    }

    setLocalField(key: string, value: unknown): void {
        this.local[key] = value;
    }

    getStates(): Map<number, Record<string, unknown>> {
        return this.states;
    }
}

type StatusListener = (event: { status: string }) => void;

export class FakeProvider {
    static instances: FakeProvider[] = [];
    config: Record<string, unknown>;
    awareness = new FakeAwareness();
    private statusListeners: StatusListener[] = [];
    private syncedListeners: Array<() => void> = [];
    private maxAttemptsFailedListeners: Array<() => void> = [];
    private authenticationFailedListeners: Array<(data: { reason: string }) => void> = [];
    private awarenessUpdateListeners: Array<(data: { states: Array<Record<string, unknown> & { clientId: number }> }) => void> = [];
    destroyed = false;
    connectCalls = 0;

    constructor(config: Record<string, unknown>) {
        this.config = config;
        FakeProvider.instances.push(this);
    }

    on(event: string, listener: StatusListener | (() => void) | ((data: { reason: string }) => void) | ((data: { states: Array<Record<string, unknown> & { clientId: number }> }) => void)): this {
        if (event === 'status') this.statusListeners.push(listener as StatusListener);
        if (event === 'synced') this.syncedListeners.push(listener as () => void);
        if (event === 'maxAttemptsFailed') this.maxAttemptsFailedListeners.push(listener as () => void);
        if (event === 'authenticationFailed') this.authenticationFailedListeners.push(listener as (data: { reason: string }) => void);
        if (event === 'awarenessUpdate') this.awarenessUpdateListeners.push(listener as (data: { states: Array<Record<string, unknown> & { clientId: number }> }) => void);
        return this;
    }

    /** Test helper: simulate the provider reporting a new connection status. */
    emitStatus(status: string): void {
        for (const listener of this.statusListeners) listener({ status });
    }

    /** Test helper: simulate the retry loop giving up. */
    emitMaxAttemptsFailed(): void {
        for (const listener of this.maxAttemptsFailedListeners) listener();
    }

    /** Test helper: simulate the server rejecting the join (SC-006). */
    emitAuthenticationFailed(reason = 'unauthorized'): void {
        for (const listener of this.authenticationFailedListeners) listener({ reason });
    }

    /** Test helper: simulate an awareness snapshot update from the transport. */
    emitAwarenessUpdate(states: Array<Record<string, unknown> & { clientId: number }>): void {
        for (const listener of this.awarenessUpdateListeners) listener({ states });
    }

    setAwarenessField(key: string, value: unknown): void {
        this.awareness.setLocalField(key, value);
    }

    connect(): void {
        this.connectCalls += 1;
        // Report connected, then synced, on later microtasks — like the real transport.
        queueMicrotask(() => this.emitStatus('connected'));
        queueMicrotask(() => {
            for (const listener of this.syncedListeners) listener();
        });
    }

    disconnect(): void {
        /* no-op */
    }

    destroy(): void {
        this.destroyed = true;
    }
}

beforeEach(() => {
    FakeProvider.instances = [];
    vi.restoreAllMocks();
    useStore.setState({
        workbenchNodes: [],
        connections: [],
        activeWorkbenchGesture: null,
        collabSessionActive: false,
    });
});

export function seedOptions(overrides: Partial<UseCollabSessionOptions> = {}, doc = createSceneDoc()): UseCollabSessionOptions {
    return {
        projectId: PROJECT_ID,
        userId: 'u-alice',
        userName: 'Alice',
        serverUrl: 'ws://localhost:1234',
        getToken: vi.fn().mockResolvedValue({
            token: 'tok.abc',
            sceneId: 'scene-main-1',
            projectId: PROJECT_ID,
            expiresAt: Date.now() + 300_000,
        } satisfies CollabTokenResponse),
        createProvider: (config) => {
            const provider = new FakeProvider(config as unknown as Record<string, unknown>);
            return {
                provider,
                doc,
                origin: `user:${config.userId}`,
                connect: () => provider.connect(),
                disconnect: () => provider.disconnect(),
                destroy: () => provider.destroy(),
            };
        },
        ...overrides,
    };
}

/** Token-fetch call count for the injected getToken (seedOptions always sets one). */
export function tokenCallCount(options: UseCollabSessionOptions): number {
    return options.getToken ? vi.mocked(options.getToken).mock.calls.length : 0;
}
