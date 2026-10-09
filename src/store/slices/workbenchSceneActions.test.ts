import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageNode } from '@/types';
import { useStore } from '../useStore';

function testProject(thumbnail: string) {
    return {
        id: 'p1',
        name: 'P',
        createdAt: 1,
        lastModifiedAt: 1,
        canvas: {
            width: 100,
            height: 100,
            aspectRatio: 'square' as const,
            zoomLevel: 1,
            panX: 0,
            panY: 0,
            backgroundColor: '#000',
        },
        layers: [],
        thumbnail,
    };
}

function testImageNode(id: string) {
    return {
        id,
        type: 'image' as const,
        name: 'n',
        x: 0,
        y: 0,
        width: 256,
        height: 256,
        scale: 1,
        project: testProject('/api/assets/old-thumb'),
        projectId: 'proj-1',
        renderResults: [],
    };
}

describe('saveCurrentToWorkbench (refs-only contract)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
        vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as never);
        useStore.setState({
            project: testProject('/api/assets/old-thumb'),
            activeNodeId: 'n1',
            workbenchNodes: [testImageNode('n1')],
            currentProjectId: 'proj-1',
            collabSessionActive: false,
            renderResults: [],
        } as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('writes the S3 ref onto the node project and PATCHes projects/[id]', () => {
        useStore.getState().saveCurrentToWorkbench('/api/assets/new-thumb');

        const node = useStore.getState().workbenchNodes.find((n) => n.id === 'n1') as unknown as ImageNode;
        expect(node.project.thumbnail).toBe('/api/assets/new-thumb');

        const patchCall = fetchMock.mock.calls.find(
            (c) => String(c[0]).startsWith('/api/projects/proj-1') && String(c[1]?.body ?? '').includes('thumbnailUrl'),
        );
        expect(patchCall).toBeDefined();
        expect(JSON.parse(String(patchCall![1].body))).toEqual({ thumbnailUrl: '/api/assets/new-thumb' });
    });

    it('keeps the previous thumbnail and skips the PATCH when the ref is null (S3 down)', () => {
        useStore.getState().saveCurrentToWorkbench(null);

        const node = useStore.getState().workbenchNodes.find((n) => n.id === 'n1') as unknown as ImageNode;
        expect(node.project.thumbnail).toBe('/api/assets/old-thumb');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
