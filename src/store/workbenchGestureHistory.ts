import type { WorkbenchHistorySnapshot } from './storeTypes';
import type { WorkbenchNode } from '@/types';

export type WorkbenchGestureKind = 'move' | 'resize' | 'arrow-handle';

export interface WorkbenchGestureTransaction {
    kind: WorkbenchGestureKind;
    projectId: string | null;
    startedAt: number;
    startSnapshot: WorkbenchHistorySnapshot;
    affectedNodeIds: string[];
}

export const areWorkbenchSnapshotsEqual = (
    first: WorkbenchHistorySnapshot,
    second: WorkbenchHistorySnapshot
): boolean => JSON.stringify(first) === JSON.stringify(second);

export const getAffectedNodeIds = (
    nodes: WorkbenchNode[],
    selectedNodeIds: string[],
    primaryNodeId?: string
): string[] => {
    const selectedIds = new Set(selectedNodeIds);
    if (primaryNodeId) {
        selectedIds.add(primaryNodeId);
    }

    return nodes.filter((node) => selectedIds.has(node.id)).map((node) => node.id);
};

export const createWorkbenchGestureTransaction = (
    kind: WorkbenchGestureKind,
    projectId: string | null,
    startSnapshot: WorkbenchHistorySnapshot,
    affectedNodeIds: string[],
    startedAt = Date.now()
): WorkbenchGestureTransaction => ({
    kind,
    projectId,
    startedAt,
    startSnapshot: structuredClone(startSnapshot),
    affectedNodeIds: [...new Set(affectedNodeIds)],
});
