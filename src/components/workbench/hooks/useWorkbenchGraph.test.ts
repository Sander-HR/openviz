import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import type {
    ExtractWorkbenchNode,
    NewViewWorkbenchNode,
    NodeLockState,
    NoteWorkbenchNode,
    SectionWorkbenchNode,
    TextWorkbenchNode,
    VariateWorkbenchNode,
    WorkbenchNode,
} from '@/types';
import { useWorkbenchGraph } from './useWorkbenchGraph';

const text: TextWorkbenchNode = { id: 'n1', type: 'text', x: 0, y: 0, data: { text: 'a', fontSize: 14, color: '#fff' } };
const note: NoteWorkbenchNode = { id: 'n2', type: 'note', x: 5, y: 5, data: { text: 'b', colorVariant: 'yellow' } };

function renderGraph(nodeLocks: Record<string, NodeLockState> = {}, workbenchNodes: WorkbenchNode[] = [text, note]) {
    const options = {
        workbenchNodes,
        connections: [],
        selectedNodeIds: ['n1'],
        nodeLocks,
        handleSourceClick: vi.fn(),
        handleResize: vi.fn(),
        handleResizeEnd: vi.fn(),
        handleTransientDataChange: vi.fn(),
        handleGestureStart: vi.fn(),
        handleGestureEnd: vi.fn(),
        handleDataChange: vi.fn(),
    };
    return renderHook(() => useWorkbenchGraph(options));
}

describe('useWorkbenchGraph remote soft locks (spec FR-015)', () => {
    it('marks remotely locked nodes as not selectable and not draggable', () => {
        const { result } = renderGraph({
            n1: { nodeId: 'n1', userId: 'u-2', userName: 'Grace' },
        });

        const [locked, unlocked] = result.current.nodes;
        expect(locked).toMatchObject({ id: 'n1', selectable: false, draggable: false });
        expect(unlocked).toMatchObject({ id: 'n2', selectable: true, draggable: true });
    });

    it('leaves every node interactive when no remote locks exist', () => {
        const { result } = renderGraph();

        for (const node of result.current.nodes) {
            expect(node.selectable).toBe(true);
            expect(node.draggable).toBe(true);
        }
    });
});

describe('useWorkbenchGraph node-type mapping (US3 T036)', () => {
    it('maps the new generation/section types to their own flow node types', () => {
        const variate: VariateWorkbenchNode = { id: 'v1', type: 'variate', x: 0, y: 0, data: { prompt: '', count: 4 } };
        const newView: NewViewWorkbenchNode = { id: 'nv1', type: 'new-view', x: 0, y: 0, data: { prompt: '', view: null } };
        const extract: ExtractWorkbenchNode = { id: 'ex1', type: 'extract', x: 0, y: 0, data: { prompt: '', backgroundHandling: 'keep' } };
        const section: SectionWorkbenchNode = { id: 's1', type: 'section', x: 0, y: 0, data: { label: 'Section' } };

        const { result } = renderGraph({}, [variate, newView, extract, section]);

        expect(result.current.nodes.map((n) => n.type)).toEqual([
            'variateNode',
            'newViewNode',
            'extractNode',
            'sectionNode',
        ]);
    });
});
