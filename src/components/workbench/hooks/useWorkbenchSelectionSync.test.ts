import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Node } from '@xyflow/react';

import { useStore } from '@/store/useStore';
import { useWorkbenchSelectionSync, type SelectionSyncSetNodes } from './useWorkbenchSelectionSync';

function flowNodes(ids: string[]): Node[] {
    return ids.map((id) => ({ id, type: 'textNode', position: { x: 0, y: 0 }, data: {} }));
}

function resetSelection(): void {
    useStore.setState({ selectedNodeIds: [], activeNodeId: null, nodeLocks: {} });
}

afterEach(() => act(resetSelection));

describe('useWorkbenchSelectionSync', () => {
    it('mirrors React Flow selection into Zustand without writing back to React Flow', () => {
        const setNodes = vi.fn<SelectionSyncSetNodes>();
        const { result } = renderHook(() => useWorkbenchSelectionSync({ setNodes }));

        act(() => {
            result.current.onSelectionChange({ nodes: flowNodes(['a', 'b']), edges: [] });
        });

        expect(useStore.getState().selectedNodeIds).toEqual(['a', 'b']);
        expect(setNodes).not.toHaveBeenCalled();
    });

    it('drops remotely locked nodes from the mirrored selection', () => {
        useStore.setState({ nodeLocks: { b: { nodeId: 'b', userId: 'peer', userName: 'Peer' } } });
        const { result } = renderHook(() => useWorkbenchSelectionSync());

        act(() => {
            result.current.onSelectionChange({ nodes: flowNodes(['a', 'b']), edges: [] });
        });

        expect(useStore.getState().selectedNodeIds).toEqual(['a']);
    });

    it('writes programmatic selection to Zustand and React Flow together', () => {
        const setNodes = vi.fn<SelectionSyncSetNodes>();
        const { result } = renderHook(() => useWorkbenchSelectionSync({ setNodes }));

        act(() => result.current.setSelection(['a', 'b']));

        expect(useStore.getState().selectedNodeIds).toEqual(['a', 'b']);
        expect(useStore.getState().activeNodeId).toBe('b');
        expect(setNodes).toHaveBeenCalledTimes(1);

        const updater = setNodes.mock.calls[0]?.[0];
        expect(typeof updater).toBe('function');
        if (typeof updater !== 'function') return;

        const selected = updater(flowNodes(['a', 'b', 'c']));
        expect(selected.map((node) => [node.id, node.selected])).toEqual([
            ['a', true],
            ['b', true],
            ['c', false],
        ]);
    });

    it('synchronizes store-originated programmatic selection changes', () => {
        const setNodes = vi.fn<SelectionSyncSetNodes>();
        renderHook(() => useWorkbenchSelectionSync({ setNodes }));

        act(() => useStore.getState().setSelectedNodeIds(['created-node']));

        expect(setNodes).toHaveBeenCalledTimes(1);
    });
});
