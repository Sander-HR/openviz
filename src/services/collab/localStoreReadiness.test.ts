import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitForLocalDocumentReadiness } from './localStoreReadiness';

afterEach(() => vi.useRealTimers());

describe('waitForLocalDocumentReadiness', () => {
    it('resolves when IndexedDB restore finishes before the deadline', async () => {
        await expect(waitForLocalDocumentReadiness(Promise.resolve(), 100)).resolves.toBeUndefined();
    });

    it('rejects with a timeout when restore never completes', async () => {
        vi.useFakeTimers();
        const ready = waitForLocalDocumentReadiness(new Promise<void>(() => {}), 25);
        const assertion = expect(ready).rejects.toThrow('Local document restore timed out');
        await vi.advanceTimersByTimeAsync(25);
        await assertion;
    });

    it('preserves IndexedDB restore errors for the session fallback handler', async () => {
        const error = new Error('IndexedDB unavailable');
        await expect(waitForLocalDocumentReadiness(Promise.reject(error), 100)).rejects.toBe(error);
    });
});
