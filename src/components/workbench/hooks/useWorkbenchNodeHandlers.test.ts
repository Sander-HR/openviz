import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { MediaWorkbenchNode, NoteWorkbenchNode } from '@/types';
import { useStore } from '@/store/useStore';
import { useWorkbenchNodeHandlers } from './useWorkbenchNodeHandlers';

afterEach(() => {
    // Lock guards read the live store — never leak locks between tests.
    useStore.setState({ nodeLocks: {} });
});

const note: NoteWorkbenchNode = {
    id: 'note-1',
    type: 'note',
    x: 10,
    y: 20,
    data: { text: 'Test', colorVariant: 'yellow' },
};

function renderHandlers(workbenchNode: NoteWorkbenchNode | MediaWorkbenchNode = note) {
    const updateWorkbenchNode = vi.fn();
    const updateWorkbenchNodeTransient = vi.fn();
    const openNodeInStudio = vi.fn();
    const options = {
        workbenchNodes: [workbenchNode],
        selectedNodeIds: ['note-1'],
        setSelectedNodeIds: vi.fn(),
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        beginWorkbenchGesture: vi.fn(),
        commitWorkbenchGesture: vi.fn(),
        cancelWorkbenchGesture: vi.fn(),
        removeWorkbenchNode: vi.fn(),
        openNodeInStudio,
        setActiveNodeId: vi.fn(),
        setBasicBlocksMenu: vi.fn(),
    };

    return {
        ...renderHook(() => useWorkbenchNodeHandlers(options)),
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        openNodeInStudio,
        setSelectedNodeIds: options.setSelectedNodeIds,
    };
}

describe('useWorkbenchNodeHandlers gesture updates', () => {
    it('opens uploaded media in the editor on double-click', () => {
        const media: MediaWorkbenchNode = {
            id: 'media-1',
            type: 'media',
            x: 10,
            y: 20,
            data: { src: 'blob:test', alt: 'photo.png', mimeType: 'image/png' },
        };
        const { result, openNodeInStudio } = renderHandlers(media);

        act(() => {
            result.current.handleNodeDoubleClick({} as React.MouseEvent, { id: media.id } as never);
        });

        expect(openNodeInStudio).toHaveBeenCalledWith(media.id);
    });

    it('clears selection and active node when the canvas background is clicked', () => {
        const setSelectedNodeIds = vi.fn();
        const setActiveNodeId = vi.fn();
        // The hook options are intentionally replaced through a dedicated render
        // fixture for this interaction contract.
        const { result: paneResult } = renderHook(() => useWorkbenchNodeHandlers({
            workbenchNodes: [note],
            selectedNodeIds: ['note-1'],
            setSelectedNodeIds,
            updateWorkbenchNode: vi.fn(),
            updateWorkbenchNodeTransient: vi.fn(),
            beginWorkbenchGesture: vi.fn(),
            commitWorkbenchGesture: vi.fn(),
            cancelWorkbenchGesture: vi.fn(),
            removeWorkbenchNode: vi.fn(),
            openNodeInStudio: vi.fn(),
            setActiveNodeId,
            setBasicBlocksMenu: vi.fn(),
        }));

        act(() => paneResult.current.handlePaneClick());

        expect(setSelectedNodeIds).toHaveBeenCalledWith([]);
        expect(setActiveNodeId).toHaveBeenCalledWith(null);
    });

    it('replaces the previous selection when a plain click selects another node', () => {
        const { result, setSelectedNodeIds } = renderHandlers();

        act(() => {
            result.current.handleNodesChange([
                { id: 'note-1', type: 'select', selected: false },
                { id: 'node-2', type: 'select', selected: true },
            ]);
        });

        expect(setSelectedNodeIds).toHaveBeenCalledWith(['node-2']);
    });

    it('preserves the previous selection when Shift adds another node', () => {
        const { result, setSelectedNodeIds } = renderHandlers();

        act(() => {
            result.current.handleNodesChange([
                { id: 'node-2', type: 'select', selected: true },
            ]);
        });

        expect(setSelectedNodeIds).toHaveBeenCalledWith(['note-1', 'node-2']);
    });

    it('routes position changes to transient updates during drag', () => {
        const { result, updateWorkbenchNode, updateWorkbenchNodeTransient } = renderHandlers();

        act(() => {
            result.current.handleNodesChange([
                { id: 'note-1', type: 'position', position: { x: 50, y: 60 } },
            ]);
        });

        expect(updateWorkbenchNodeTransient).toHaveBeenCalledWith('note-1', { x: 50, y: 60 });
        expect(updateWorkbenchNode).not.toHaveBeenCalled();
    });
});

