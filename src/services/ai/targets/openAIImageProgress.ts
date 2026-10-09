/**
 * Feature 012 — T006 step-level progress polling (split from openAIImageTarget.ts).
 *
 * When capability probing reports the Unsloth `generate-progress` route, poll
 * it while a native generation is in flight and report step-level progress
 * (SC-009 parity with the ComfyUI/video routes). Without telemetry the job
 * stays at 0 until completion jumps to 100. The probe flag comes from
 * `probeEndpointCapabilities().progressTelemetry` — the poll itself is best
 * effort: a failed progress fetch must never fail the generation.
 */

export interface NativeProgressState {
    /** True while the submit request is still in flight. */
    inFlight: boolean;
    /** True when capability probing reported the generate-progress route. */
    telemetry: boolean;
    /** Latest step-level fraction (0–1); null until first successful poll. */
    lastFraction: number | null;
}

const PROGRESS_POLL_INTERVAL_MS = 500;

export interface NativeProgressPoller {
    /** Current progress in percent for the normalized job status. */
    getProgress(): number;
    start(): void;
    stop(): void;
    dispose(): void;
}

type Fetcher = typeof fetch;

/**
 * Create a poller bound to one native generation attempt. The poller owns its
 * interval timer and is single-shot: `start()` before `stop()`/`dispose()`.
 */
export function createNativeProgressPoller(
    state: NativeProgressState,
    endpointRoot: string,
    fetcher: Fetcher,
): NativeProgressPoller {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function pollOnce(): Promise<void> {
        try {
            const response = await fetcher(`${endpointRoot}/api/inference/images/generate-progress`);
            if (!response.ok) return;
            const body = (await response.json()) as { active?: boolean; fraction?: number };
            if (typeof body.fraction === 'number' && Number.isFinite(body.fraction)) {
                state.lastFraction = Math.min(1, Math.max(0, body.fraction));
            }
        } catch {
            // Best effort: progress telemetry must never break the generation.
        }
    }

    function getProgress(): number {
        if (!state.inFlight) return 100;
        if (state.telemetry && state.lastFraction !== null) return Math.round(state.lastFraction * 100);
        return 0;
    }

    function start(): void {
        if (!state.telemetry || timer) return;
        void pollOnce();
        timer = setInterval(() => void pollOnce(), PROGRESS_POLL_INTERVAL_MS);
    }

    function stop(): void {
        if (timer) clearInterval(timer);
        timer = null;
    }

    function dispose(): void {
        stop();
        state.inFlight = false;
        state.lastFraction = null;
    }

    return { getProgress, start, stop, dispose };
}
