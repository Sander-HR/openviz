import { describe, expect, it } from 'vitest';
import type { ArrowWorkbenchNode, MediaWorkbenchNode, NoteWorkbenchNode, TextWorkbenchNode } from '@/types';
import { useStore } from '../useStore';

// T005: one-shot creation action (FR-007, C-4.x) — must be atomic:
// append node + select it + switch tool to 'select' in one update.
function textNode(id: string): TextWorkbenchNode {
    return { id, type: 'text', x: 10, y: 20, data: { text: 'hello', fontSize: 16, color: '#fff' } };
}

function noteNode(id: string): NoteWorkbenchNode {
    return { id, type: 'note', x: 30, y: 40, data: { text: 'sticky', colorVariant: 'yellow' } };
}

function arrowNode(id: string): ArrowWorkbenchNode {
    return {
        id,
        type: 'arrow',
        x: 50,
        y: 60,
        data: {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
            control: { x: 50, y: -20 },
            strokeColor: '#fff',
            strokeWidth: 3,
        },
    };
}

function mediaNode(id: string): MediaWorkbenchNode {
    return { id, type: 'media', x: 70, y: 80, width: 260, height: 180, data: { src: 'blob:http://localhost/abc', alt: 'pic.png', mimeType: 'image/png' } };
}

describe('createOneShotNode (FR-007)', () => {
    it.each([
        ['text', textNode],
        ['note', noteNode],
        ['arrow', arrowNode],
        ['media', mediaNode],
    ] as const)('appends a %s node, selects it, and switches tool to select', (_label, factory) => {
        const id = `one-shot-${Math.random().toString(36).slice(2)}`;
        const store = useStore.getState();

        // Put the store in a one-shot tool state first (as if the user picked the tool)
        store.setActiveWorkbenchTool('text');
        expect(useStore.getState().activeWorkbenchTool).toBe('text');

        store.createOneShotNode(factory(id));

        const next = useStore.getState();
        expect(next.workbenchNodes.some((n) => n.id === id)).toBe(true);
        expect(next.activeNodeId).toBe(id);
        expect(next.selectedNodeIds).toEqual([id]);
        expect(next.activeWorkbenchTool).toBe('select');
    });

    it('switches from any one-shot tool, not just text', () => {
        const id = `one-shot-any-${Math.random().toString(36).slice(2)}`;
        const store = useStore.getState();
        store.setActiveWorkbenchTool('media');
        store.createOneShotNode(mediaNode(id));
        expect(useStore.getState().activeWorkbenchTool).toBe('select');
    });
});

// T017: sticky tools (FR-006, C-2.1) — stroke completion and erase gestures
// must NOT reset the active tool; draw/eraser switch directly.
import type { FreehandNode as FreehandNodeType } from '@/types';

function freehandNode(id: string): FreehandNodeType {
    return {
        id,
        type: 'freehand',
        x: 0,
        y: 0,
        width: 100,
        height: 40,
        data: { path: 'M 0 20 L 100 20', width: 100, height: 40, color: '#111827', strokeWidth: 4 },
    };
}

describe('sticky tools (FR-006)', () => {
    it('completing a freehand stroke keeps the draw tool active', () => {
        const store = useStore.getState();
        store.setActiveWorkbenchTool('draw');
        const id = `stroke-${Math.random().toString(36).slice(2)}`;

        // What the view layer does on stroke completion: add node + select it.
        store.addWorkbenchNode(freehandNode(id));
        store.setSelectedNodeIds([id]);

        expect(useStore.getState().workbenchNodes.some((n) => n.id === id)).toBe(true);
        expect(useStore.getState().activeWorkbenchTool).toBe('draw');
    });

    it('an erase gesture (node removal) keeps the eraser tool active', () => {
        const store = useStore.getState();
        store.setActiveWorkbenchTool('eraser');
        const id = `erase-target-${Math.random().toString(36).slice(2)}`;
        store.addWorkbenchNode(freehandNode(id));

        store.removeWorkbenchNode(id);

        expect(useStore.getState().workbenchNodes.some((n) => n.id === id)).toBe(false);
        expect(useStore.getState().activeWorkbenchTool).toBe('eraser');
    });

    it('draw and eraser switch directly in both directions (C-2.1)', () => {
        const store = useStore.getState();
        store.setActiveWorkbenchTool('select');

        store.setActiveWorkbenchTool('draw');
        expect(useStore.getState().activeWorkbenchTool).toBe('draw');

        store.setActiveWorkbenchTool('eraser');
        expect(useStore.getState().activeWorkbenchTool).toBe('eraser');

        store.setActiveWorkbenchTool('draw');
        expect(useStore.getState().activeWorkbenchTool).toBe('draw');
    });
});

