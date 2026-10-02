import type { CollabPresenceState } from '@/types/collab.types';

export const COLLAB_CURSOR_MIN_INTERVAL_MS = 30;
export const COLLAB_STALE_PEER_TIMEOUT_MS = 30_000;

export interface AwarenessPublisher {
    setAwarenessField(key: string, value: unknown): void;
}

export function publishInitialPresence(
    provider: AwarenessPublisher,
    user: NonNullable<CollabPresenceState['user']>,
): void {
    provider.setAwarenessField('user', user);
    provider.setAwarenessField('cursor', null);
}

export interface CursorPublishGate {
    (publish: () => void): boolean;
    reset(): void;
}

export function createCursorPublishGate(
    minIntervalMs = COLLAB_CURSOR_MIN_INTERVAL_MS,
    now: () => number = Date.now,
): CursorPublishGate {
    let lastPublishedAt: number | null = null;
    const gate = ((publish: () => void): boolean => {
        const current = now();
        if (lastPublishedAt !== null && current - lastPublishedAt < minIntervalMs) return false;
        lastPublishedAt = current;
        publish();
        return true;
    }) as CursorPublishGate;
    gate.reset = () => {
        lastPublishedAt = null;
    };
    return gate;
}

export interface AwarenessUpdateCoalescer {
    schedule(): void;
    flush(): void;
    dispose(): void;
}

export function createAwarenessUpdateCoalescer(
    apply: () => void,
    scheduleFrame: (callback: FrameRequestCallback) => number = requestAnimationFrame,
    cancelFrame: (frameId: number) => void = cancelAnimationFrame,
): AwarenessUpdateCoalescer {
    let frameId: number | null = null;
    let disposed = false;
    const flush = (): void => {
        if (frameId !== null) cancelFrame(frameId);
        frameId = null;
        if (!disposed) apply();
    };
    return {
        schedule() {
            if (disposed || frameId !== null) return;
            frameId = scheduleFrame(() => {
                frameId = null;
                if (!disposed) apply();
            });
        },
        flush,
        dispose() {
            disposed = true;
            if (frameId !== null) cancelFrame(frameId);
            frameId = null;
        },
    };
}

export interface StalePeerCleanup {
    refresh(clientId: number): void;
    remove(clientId: number): void;
    dispose(): void;
}

export function createStalePeerCleanup(
    onStale: (clientId: number) => void,
    timeoutMs = COLLAB_STALE_PEER_TIMEOUT_MS,
): StalePeerCleanup {
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const cancel = (clientId: number): void => {
        const timer = timers.get(clientId);
        if (timer) clearTimeout(timer);
        timers.delete(clientId);
    };

    return {
        refresh(clientId) {
            cancel(clientId);
            timers.set(clientId, setTimeout(() => {
                timers.delete(clientId);
                onStale(clientId);
            }, timeoutMs));
        },
        remove(clientId) {
            cancel(clientId);
            onStale(clientId);
        },
        dispose() {
            for (const timer of timers.values()) clearTimeout(timer);
            timers.clear();
        },
    };
}
