import { beforeEach, describe, expect, it } from 'vitest';
import { Connection, WorkbenchNode } from '@/types';
import { useStore } from './useStore';

function imageNode(id: string, x = 0): WorkbenchNode {
    return {
        id,
        type: 'image',
        name: id,
        x,
        y: 0,
        project: {
            id,
            name: id,
            createdAt: Date.now(),
            lastModifiedAt: Date.now(),
            canvas: {
                width: 512,
                height: 512,
                aspectRatio: 'square',
                zoomLevel: 1,
                panX: 0,
                panY: 0,
                backgroundColor: '#fff',
            },
            layers: [],
        },
    };
}

function animateNode(id: string, x = 0): WorkbenchNode {
    return {
        id,
        type: 'animate',
        x,
        y: 0,
        data: {
            prompt: '',
            frames: {},
            settings: {
                model: 'default',
                duration: '2s',
            },
        },
    };
}

function renderNode(id: string, x = 0): WorkbenchNode {
    return {
        id,
        type: 'render',
        x,
        y: 0,
        data: {
            prompt: '',
            stylePreset: 'Photorealistic',
            drawingInfluence: 0.5,
            numImages: 1,
        },
    };
}

function videoNode(id: string, x = 0): WorkbenchNode {
    return {
        id,
        type: 'video',
        name: id,
        x,
        y: 0,
        project: {
            id,
            name: id,
            createdAt: Date.now(),
            lastModifiedAt: Date.now(),
            canvas: {
                width: 512,
                height: 512,
                aspectRatio: 'square',
                zoomLevel: 1,
                panX: 0,
                panY: 0,
                backgroundColor: '#000',
            },
            layers: [],
        },
    };
}

describe('workbench store connection policy', () => {
    beforeEach(() => {
        useStore.setState({
            workbenchNodes: [],
            connections: [],
            selectedNodeIds: [],
            activeNodeId: null,
        });
    });

    it('keeps at most two inbound image connections for animate and replaces oldest deterministically', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(imageNode('img-2', 100));
        store.addWorkbenchNode(imageNode('img-3', 200));
        store.addWorkbenchNode(animateNode('anim-1', 300));

        store.addConnection('img-1', 'anim-1');
        store.addConnection('img-2', 'anim-1');
        store.addConnection('img-3', 'anim-1');

        const inbound = useStore.getState().connections
            .filter((connection: Connection) => connection.to === 'anim-1')
            .map((connection: Connection) => connection.from);
        expect(inbound).toEqual(['img-2', 'img-3']);
    });

    it('keeps one inbound image connection for render and replaces oldest deterministically', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(imageNode('img-2', 100));
        store.addWorkbenchNode(renderNode('render-1', 300));

        store.addConnection('img-1', 'render-1');
        store.addConnection('img-2', 'render-1');

        const inbound = useStore.getState().connections
            .filter((connection: Connection) => connection.to === 'render-1');
        expect(inbound).toHaveLength(1);
        expect(inbound[0].from).toBe('img-2');
    });

    it('rejects invalid direction, self, duplicate and video-endpoint connections', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(imageNode('img-2', 100));
        store.addWorkbenchNode(animateNode('anim-1', 200));
        store.addWorkbenchNode(renderNode('render-1', 300));
        store.addWorkbenchNode(videoNode('vid-1', 400));

        store.addConnection('img-1', 'anim-1');
        store.addConnection('img-1', 'anim-1');
        store.addConnection('anim-1', 'render-1');
        store.addConnection('img-1', 'img-2');
        store.addConnection('img-1', 'img-1');
        store.addConnection('vid-1', 'anim-1');
        store.addConnection('img-2', 'vid-1');

        const connections = useStore.getState().connections;
        expect(connections).toHaveLength(1);
        expect(connections[0].from).toBe('img-1');
        expect(connections[0].to).toBe('anim-1');
    });

    it('stores handle ids on new connections', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(animateNode('anim-1', 200));

        store.addConnection('img-1', 'anim-1', 'image-source', 'animate-target-visible');

        const saved = useStore.getState().connections[0];
        expect(saved?.sourceHandle).toBe('image-source');
        expect(saved?.targetHandle).toBe('animate-target-visible');
    });

    it('defaults sourceHandle to image-source for image outbound connections', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(renderNode('render-1', 200));

        store.addConnection('img-1', 'render-1');

        const saved = useStore.getState().connections[0];
        expect(saved?.sourceHandle).toBe('image-source');
        expect(saved?.targetHandle).toBeNull();
    });

    it('normalizes setConnections payloads and removes invalid/orphan/duplicate entries', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(imageNode('img-2', 100));
        store.addWorkbenchNode(imageNode('img-3', 200));
        store.addWorkbenchNode(animateNode('anim-1', 300));
        store.addWorkbenchNode(renderNode('render-1', 400));
        store.addWorkbenchNode(videoNode('vid-1', 500));

        store.setConnections([
            { id: 'c1', from: 'img-1', to: 'anim-1' },
            { id: 'c2', from: 'img-2', to: 'anim-1' },
            { id: 'c3', from: 'img-3', to: 'anim-1' },
            { id: 'c4', from: 'img-1', to: 'anim-1' },
            { id: 'c5', from: 'img-1', to: 'render-1' },
            { id: 'c6', from: 'img-2', to: 'render-1' },
            { id: 'c7', from: 'img-1', to: 'missing' },
            { id: 'c8', from: 'vid-1', to: 'anim-1' },
            { id: 'c9', from: 'anim-1', to: 'render-1' },
        ]);

        const state = useStore.getState();
        const animateInbound = state.connections
            .filter((connection: Connection) => connection.to === 'anim-1')
            .map((connection: Connection) => connection.from);
        expect(animateInbound).toEqual(['img-2', 'img-3']);

        const renderInbound = state.connections
            .filter((connection: Connection) => connection.to === 'render-1')
            .map((connection: Connection) => connection.from);
        expect(renderInbound).toEqual(['img-2']);
    });

    it('removes a specific connection by id', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(animateNode('anim-1', 200));
        store.addConnection('img-1', 'anim-1');

        const connectionId = useStore.getState().connections[0]?.id;
        expect(connectionId).toBeTruthy();

        if (!connectionId) {
            throw new Error('Expected connection id to exist');
        }

        store.removeConnection(connectionId);
        expect(useStore.getState().connections).toHaveLength(0);
    });

    it('keeps swap-frame behavior deterministic after remove/re-add flow', () => {
        const store = useStore.getState();
        store.addWorkbenchNode(imageNode('img-1', 0));
        store.addWorkbenchNode(imageNode('img-2', 100));
        store.addWorkbenchNode(animateNode('anim-1', 300));

        store.addConnection('img-1', 'anim-1');
        store.addConnection('img-2', 'anim-1');

        const initialInbound = useStore.getState().connections.filter(
            (connection: Connection) => connection.to === 'anim-1'
        );
        expect(initialInbound).toHaveLength(2);

        store.removeConnection(initialInbound[0].id);
        store.removeConnection(initialInbound[1].id);
        store.addConnection('img-2', 'anim-1');
        store.addConnection('img-1', 'anim-1');

        const swappedInbound = useStore.getState().connections
            .filter((connection: Connection) => connection.to === 'anim-1')
            .map((connection: Connection) => connection.from);

        expect(swappedInbound).toEqual(['img-2', 'img-1']);
    });
});
