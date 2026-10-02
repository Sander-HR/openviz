// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRoomCapacity } from './roomCapacity';

describe('createRoomCapacity', () => {
    it('admits at most 50 distinct sockets per document', () => {
        const capacity = createRoomCapacity(50);

        for (let index = 0; index < 50; index += 1) {
            expect(capacity.reserve('scene-1', `socket-${index}`)).toBe(true);
        }

        expect(capacity.count('scene-1')).toBe(50);
        expect(capacity.reserve('scene-1', 'socket-overflow')).toBe(false);
        expect(capacity.count('scene-1')).toBe(50);
    });

    it('keeps reservations isolated by document and makes duplicate reservations idempotent', () => {
        const capacity = createRoomCapacity(1);

        expect(capacity.reserve('scene-1', 'socket-1')).toBe(true);
        expect(capacity.reserve('scene-1', 'socket-1')).toBe(true);
        expect(capacity.reserve('scene-2', 'socket-2')).toBe(true);
        expect(capacity.count('scene-1')).toBe(1);
        expect(capacity.count('scene-2')).toBe(1);
    });

    it('releases a disconnected socket and permits a later connection', () => {
        const capacity = createRoomCapacity(1);
        expect(capacity.reserve('scene-1', 'socket-1')).toBe(true);

        capacity.release('scene-1', 'socket-1');

        expect(capacity.count('scene-1')).toBe(0);
        expect(capacity.reserve('scene-1', 'socket-2')).toBe(true);
    });

    it('does not create or retain a reservation when capacity is full', () => {
        const capacity = createRoomCapacity(1);
        capacity.reserve('scene-1', 'socket-1');

        expect(capacity.reserve('scene-1', 'socket-2')).toBe(false);
        capacity.release('scene-1', 'socket-2');

        expect(capacity.count('scene-1')).toBe(1);
    });

    it('rejects an invalid connection limit', () => {
        expect(() => createRoomCapacity(0)).toThrow(RangeError);
        expect(() => createRoomCapacity(1.5)).toThrow(RangeError);
    });
});
