import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { Connection, WorkbenchNode } from '@/types';
import type { SceneDataJson } from '@/types/collab.types';
import { useStore } from '@/store/useStore';
import { getSceneName } from '@/services/collab/sceneDocMapping';
import { createSceneDocProjection } from '@/services/collab/sceneDocProjection';
import { emitBrowserCollaborationMetric } from '@/services/collab/performanceTelemetry';

export interface UseWorkbenchGraphProjectionOptions {
    doc: Y.Doc | null;
    enabled: boolean;
}

export interface WorkbenchGraphProjection {
    sceneName: string | undefined;
}

function valuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((value, index) => valuesEqual(value, right[index]));
    }
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && valuesEqual(leftRecord[key], rightRecord[key]));
}

function reuseUnchanged<T extends { id: string }>(projected: T[], current: T[]): T[] {
    const currentById = new Map(current.map((value) => [value.id, value]));
    return projected.map((value) => {
        const previous = currentById.get(value.id);
        return previous && valuesEqual(previous, value) ? previous : value;
    });
}

function projectScene(scene: SceneDataJson): void {
    const state = useStore.getState();
    const activeIds = new Set(state.activeWorkbenchGesture?.affectedNodeIds ?? []);
    const protectedNodes = scene.nodes.map((node) => {
        if (!activeIds.has(node.id)) return node;
        const activeNode = state.workbenchNodes.find(({ id }) => id === node.id);
        return activeNode ? { ...node, x: activeNode.x, y: activeNode.y } : node;
    });

    state.projectCollaborativeGraph(
        reuseUnchanged(protectedNodes as unknown as WorkbenchNode[], state.workbenchNodes),
        reuseUnchanged(scene.connections as unknown as Connection[], state.connections),
    );
}

export function useWorkbenchGraphProjection({ doc, enabled }: UseWorkbenchGraphProjectionOptions): WorkbenchGraphProjection {
    const [sceneName, setSceneName] = useState<string | undefined>(() => (doc ? getSceneName(doc) : undefined));
    const lastBenchSequenceRef = useRef<number | null>(null);

    useEffect(() => {
        if (!doc || !enabled) return;

        const projection = createSceneDocProjection(doc);
        const project = (): void => {
            const snapshot = projection.snapshot();
            projectScene(snapshot.scene);
            setSceneName(snapshot.sceneName);
            const signal = doc.getMap('metadata').get('__collabBench');
            if (signal && typeof signal === 'object' && 'sentAt' in signal && 'sequence' in signal) {
                const sentAt = signal.sentAt;
                const sequence = signal.sequence;
                if (typeof sentAt === 'number' && typeof sequence === 'number' && sequence !== lastBenchSequenceRef.current) {
                    lastBenchSequenceRef.current = sequence;
                    emitBrowserCollaborationMetric('documentSyncMs', Math.max(0, Date.now() - sentAt));
                    requestAnimationFrame(() => emitBrowserCollaborationMetric('interactionLatencyMs', Math.max(0, Date.now() - sentAt)));
                }
            }
        };
        project();
        const unsubscribe = projection.subscribe(project);
        return () => {
            unsubscribe();
            projection.destroy();
        };
    }, [doc, enabled]);

    return { sceneName };
}
