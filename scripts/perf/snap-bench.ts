/**
 * Micro-benchmark for the workbench node-snap hot path (spec 009 FR-005).
 *
 * Measures per-frame cost of `findBestSnap` (drag) and `findBestResizeSnap`
 * (resize) as a function of static-node count, plus the one-time
 * `buildSnapTargets` cost at gesture start. Pure math — no React involved.
 *
 * Usage: pnpm exec tsx scripts/perf/snap-bench.ts
 */

import { buildSnapTargets, findBestResizeSnap, findBestSnap, type NodeBounds, type SnapNodeLike } from '../../src/components/workbench/hooks/nodeSnapLogic';

const NODE_COUNTS = [50, 200, 1000] as const;
const FRAMES = 600; // ~10s of dragging at 60fps
const THRESHOLD_FLOW_PX = 8; // matches SNAP_THRESHOLD_SCREEN_PX at zoom=1

let seed = 42;
function rand(): number {
    // Deterministic LCG so runs are comparable.
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
}

/** Scatters N static nodes across a large canvas area. */
function makeScene(count: number, spread: number): SnapNodeLike[] {
    const nodes: SnapNodeLike[] = [];
    for (let i = 0; i < count; i++) {
        const width = 120 + rand() * 280;
        const height = 100 + rand() * 240;
        nodes.push({
            id: `n${i}`,
            position: { x: (rand() - 0.5) * spread, y: (rand() - 0.5) * spread },
            width,
            height,
        });
    }
    return nodes;
}

/** Dense scene: every node's lines cluster near the dragged node's path. */
function makeDenseScene(count: number): SnapNodeLike[] {
    const nodes: SnapNodeLike[] = [];
    for (let i = 0; i < count; i++) {
        // Jitter a few flow-px around x=0 so many lines land inside the threshold.
        nodes.push({
            id: `d${i}`,
            position: { x: -120 + rand() * 4, y: (rand() - 0.5) * 400 },
            width: 200 + rand() * 40,
            height: 120,
        });
    }
    return nodes;
}

function timeFrames(fn: () => void, frames: number): { meanUs: number; p99Us: number; totalMs: number } {
    const samples: number[] = [];
    let total = 0;
    for (let i = 0; i < frames; i++) {
        const t0 = performance.now();
        fn();
        const dt = performance.now() - t0;
        samples.push(dt);
        total += dt;
    }
    samples.sort((a, b) => a - b);
    return {
        meanUs: (total / frames) * 1000,
        p99Us: samples[Math.floor(frames * 0.99)] * 1000,
        totalMs: total,
    };
}

function benchDrag(count: number, dense: boolean): void {
    const scene = dense ? makeDenseScene(count) : makeScene(count, count * 40);
    const targets = buildSnapTargets(scene);
    const startBounds: NodeBounds = { x: -2000, y: -1000, width: 200, height: 100 };

    // Simulate a drag: the node walks across the scene in ~2px steps.
    let x = startBounds.x;
    const step = (count * 40) / FRAMES + 2;
    const run = () => {
        x += step;
        findBestSnap({ ...startBounds, x }, targets, THRESHOLD_FLOW_PX);
    };
    const r = timeFrames(run, FRAMES);
    console.log(
        `drag   n=${String(count).padStart(4)} ${dense ? 'dense' : 'spread'}  mean=${r.meanUs.toFixed(1)}us  p99=${r.p99Us.toFixed(1)}us  ${FRAMES}frames=${r.totalMs.toFixed(2)}ms`,
    );
}

function benchResize(count: number, dense: boolean): void {
    const scene = dense ? makeDenseScene(count) : makeScene(count, count * 40);
    const targets = buildSnapTargets(scene);
    let width = 100;
    const run = () => {
        width += 2;
        findBestResizeSnap({ x: -120, y: -60, width, height: 120 }, { x: true, y: false }, { x: true, y: false }, targets, THRESHOLD_FLOW_PX);
    };
    const r = timeFrames(run, FRAMES);
    console.log(
        `resize n=${String(count).padStart(4)} ${dense ? 'dense' : 'spread'}  mean=${r.meanUs.toFixed(1)}us  p99=${r.p99Us.toFixed(1)}us  ${FRAMES}frames=${r.totalMs.toFixed(2)}ms`,
    );
}

function benchTargetBuild(count: number): void {
    const scene = makeScene(count, count * 40);
    const r = timeFrames(() => buildSnapTargets(scene), 100);
    console.log(`targets n=${String(count).padStart(4)}            mean=${r.meanUs.toFixed(1)}us (once per gesture start)`);
}

console.log('snap-bench: hot-path cost per frame (60fps budget = 16.7ms)\n');
for (const count of NODE_COUNTS) {
    benchTargetBuild(count);
    benchDrag(count, false);
    benchResize(count, false);
}
console.log('\ndense worst case (many lines inside threshold → sort + guides stressed):');
for (const count of NODE_COUNTS) {
    benchDrag(count, true);
    benchResize(count, true);
}