describe('useWorkbenchNodeHandlers remote soft-lock guards (spec FR-015)', () => {
    const graceLock = { nodeId: 'note-1', userId: 'u-2', userName: 'Grace' };

    it('ignores resize on a remotely locked node', () => {
        const beginWorkbenchGesture = vi.fn();
        const updateWorkbenchNodeTransient = vi.fn();
        useStore.setState({ nodeLocks: { 'note-1': graceLock } });

        const options = {
            workbenchNodes: [note],
            selectedNodeIds: ['note-1'],
            setSelectedNodeIds: vi.fn(),
            updateWorkbenchNode: vi.fn(),
            updateWorkbenchNodeTransient,
            beginWorkbenchGesture,
            commitWorkbenchGesture: vi.fn(),
            cancelWorkbenchGesture: vi.fn(),
            removeWorkbenchNode: vi.fn(),
            openNodeInStudio: vi.fn(),
            setActiveNodeId: vi.fn(),
            setBasicBlocksMenu: vi.fn(),
        };
        const { result } = renderHook(() => useWorkbenchNodeHandlers(options));

        act(() => {
            result.current.handleResize('note-1', 300, 200);
        });

        expect(beginWorkbenchGesture).not.toHaveBeenCalled();
        expect(updateWorkbenchNodeTransient).not.toHaveBeenCalled();
    });

    it('ignores double-click editing on a remotely locked media node', () => {
        const media: MediaWorkbenchNode = {
            id: 'media-1',
            type: 'media',
            x: 10,
            y: 20,
            data: { src: 'blob:test', alt: 'photo.png', mimeType: 'image/png' },
        };
        const openNodeInStudio = vi.fn();
        useStore.setState({ nodeLocks: { 'media-1': graceLock } });

        const options = {
            workbenchNodes: [media],
            selectedNodeIds: ['media-1'],
            setSelectedNodeIds: vi.fn(),
            updateWorkbenchNode: vi.fn(),
            updateWorkbenchNodeTransient: vi.fn(),
            beginWorkbenchGesture: vi.fn(),
            commitWorkbenchGesture: vi.fn(),
            cancelWorkbenchGesture: vi.fn(),
            removeWorkbenchNode: vi.fn(),
            openNodeInStudio,
            setActiveNodeId: vi.fn(),
            setBasicBlocksMenu: vi.fn(),
        };
        const { result } = renderHook(() => useWorkbenchNodeHandlers(options));

        act(() => {
            result.current.handleNodeDoubleClick({} as React.MouseEvent, { id: media.id } as never);
        });

        expect(openNodeInStudio).not.toHaveBeenCalled();
    });

    it('ignores data changes on a remotely locked node', () => {
        const updateWorkbenchNode = vi.fn();
        useStore.setState({ nodeLocks: { 'note-1': graceLock } });

        const options = {
            workbenchNodes: [note],
            selectedNodeIds: ['note-1'],
            setSelectedNodeIds: vi.fn(),
            updateWorkbenchNode,
            updateWorkbenchNodeTransient: vi.fn(),
            beginWorkbenchGesture: vi.fn(),
            commitWorkbenchGesture: vi.fn(),
            cancelWorkbenchGesture: vi.fn(),
            removeWorkbenchNode: vi.fn(),
            openNodeInStudio: vi.fn(),
            setActiveNodeId: vi.fn(),
            setBasicBlocksMenu: vi.fn(),
        };
        const { result } = renderHook(() => useWorkbenchNodeHandlers(options));

        act(() => {
            result.current.handleDataChange('note-1', { text: 'tampered' });
        });

        expect(updateWorkbenchNode).not.toHaveBeenCalled();
    });
});
