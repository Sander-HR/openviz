import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Node, OnSelectionChangeParams } from '@xyflow/react';

import { useStore } from '@/store/useStore';

export type SelectionSyncSetNodes = (
    payload: Node[] | ((nodes: Node[]) => Node[])
) => void;

export interface UseWorkbenchSelectionSyncOptions {
    /**
     * Updates React Flow's internal node store. In the workbench this is
     * backed by the provider store so programmatic selection does not enter
     * the controlled onNodesChange feedback path.
     */
    setNodes?: SelectionSyncSetNodes;
    /** Used to defer the RF write when a newly-created node is not mounted yet. */
    getNodes?: () => Node[];
}

function selectionKey(ids: string[]): string {
    return ids.join('\u0000');
}

/**
 * Keeps React Flow as the owner of interactive selection while mirroring the
 * result into Zustand for overlays, shortcuts, and collaboration awareness.
 * Store-originated selection changes are synchronized in the other direction
 * through the same bridge, without feeding RF's selection callback back into
 * itself during a marquee gesture.
 */
export function useWorkbenchSelectionSync(options: UseWorkbenchSelectionSyncOptions = {}) {
    const { setNodes, getNodes } = options;
    const selectedNodeIds = useStore((state) => state.selectedNodeIds);
    const lastReactFlowSelectionKeyRef = useRef<string | null>(selectionKey(selectedNodeIds));

    const applySelectionToReactFlow = useCallback(
        (ids: string[]) => {
            if (!setNodes) return;
            const selected = new Set(ids);
            setNodes((nodes) => nodes.map((node) => ({ ...node, selected: selected.has(node.id) })));
        },
        [setNodes]
    );

    const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
        const store = useStore.getState();
        const unlocked = params.nodes.map((node) => node.id).filter((id) => !store.nodeLocks[id]);
        const nextKey = selectionKey(unlocked);
        lastReactFlowSelectionKeyRef.current = nextKey;

        if (nextKey === selectionKey(store.selectedNodeIds)) {
            return;
        }

        store.setSelectedNodeIds(unlocked);
        // Keep the controlled node projection aligned at the selection boundary.
        // This is deliberately limited to selection events, not onNodesChange,
        // so dragging still avoids rebuilding the graph on every pointer move.
        applySelectionToReactFlow(unlocked);
    }, [applySelectionToReactFlow]);

    const setSelection = useCallback(
        (ids: string[]) => {
            const store = useStore.getState();
            const unlocked = ids.filter((id) => !store.nodeLocks[id]);
            const currentNodes = getNodes?.();
            const selectionCanBeApplied = !currentNodes || unlocked.every((id) => currentNodes.some((node) => node.id === id));
            lastReactFlowSelectionKeyRef.current = selectionCanBeApplied ? selectionKey(unlocked) : null;
            store.setSelectedNodeIds(unlocked);
            applySelectionToReactFlow(unlocked);
        },
        [applySelectionToReactFlow, getNodes]
    );

    useEffect(() => {
        const store = useStore.getState();
        const unlocked = selectedNodeIds.filter((id) => !store.nodeLocks[id]);
        const nextKey = selectionKey(unlocked);

        if (lastReactFlowSelectionKeyRef.current === nextKey) {
            lastReactFlowSelectionKeyRef.current = null;
            return;
        }

        applySelectionToReactFlow(unlocked);
    }, [applySelectionToReactFlow, selectedNodeIds]);

    return useMemo(() => ({ onSelectionChange, setSelection }), [onSelectionChange, setSelection]);
}
