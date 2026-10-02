import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Connection as FlowConnection } from '@xyflow/react';
import type { WorkbenchNode } from '@/types';
import type { SceneDocCommands } from '@/services/collab/sceneDocCommands';
import { useWorkbenchConnectionHandlers } from './useWorkbenchConnectionHandlers';

const nodes = [
    { id: 'image-1', type: 'image', x: 0, y: 0 },
    { id: 'render-1', type: 'render', x: 10, y: 10 },
] as unknown as WorkbenchNode[];

describe('useWorkbenchConnectionHandlers collaboration routing', () => {
    it('routes policy-approved connections through one document command', () => {
        const addConnection = vi.fn();
        const applyConnectionChanges = vi.fn(() => true);
        const commands = { applyConnectionChanges } as unknown as SceneDocCommands;
        const options = {
            workbenchNodes: nodes,
            connections: [],
            addConnection,
            removeConnectionFromStore: vi.fn(),
            commands,
        } as Parameters<typeof useWorkbenchConnectionHandlers>[0];
        const { result } = renderHook(() => useWorkbenchConnectionHandlers(options));

        act(() => result.current.handleConnect({ source: 'image-1', target: 'render-1' } as FlowConnection));

        expect(applyConnectionChanges).toHaveBeenCalledWith(
            expect.objectContaining({ from: 'image-1', to: 'render-1', sourceHandle: 'image-source' }),
            [],
        );
        expect(addConnection).not.toHaveBeenCalled();
    });

    it('routes edge deletion through the shared document command', () => {
        const applyConnectionChanges = vi.fn(() => true);
        const removeConnectionFromStore = vi.fn();
        const commands = { applyConnectionChanges } as unknown as SceneDocCommands;
        const options = {
            workbenchNodes: nodes,
            connections: [{ id: 'edge-1', from: 'image-1', to: 'render-1' }],
            addConnection: vi.fn(),
            removeConnectionFromStore,
            commands,
        } as Parameters<typeof useWorkbenchConnectionHandlers>[0];
        const { result } = renderHook(() => useWorkbenchConnectionHandlers(options));

        act(() => result.current.removeConnection('edge-1'));

        expect(applyConnectionChanges).toHaveBeenCalledWith(null, ['edge-1']);
        expect(removeConnectionFromStore).not.toHaveBeenCalled();
    });
});
