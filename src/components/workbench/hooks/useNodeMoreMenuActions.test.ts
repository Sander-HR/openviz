import { describe, expect, it, vi } from 'vitest';

// T025 (US2): data-driven "more" menu action registry (ui-translation §3.3).
// - groups in order: image / library & references / organization / clipboard / danger-delete
// - shortcut hints for ⌘L, ⌘C, ⌘D, Del, ], [
// - per research R11, actions without an existing backend are disabled WITH a reason
// - multi-selection enables only whole-selection-valid actions

import { useNodeMoreMenuActions } from './useNodeMoreMenuActions';
import type { ImageNode, MediaWorkbenchNode, WorkbenchNode } from '@/types';

function makeImageNode(id: string): ImageNode {
    return {
        id,
        type: 'image',
        x: 0,
        y: 0,
        name: `Image ${id}`,
        project: {
            id: `project-${id}`,
            name: `Project ${id}`,
            createdAt: 0,
            lastModifiedAt: 0,
            canvas: {
                width: 512,
                height: 512,
                aspectRatio: 'square',
                zoomLevel: 1,
                panX: 0,
                panY: 0,
                backgroundColor: '#ffffff',
            },
            layers: [],
            thumbnail: `https://example.com/${id}.png`,
        },
    };
}

function makeMediaNode(id: string): MediaWorkbenchNode {
    return {
        id,
        type: 'media',
        x: 0,
        y: 0,
        data: { src: `https://example.com/${id}.jpg`, alt: `Media ${id}`, mimeType: 'image/jpeg' },
    };
}

function makeOptions(overrides: Partial<ReturnType<typeof baseOptions>> = {}) {
    return { ...baseOptions(), ...overrides };
}

function baseOptions() {
    return {
        nodes: [makeImageNode('img-1')] as WorkbenchNode[],
        reorderWorkbenchNode: vi.fn(),
        copyToClipboard: vi.fn(),
        duplicateWorkbenchNode: vi.fn(),
        removeWorkbenchNode: vi.fn(),
    };
}

function byId(actions: ReturnType<typeof useNodeMoreMenuActions>, id: string) {
    const action = actions.find((candidate) => candidate.id === id);
    if (!action) throw new Error(`missing action ${id}`);
    return action;
}

describe('useNodeMoreMenuActions — grouping (ui-translation §3.3)', () => {
    it('returns the five groups in order: image, library, organization, clipboard, danger', () => {
        const actions = useNodeMoreMenuActions(makeOptions());
        const groups = [...new Set(actions.map((action) => action.group))];
        expect(groups).toEqual(['image', 'library', 'organization', 'clipboard', 'danger']);

        // group order is stable in the returned list
        const order = ['image', 'library', 'organization', 'clipboard', 'danger'];
        for (const action of actions) {
            expect(order.indexOf(action.group)).toBeGreaterThanOrEqual(0);
        }
        const firstOfGroup = new Map<string, number>();
        actions.forEach((action, index) => {
            if (!firstOfGroup.has(action.group)) firstOfGroup.set(action.group, index);
        });
        expect([...firstOfGroup.entries()].sort((a, b) => a[1] - b[1]).map(([group]) => group))
            .toEqual(['image', 'library', 'organization', 'clipboard', 'danger']);
    });

    it('contains the full action set with labels', () => {
        const actions = useNodeMoreMenuActions(makeOptions());
        const labels = actions.map((action) => action.label);
        expect(labels).toEqual(expect.arrayContaining([
            'Remove Background',
            'Download',
            'Export…',
            'Copy raw image',
            'Add to library',
            'Add to reference images',
            'Set as thumbnail',
            'Restore default thumbnail',
            'Wrap in section',
            'Bring to front',
            'Send to back',
            'Copy link to selection',
            'Copy',
            'Duplicate',
            'Delete',
        ]));
    });
});

describe('useNodeMoreMenuActions — shortcut hints', () => {
    it('shows ⌘L, ⌘C, ⌘D, Del, ], [ on the right actions', () => {
        const actions = useNodeMoreMenuActions(makeOptions());
        expect(byId(actions, 'copy-link').shortcut).toBe('⌘L');
        expect(byId(actions, 'copy').shortcut).toBe('⌘C');
        expect(byId(actions, 'duplicate').shortcut).toBe('⌘D');
        expect(byId(actions, 'delete').shortcut).toBe('Del');
        expect(byId(actions, 'bring-to-front').shortcut).toBe(']');
        expect(byId(actions, 'send-to-back').shortcut).toBe('[');
    });

    it('does not invent shortcuts for actions that have none', () => {
        const actions = useNodeMoreMenuActions(makeOptions());
        expect(byId(actions, 'download').shortcut).toBeUndefined();
        expect(byId(actions, 'remove-background').shortcut).toBeUndefined();
    });
});