// T021: object-URL lifecycle (R4) — removing a media node whose src is a
// blob: URL must revoke it; non-blob srcs are untouched. No leak across
// add/remove cycles.
import { vi } from 'vitest';

describe('removeWorkbenchNode object-URL revocation (FR-012 edge)', () => {
    it('revokes blob: sources when a media node is removed', () => {
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        try {
            const store = useStore.getState();
            const id = `media-rev-${Math.random().toString(36).slice(2)}`;
            store.addWorkbenchNode(mediaNode(id)); // src: blob:http://localhost/abc

            store.removeWorkbenchNode(id);

            expect(useStore.getState().workbenchNodes.some((n) => n.id === id)).toBe(false);
            expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/abc');
        } finally {
            revokeSpy.mockRestore();
        }
    });

    it('does not revoke non-blob sources', () => {
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        try {
            const store = useStore.getState();
            const id = `media-https-${Math.random().toString(36).slice(2)}`;
            store.addWorkbenchNode({
                ...mediaNode(id),
                data: { src: 'https://example.com/a.png', alt: 'remote', mimeType: 'image/png' },
            });

            store.removeWorkbenchNode(id);

            expect(revokeSpy).not.toHaveBeenCalled();
        } finally {
            revokeSpy.mockRestore();
        }
    });

    it('does not touch the revoker for non-media nodes', () => {
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        try {
            const store = useStore.getState();
            const id = `text-rev-${Math.random().toString(36).slice(2)}`;
            store.addWorkbenchNode(textNode(id));

            store.removeWorkbenchNode(id);

            expect(revokeSpy).not.toHaveBeenCalled();
        } finally {
            revokeSpy.mockRestore();
        }
    });

    it('revokes each blob src exactly once across add/remove cycles', () => {
        const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        try {
            const store = useStore.getState();
            const idA = `media-cycle-a-${Math.random().toString(36).slice(2)}`;
            const idB = `media-cycle-b-${Math.random().toString(36).slice(2)}`;

            store.addWorkbenchNode(mediaNode(idA));
            store.removeWorkbenchNode(idA);
            store.addWorkbenchNode({ ...mediaNode(idB), data: { src: 'blob:http://localhost/second', alt: 'b', mimeType: 'image/png' } });
            store.removeWorkbenchNode(idB);

            expect(revokeSpy).toHaveBeenCalledTimes(2);
            expect(revokeSpy).toHaveBeenNthCalledWith(1, 'blob:http://localhost/abc');
            expect(revokeSpy).toHaveBeenNthCalledWith(2, 'blob:http://localhost/second');
        } finally {
            revokeSpy.mockRestore();
        }
    });
});

describe('removeWorkbenchNode with remote soft locks (spec FR-015)', () => {
    const graceLock = { nodeId: 'n1', userId: 'u-2', userName: 'Grace' };

    it('skips remotely locked nodes when deleting the whole selection', () => {
        useStore.setState({
            workbenchNodes: [textNode('n1'), noteNode('n2')],
            selectedNodeIds: ['n1', 'n2'],
            nodeLocks: { n1: graceLock },
        });

        useStore.getState().removeWorkbenchNode();

        expect(useStore.getState().workbenchNodes.map((node) => node.id)).toEqual(['n1']);
    });

    it('skips a remotely locked node even when deleted by explicit id', () => {
        useStore.setState({
            workbenchNodes: [textNode('n1')],
            selectedNodeIds: [],
            nodeLocks: { n1: graceLock },
        });

        useStore.getState().removeWorkbenchNode('n1');

        expect(useStore.getState().workbenchNodes.map((node) => node.id)).toEqual(['n1']);
    });

    it('deletes unlocked nodes normally when no remote locks exist', () => {
        useStore.setState({
            workbenchNodes: [textNode('n1'), noteNode('n2')],
            selectedNodeIds: ['n2'],
            nodeLocks: {},
        });

        useStore.getState().removeWorkbenchNode();

        expect(useStore.getState().workbenchNodes.map((node) => node.id)).toEqual(['n1']);
    });
});
