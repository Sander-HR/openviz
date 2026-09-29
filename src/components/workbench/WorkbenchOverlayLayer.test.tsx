import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// US2 (user refinement): the floating selection toolbar is a media-node
// surface — it renders for image/video/media nodes only, never for
// generation nodes (render/modify/animate/variate/new-view/extract). The
// right-click more menu remains available on every node type.

const { storeState } = vi.hoisted(() => ({
    storeState: {
        workbenchNodes: [] as Array<Record<string, unknown>>,
        selectedNodeIds: [] as string[],
        activeNodeId: null as string | null,
        reorderWorkbenchNode: () => undefined,
        copyToClipboard: () => undefined,
        duplicateWorkbenchNode: () => undefined,
        removeWorkbenchNode: () => undefined,
        updateWorkbenchNode: () => undefined,
        openNodeInStudio: () => undefined,
    },
}));

vi.mock('@/store/useStore', () => ({
    useStore: (selector?: (state: typeof storeState) => unknown) =>
        selector ? selector(storeState) : storeState,
}));

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    };
});

import { WorkbenchOverlayLayer } from './WorkbenchOverlayLayer';

const noop = () => undefined;

const project = {
    id: 'project-1',
    name: 'Project',
    createdAt: 0,
    lastModifiedAt: 0,
    canvas: { width: 512, height: 512, aspectRatio: 'square' as const, zoomLevel: 1, panX: 0, panY: 0, backgroundColor: '#ffffff' },
    layers: [],
    thumbnail: 'https://example.com/1.png',
};

function renderLayer() {
    return render(
        <div className="relative h-screen w-screen">
            <WorkbenchOverlayLayer contextMenu={null} onCloseContextMenu={noop} contextNodes={[]} onPaste={noop} onPasteImage={noop} />
        </div>,
    );
}

afterEach(() => {
    cleanup();
    storeState.workbenchNodes = [];
    storeState.selectedNodeIds = [];
    storeState.activeNodeId = null;
});

function select(node: Record<string, unknown>) {
    storeState.workbenchNodes = [node];
    storeState.selectedNodeIds = [node.id as string];
    storeState.activeNodeId = node.id as string;
}

describe('WorkbenchOverlayLayer toolbar gating', () => {
    it('shows the selection toolbar for image nodes', () => {
        select({ id: 'img-1', type: 'image', x: 0, y: 0, width: 280, height: 160, name: 'Image', project });
        const { container } = renderLayer();

        expect(container.querySelector('[title="Edit"]')).toBeTruthy();
    });

    it('shows the selection toolbar for media nodes', () => {
        select({ id: 'media-1', type: 'media', x: 0, y: 0, width: 280, height: 160, data: { src: 'https://example.com/1.jpg', alt: 'Media', mimeType: 'image/jpeg' } });
        const { container } = renderLayer();

        expect(container.querySelector('[title="Edit"]')).toBeTruthy();
    });

    it('does not show the selection toolbar for render nodes', () => {
        select({ id: 'render-1', type: 'render', x: 0, y: 0, width: 280, height: 160 });
        const { container } = renderLayer();

        expect(container.querySelector('[title="Edit"]')).toBeNull();
    });

    it('does not show the selection toolbar for modify nodes', () => {
        select({ id: 'modify-1', type: 'modify', x: 0, y: 0, width: 280, height: 160 });
        const { container } = renderLayer();

        expect(container.querySelector('[title="Edit"]')).toBeNull();
    });
});
