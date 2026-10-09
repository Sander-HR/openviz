import { describe, expect, it } from 'vitest';
import type { NoteWorkbenchNode } from '@/types';
import type { WorkbenchHistorySnapshot } from './storeTypes';
import {
    areWorkbenchSnapshotsEqual,
    createWorkbenchGestureTransaction,
    getAffectedNodeIds,
} from './workbenchGestureHistory';

const note = (id: string, x = 10, y = 20): NoteWorkbenchNode => ({
    id,
    type: 'note',
    x,
    y,
    data: { text: 'Test', colorVariant: 'yellow' },
});

const snapshot = (nodes: NoteWorkbenchNode[]): WorkbenchHistorySnapshot => ({
    workbenchNodes: nodes,
    connections: [],
    selectedNodeIds: nodes.map((node) => node.id),
    activeNodeId: nodes[0]?.id ?? null,
});

describe('workbench gesture history helpers', () => {
    it('creates a transaction with a cloned start snapshot and unique affected IDs', () => {
        const start = snapshot([note('a')]);
        const transaction = createWorkbenchGestureTransaction('move', 'project-1', start, ['a', 'a'], 123);

        expect(transaction).toMatchObject({
            kind: 'move',
            projectId: 'project-1',
            startedAt: 123,
            affectedNodeIds: ['a'],
        });
        expect(transaction.startSnapshot).toEqual(start);
        expect(transaction.startSnapshot).not.toBe(start);
    });

    it('detects changed and unchanged complete snapshots', () => {
        const start = snapshot([note('a')]);
        expect(areWorkbenchSnapshotsEqual(start, snapshot([note('a')]))).toBe(true);
        expect(areWorkbenchSnapshotsEqual(start, snapshot([note('a', 30, 40)]))).toBe(false);
    });

    it('collects the selected group and always includes the primary node', () => {
        const nodes = [note('a'), note('b'), note('c')];
        expect(getAffectedNodeIds(nodes, ['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    });
});
