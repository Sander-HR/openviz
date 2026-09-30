/**
 * Perf measurement harness for workbench benchmarking (spec 009).
 * Injected into the page via: agent-browser eval "$(cat scripts/perf/inject-harness.js)"
 *
 * Measures frame deltas (rAF) + long tasks (PerformanceObserver, single shared
 * observer — re-registering per run double-counts entries).
 * NOTE: always run in a HEADED browser; headless Chromium throttles rAF to
 * ~12fps even at idle and corrupts FPS metrics. Long-task durations are the
 * primary lag signal (independent of rAF cadence).
 */
(() => {
    if (window.__perf) return 'already installed';
    window.__perf = { frames: [], longTasks: [], running: false, lastTs: null };

    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            window.__perf.longTasks.push(Math.round(entry.duration));
        }
    });
    try {
        observer.observe({ entryTypes: ['longtask'] });
    } catch {
        /* longtask unsupported — frame metrics still work */
    }

    function loop(ts) {
        const p = window.__perf;
        if (p.lastTs !== null) p.frames.push(ts - p.lastTs);
        p.lastTs = ts;
        if (p.running) requestAnimationFrame(loop);
        else p.running = false;
    }

    window.__perf.start = () => {
        const p = window.__perf;
        p.frames = [];
        p.longTasks = [];
        p.lastTs = null;
        p.running = true;
        requestAnimationFrame(loop);
    };

    window.__perf.stop = () => {
        const p = window.__perf;
        p.running = false;
        const fs = p.frames.filter((f) => f < 1000).sort((a, b) => a - b);
        const n = fs.length || 1;
        const total = fs.reduce((a, b) => a + b, 0);
        return JSON.stringify({
            frames: fs.length,
            avgFps: Math.round((1000 / (total / n)) * 100) / 100,
            p95FrameMs: Math.round(fs[Math.floor(n * 0.95)] * 10) / 10,
            worstFrameMs: Math.round(fs[fs.length - 1] * 10) / 10,
            droppedFrames: fs.filter((f) => f > 34).length,
            longTasks: p.longTasks,
        });
    };

    return 'installed';
})();
