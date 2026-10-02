import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAwarenessUpdateCoalescer, createCursorPublishGate, createStalePeerCleanup } from './awareness';

afterEach(() => vi.useRealTimers());

describe('createCursorPublishGate', () => {
    it('limits continuous cursor publication to approximately 30–40 updates per second', () => {
        let now = 0;
        let publishes = 0;
        const gate = createCursorPublishGate(30, () => now);

        for (let frame = 0; frame < 60; frame += 1) {
            gate(() => { publishes += 1; });
            now += 1000 / 60;
        }

        expect(publishes).toBeGreaterThanOrEqual(30);
        expect(publishes).toBeLessThanOrEqual(40);
    });

    it('publishes immediately again after a reset', () => {
        let now = 100;
        const gate = createCursorPublishGate(30, () => now);
        const publish = vi.fn();

        expect(gate(publish)).toBe(true);
        expect(gate(publish)).toBe(false);
        now += 30;
        expect(gate(publish)).toBe(true);
        gate.reset();
        expect(gate(publish)).toBe(true);
        expect(publish).toHaveBeenCalledTimes(3);
    });
});

describe('createAwarenessUpdateCoalescer', () => {
    it('coalesces bursts into one scheduled UI projection and can flush removals immediately', () => {
        const scheduled = new Map<number, FrameRequestCallback>();
        let nextFrameId = 0;
        const applied = vi.fn();
        const coalescer = createAwarenessUpdateCoalescer(applied, (callback) => {
            const frameId = ++nextFrameId;
            scheduled.set(frameId, callback);
            return frameId;
        }, (frameId) => { scheduled.delete(frameId); });

        coalescer.schedule();
        coalescer.schedule();
        coalescer.schedule();
        expect(scheduled.size).toBe(1);
        expect(applied).not.toHaveBeenCalled();

        const [frameId, callback] = [...scheduled.entries()][0];
        scheduled.delete(frameId);
        callback(16);
        expect(applied).toHaveBeenCalledTimes(1);
        coalescer.schedule();
        coalescer.flush();
        expect(applied).toHaveBeenCalledTimes(2);
        expect(scheduled.size).toBe(0);
        coalescer.dispose();
    });
});

describe('createStalePeerCleanup', () => {
    it('removes a peer immediately after clean disconnect', () => {
        vi.useFakeTimers();
        const onStale = vi.fn();
        const cleanup = createStalePeerCleanup(onStale);
        cleanup.refresh(7);

        cleanup.remove(7);

        expect(onStale).toHaveBeenCalledWith(7);
        vi.advanceTimersByTime(30_000);
        expect(onStale).toHaveBeenCalledTimes(1);
        cleanup.dispose();
    });

    it('expires an abnormal disconnect after 30 seconds and refresh cancels the old timeout', () => {
        vi.useFakeTimers();
        const onStale = vi.fn();
        const cleanup = createStalePeerCleanup(onStale);
        cleanup.refresh(7);
        vi.advanceTimersByTime(20_000);
        cleanup.refresh(7);
        vi.advanceTimersByTime(29_999);
        expect(onStale).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onStale).toHaveBeenCalledWith(7);
        cleanup.dispose();
    });
});
