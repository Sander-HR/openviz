export type CollaborationPerformanceMetric =
    | 'documentSyncMs'
    | 'cursorLatencyMs'
    | 'interactionLatencyMs'
    | 'framesPerSecond'
    | 'cursorUpdatesPerSecond'
    | 'cursorOnlyGraphRenders';

export interface PerformanceMetricSummary {
    count: number;
    minimum: number;
    maximum: number;
    average: number;
    p95: number;
}

import * as Y from 'yjs';
import type { SceneDocCommands } from './sceneDocCommands';

export interface BrowserCollabBenchControl {
    readonly ready: boolean;
    markReady(): void;
    start(nodeId: string, intervalMs?: number): void;
    readonly editsMade: number;
    stop(): void;
    cleanup(): void;
}

declare global {
    interface Window {
        __openvizCollabBenchControl?: BrowserCollabBenchControl;
    }
}

export interface BrowserCollaborationMetricSample {
    metric: CollaborationPerformanceMetric;
    value: number;
    timestamp: number;
}

export interface PerformanceTelemetry {
    record(metric: CollaborationPerformanceMetric, value: number): void;
    start(metric: CollaborationPerformanceMetric): () => number;
    summary(metric: CollaborationPerformanceMetric): PerformanceMetricSummary;
    reset(): void;
}

export interface CollabBenchGraphController extends BrowserCollabBenchControl {
    moveNode(nodeId: string, sequence: number): boolean;
}

export function createCollabBenchGraphController(
    doc: Y.Doc,
    origin: string,
    moveNodes: SceneDocCommands['moveNodes'],
    now: () => number = Date.now,
): CollabBenchGraphController {
    const originalXByNode = new Map<string, number>();
    let sequence = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let ready = false;
    let editsMade = 0;
    const controller: CollabBenchGraphController = {
        get ready() { return ready; },
        get editsMade() { return editsMade; },
        markReady() { ready = true; },
        moveNode(nodeId, nextSequence) {
            const node = doc.getMap('nodes').get(nodeId);
            if (!(node instanceof Y.Map)) return false;
            const x = Number(node.get('x') ?? 0);
            if (!originalXByNode.has(nodeId)) originalXByNode.set(nodeId, x);
            const originalX = originalXByNode.get(nodeId) ?? x;
            let applied = false;
            doc.transact(() => {
                applied = moveNodes([{ id: nodeId, x: originalX + (nextSequence % 2 === 0 ? 2 : 1), y: Number(node.get('y') ?? 0) }]);
                if (applied) doc.getMap('metadata').set('__collabBench', { sentAt: now(), sequence: nextSequence });
            }, origin);
            if (applied) editsMade += 1;
            return applied;
        },
        start(nodeId, intervalMs = 1000) {
            controller.stop();
            sequence = 0;
            timer = setInterval(() => controller.moveNode(nodeId, ++sequence), intervalMs);
        },
        stop() {
            if (timer) clearInterval(timer);
            timer = null;
        },
        cleanup() {
            controller.stop();
            if (originalXByNode.size === 0) return;
            doc.transact(() => {
                for (const [nodeId, x] of originalXByNode) {
                    const node = doc.getMap('nodes').get(nodeId);
                    if (node instanceof Y.Map) node.set('x', x);
                }
                doc.getMap('metadata').delete('__collabBench');
            }, origin);
            originalXByNode.clear();
        },
    };
    return controller;
}

export function installBrowserCollabBenchControl(doc: Y.Doc, origin: string, commands: SceneDocCommands): () => void {
    if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('collabPerf') !== '1') return () => {};
    const controller = createCollabBenchGraphController(doc, origin, commands.moveNodes);
    window.__openvizCollabBenchControl = controller;
    return () => {
        controller.cleanup();
        delete window.__openvizCollabBenchControl;
    };
}

export function emitBrowserCollaborationMetric(metric: CollaborationPerformanceMetric, value: number): void {
    if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('collabPerf') !== '1') return;
    window.dispatchEvent(new CustomEvent<BrowserCollaborationMetricSample>('openviz:collab-perf', {
        detail: { metric, value, timestamp: Date.now() },
    }));
}

export function createPerformanceTelemetry(now: () => number = () => performance.now()): PerformanceTelemetry {
    const samples = new Map<CollaborationPerformanceMetric, number[]>();

    return {
        record(metric, value) {
            if (!Number.isFinite(value) || value < 0) throw new RangeError('Performance samples must be finite and non-negative');
            const metricSamples = samples.get(metric) ?? [];
            metricSamples.push(value);
            samples.set(metric, metricSamples);
        },
        start(metric) {
            const startedAt = now();
            return () => {
                const duration = now() - startedAt;
                this.record(metric, duration);
                return duration;
            };
        },
        summary(metric) {
            const values = [...(samples.get(metric) ?? [])].sort((a, b) => a - b);
            const count = values.length;
            if (count === 0) return { count: 0, minimum: 0, maximum: 0, average: 0, p95: 0 };
            const total = values.reduce((sum, value) => sum + value, 0);
            const p95Index = Math.max(0, Math.ceil(count * 0.95) - 1);
            return {
                count,
                minimum: values[0],
                maximum: values[count - 1],
                average: total / count,
                p95: values[p95Index],
            };
        },
        reset() {
            samples.clear();
        },
    };
}
