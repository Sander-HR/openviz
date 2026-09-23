import { describe, expect, it, vi } from 'vitest';
import { onImmediateSceneSaveRequested, requestImmediateSceneSave } from './sceneSyncBus';

describe('sceneSyncBus', () => {
    it('notifies all registered listeners when an immediate save is requested', () => {
        const first = vi.fn();
        const second = vi.fn();

        const unsubscribeFirst = onImmediateSceneSaveRequested(first);
        const unsubscribeSecond = onImmediateSceneSaveRequested(second);

        requestImmediateSceneSave();

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);

        unsubscribeFirst();
        unsubscribeSecond();
    });

    it('stops notifying unsubscribed listeners', () => {
        const listener = vi.fn();

        const unsubscribe = onImmediateSceneSaveRequested(listener);
        unsubscribe();

        requestImmediateSceneSave();

        expect(listener).not.toHaveBeenCalled();
    });

    it('is a no-op when no listeners are registered', () => {
        expect(() => requestImmediateSceneSave()).not.toThrow();
    });
});