describe('useNodeMoreMenuActions — R11 backend gating', () => {
    it('disables actions without an existing backend, each with a reason', () => {
        const actions = useNodeMoreMenuActions(makeOptions());
        for (const id of [
            'remove-background',
            'export',
            'add-to-library',
            'add-to-reference-images',
            'set-as-thumbnail',
            'restore-default-thumbnail',
            'wrap-in-section',
            'copy-link',
        ]) {
            const action = byId(actions, id);
            expect(action.enabled, `${id} should be disabled`).toBe(false);
            expect(action.disabledReason, `${id} needs a reason`).toBeTruthy();
        }
    });

    it('enables Download and Copy raw image for nodes with an image source', () => {
        const actions = useNodeMoreMenuActions(makeOptions());
        expect(byId(actions, 'download').enabled).toBe(true);
        expect(byId(actions, 'copy-raw-image').enabled).toBe(true);
    });

    it('disables Download and Copy raw image for nodes without an image source', () => {
        const actions = useNodeMoreMenuActions(makeOptions({
            nodes: [{ id: 'note-1', type: 'note', x: 0, y: 0, data: { text: '', colorVariant: 'yellow' } }] as WorkbenchNode[],
        }));
        expect(byId(actions, 'download').enabled).toBe(false);
        expect(byId(actions, 'copy-raw-image').enabled).toBe(false);
    });

    it('wires enabled actions to the existing store actions', () => {
        const options = makeOptions();
        const actions = useNodeMoreMenuActions(options);

        byId(actions, 'bring-to-front').onClick?.();
        expect(options.reorderWorkbenchNode).toHaveBeenCalledWith('img-1', 'front');

        byId(actions, 'send-to-back').onClick?.();
        expect(options.reorderWorkbenchNode).toHaveBeenCalledWith('img-1', 'back');

        byId(actions, 'copy').onClick?.();
        expect(options.copyToClipboard).toHaveBeenCalled();

        byId(actions, 'duplicate').onClick?.();
        expect(options.duplicateWorkbenchNode).toHaveBeenCalled();

        byId(actions, 'delete').onClick?.();
        expect(options.removeWorkbenchNode).toHaveBeenCalled();
    });

    it('marks Delete as the danger action', () => {
        const actions = useNodeMoreMenuActions(makeOptions());
        expect(byId(actions, 'delete').danger).toBe(true);
    });
});

describe('useNodeMoreMenuActions — multi-selection rules (§5)', () => {
    it('enables whole-selection actions (copy, duplicate, delete) for multiple nodes', () => {
        const actions = useNodeMoreMenuActions(makeOptions({
            nodes: [makeImageNode('img-1'), makeMediaNode('media-2')],
        }));
        expect(byId(actions, 'copy').enabled).toBe(true);
        expect(byId(actions, 'duplicate').enabled).toBe(true);
        expect(byId(actions, 'delete').enabled).toBe(true);
    });

    it('disables per-node-only actions (z-order, download, copy raw) for multiple nodes', () => {
        const actions = useNodeMoreMenuActions(makeOptions({
            nodes: [makeImageNode('img-1'), makeMediaNode('media-2')],
        }));
        for (const id of ['bring-to-front', 'send-to-back', 'download', 'copy-raw-image']) {
            const action = byId(actions, id);
            expect(action.enabled, `${id} should be disabled in multi-selection`).toBe(false);
            expect(action.disabledReason).toBeTruthy();
        }
    });

    it('operates on the whole selection for copy/duplicate/delete', () => {
        const options = makeOptions({ nodes: [makeImageNode('img-1'), makeMediaNode('media-2')] });
        const actions = useNodeMoreMenuActions(options);

        byId(actions, 'copy').onClick?.();
        expect(options.copyToClipboard).toHaveBeenCalledWith(undefined);

        byId(actions, 'duplicate').onClick?.();
        expect(options.duplicateWorkbenchNode).toHaveBeenCalledWith(undefined);

        byId(actions, 'delete').onClick?.();
        expect(options.removeWorkbenchNode).toHaveBeenCalledWith(undefined);
    });
});
