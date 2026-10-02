import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { MediaWorkbenchNode, NoteWorkbenchNode } from '@/types';
import { useStore } from '@/store/useStore';
import { useWorkbenchNodeHandlers } from './useWorkbenchNodeHandlers';
import type { SceneDocCommands } from '@/services/collab/sceneDocCommands';

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
    const onTransientPositionChange = vi.fn();
    const openNodeInStudio = vi.fn();
    const options = {
        workbenchNodes: [workbenchNode],
        updateWorkbenchNode,
        updateWorkbenchNodeTransient,
        onTransientPositionChange,
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
        onTransientPositionChange,
        openNodeInStudio,
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
        const setActiveNodeId = vi.fn();
        // The hook options are intentionally replaced through a dedicated render
        // fixture for this interaction contract.
        const { result: paneResult } = renderHook(() => useWorkbenchNodeHandlers({
            workbenchNodes: [note],
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

        expect(setActiveNodeId).toHaveBeenCalledWith(null);
    });

    it('does not intercept React Flow selection changes', () => {
        const { result } = renderHandlers();

        expect(() => {
            act(() => result.current.handleNodesChange([{ id: 'node-2', type: 'select', selected: true }]));
        }).not.toThrow();
    });

    it('routes position changes to local transient positions during drag', () => {
        const { result, updateWorkbenchNode, updateWorkbenchNodeTransient, onTransientPositionChange } = renderHandlers();

        act(() => {
            result.current.handleNodesChange([
                { id: 'note-1', type: 'position', position: { x: 50, y: 60 } },
            ]);
        });

        expect(onTransientPositionChange).not.toHaveBeenCalled();
        expect(updateWorkbenchNodeTransient).not.toHaveBeenCalled();
        expect(updateWorkbenchNode).not.toHaveBeenCalled();
    });
});

describe('useWorkbenchNodeHandlers collaborative document routing', () => {
    function renderCollaborativeHandlers(workbenchNode: NoteWorkbenchNode = note) {
        const updateWorkbenchNode = vi.fn();
        const updateWorkbenchNodeTransient = vi.fn();
        const removeWorkbenchNode = vi.fn();
        const commands = {
            updateNodeFields: vi.fn(),
            deleteNode: vi.fn(() => true),
        } as unknown as SceneDocCommands;
        const options = {
            workbenchNodes: [workbenchNode],
            updateWorkbenchNode,
            updateWorkbenchNodeTransient,
            beginWorkbenchGesture: vi.fn(),
            commitWorkbenchGesture: vi.fn(),
            cancelWorkbenchGesture: vi.fn(),
            removeWorkbenchNode,
            openNodeInStudio: vi.fn(),
            setActiveNodeId: vi.fn(),
            setBasicBlocksMenu: vi.fn(),
            commands,
        } as Parameters<typeof useWorkbenchNodeHandlers>[0];

        return {
            ...renderHook(() => useWorkbenchNodeHandlers(options)),
            commands,
            updateWorkbenchNode,
            updateWorkbenchNodeTransient,
            removeWorkbenchNode,
        };
    }

    it('routes persistent node-data edits through field-level Y.Doc commands', () => {
        const { result, commands, updateWorkbenchNode } = renderCollaborativeHandlers();

        act(() => result.current.handleDataChange('note-1', { text: 'Shared edit' }));

        expect(commands.updateNodeFields).toHaveBeenCalledWith('note-1', [
            { path: ['data', 'text'], value: 'Shared edit' },
        ]);
        expect(updateWorkbenchNode).not.toHaveBeenCalled();
    });

    it('routes node resize completion through one batched document command', () => {
        const { result, commands, updateWorkbenchNodeTransient } = renderCollaborativeHandlers();

        act(() => result.current.handleResizeEnd('note-1', 200, 120, 15, 25));

        expect(updateWorkbenchNodeTransient).toHaveBeenCalledWith('note-1', expect.objectContaining({ width: 200, height: 120 }));
        expect(commands.updateNodeFields).toHaveBeenCalledWith('note-1', expect.arrayContaining([
            { path: ['width'], value: 200 },
            { path: ['height'], value: 120 },
            { path: ['x'], value: 15 },
            { path: ['y'], value: 25 },
        ]));
    });

    it('routes node removal through the document command and cleans local resources', () => {
        const { result, commands, removeWorkbenchNode } = renderCollaborativeHandlers();

        act(() => result.current.handleNodesChange([{ id: 'note-1', type: 'remove' }]));

        expect(commands.deleteNode).toHaveBeenCalledWith('note-1');
        expect(removeWorkbenchNode).toHaveBeenCalledWith('note-1');
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
