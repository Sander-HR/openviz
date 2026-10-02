import { describe, expect, it } from 'vitest';
import { createPerformanceTelemetry } from './performanceTelemetry';

describe('createPerformanceTelemetry', () => {
    it('reports p95 latency, average, and samples for the target latency metrics', () => {
        const telemetry = createPerformanceTelemetry();
        for (const value of [10, 20, 30, 40, 50, 60, 70, 80, 90, 200]) {
            telemetry.record('documentSyncMs', value);
        }
        telemetry.record('cursorLatencyMs', 80);
        telemetry.record('interactionLatencyMs', 40);
        telemetry.record('cursorUpdatesPerSecond', 33);
        telemetry.record('cursorOnlyGraphRenders', 0);

        expect(telemetry.summary('cursorUpdatesPerSecond')).toMatchObject({ count: 1, average: 33 });
        expect(telemetry.summary('cursorOnlyGraphRenders').maximum).toBe(0);
        expect(telemetry.summary('documentSyncMs')).toMatchObject({ count: 10, p95: 200, average: 65 });
        expect(telemetry.summary('cursorLatencyMs')).toMatchObject({ count: 1, p95: 80, minimum: 80 });
        expect(telemetry.summary('interactionLatencyMs')).toMatchObject({ count: 1, p95: 40 });
    });

    it('measures duration from a monotonic clock and summarizes sustained FPS by its minimum', () => {
        let clock = 100;
        const telemetry = createPerformanceTelemetry(() => clock);
        const finish = telemetry.start('interactionLatencyMs');
        clock = 175;
        expect(finish()).toBe(75);

        telemetry.record('framesPerSecond', 60);
        telemetry.record('framesPerSecond', 45);
        telemetry.record('framesPerSecond', 31);
        expect(telemetry.summary('framesPerSecond').minimum).toBe(31);
    });

    it('rejects invalid metric samples', () => {
        const telemetry = createPerformanceTelemetry();
        expect(() => telemetry.record('cursorLatencyMs', Number.NaN)).toThrow(RangeError);
        expect(() => telemetry.record('framesPerSecond', -1)).toThrow(RangeError);
    });
});
