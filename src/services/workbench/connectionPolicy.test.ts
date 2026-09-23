import { describe, expect, it } from 'vitest';
import { Connection, WorkbenchNode } from '@/types';
import { addConnectionWithPolicy, normalizeConnections } from './connectionPolicy';

function makeNode(id: string, type: WorkbenchNode['type']): WorkbenchNode {
    if (type === 'image') {
        return {
            id,
            type: 'image',
            name: id,
            x: 0,
            y: 0,
            project: {
                id,
                name: id,
                createdAt: 0,
                lastModifiedAt: 0,
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

    if (type === 'video') {
        return {
            id,
            type: 'video',
            name: id,
            x: 0,
            y: 0,
            project: {
                id,
                name: id,
                createdAt: 0,
                lastModifiedAt: 0,
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

    if (type === 'animate') {
        return {
            id,
            type: 'animate',
            x: 0,
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

    return {
        id,
        type: 'render',
        x: 0,
        y: 0,
        data: {
            prompt: '',
            stylePreset: 'default',
            drawingInfluence: 0.5,
            numImages: 1,
        },
    };
}

describe('connectionPolicy', () => {
    const nodes: WorkbenchNode[] = [
        makeNode('img-1', 'image'),
        makeNode('img-2', 'image'),
        makeNode('img-3', 'image'),
        makeNode('anim-1', 'animate'),
        makeNode('render-1', 'render'),
        makeNode('vid-1', 'video'),
    ];

    it('allows only image -> animate|render connections', () => {
        const seed: Connection[] = [];
        const validAnimate = addConnectionWithPolicy(seed, nodes, 'img-1', 'anim-1');
        expect(validAnimate).toHaveLength(1);

        const validRender = addConnectionWithPolicy(validAnimate, nodes, 'img-2', 'render-1');
        expect(validRender).toHaveLength(2);

        const invalidDirection = addConnectionWithPolicy(validRender, nodes, 'anim-1', 'img-1');
        expect(invalidDirection).toHaveLength(2);

        const invalidTarget = addConnectionWithPolicy(validRender, nodes, 'img-3', 'img-1');
        expect(invalidTarget).toHaveLength(2);
    });

    it('rejects self and duplicate connections', () => {
        const seed = addConnectionWithPolicy([], nodes, 'img-1', 'anim-1');
        const duplicate = addConnectionWithPolicy(seed, nodes, 'img-1', 'anim-1');
        expect(duplicate).toHaveLength(1);

        const selfConnection = addConnectionWithPolicy(seed, nodes, 'img-1', 'img-1');
        expect(selfConnection).toHaveLength(1);
    });

    it('rejects any connection with a video endpoint', () => {
        const fromVideo = addConnectionWithPolicy([], nodes, 'vid-1', 'anim-1');
        expect(fromVideo).toHaveLength(0);

        const toVideo = addConnectionWithPolicy([], nodes, 'img-1', 'vid-1');
        expect(toVideo).toHaveLength(0);
    });

    it('enforces animate inbound cap (2) with deterministic oldest replacement', () => {
        let next = addConnectionWithPolicy([], nodes, 'img-1', 'anim-1');
        next = addConnectionWithPolicy(next, nodes, 'img-2', 'anim-1');
        next = addConnectionWithPolicy(next, nodes, 'img-3', 'anim-1');

        const inbound = next.filter((connection) => connection.to === 'anim-1');
        expect(inbound).toHaveLength(2);
        expect(inbound.map((connection) => connection.from)).toEqual(['img-2', 'img-3']);
    });

    it('enforces render inbound cap (1) with deterministic oldest replacement', () => {
        let next = addConnectionWithPolicy([], nodes, 'img-1', 'render-1');
        next = addConnectionWithPolicy(next, nodes, 'img-2', 'render-1');

        const inbound = next.filter((connection) => connection.to === 'render-1');
        expect(inbound).toHaveLength(1);
        expect(inbound[0].from).toBe('img-2');
    });

    it('normalizes ingested connections by dropping orphan, invalid, duplicate and over-cap edges', () => {
        const payload: Connection[] = [
            { id: 'c1', from: 'img-1', to: 'anim-1' },
            { id: 'c2', from: 'img-2', to: 'anim-1' },
            { id: 'c3', from: 'img-3', to: 'anim-1' },
            { id: 'c4', from: 'img-1', to: 'anim-1' },
            { id: 'c5', from: 'img-1', to: 'render-1' },
            { id: 'c6', from: 'img-2', to: 'render-1' },
            { id: 'c7', from: 'img-1', to: 'missing-node' },
            { id: 'c8', from: 'vid-1', to: 'anim-1' },
            { id: 'c9', from: 'anim-1', to: 'render-1' },
        ];

        const normalized = normalizeConnections(payload, nodes);

        const animateInbound = normalized
            .filter((connection) => connection.to === 'anim-1')
            .map((connection) => connection.from);
        expect(animateInbound).toEqual(['img-2', 'img-3']);

        const renderInbound = normalized
            .filter((connection) => connection.to === 'render-1')
            .map((connection) => connection.from);
        expect(renderInbound).toEqual(['img-2']);
    });

    it('preserves sourceHandle and targetHandle when connections are accepted', () => {
        const next = addConnectionWithPolicy([], nodes, 'img-1', 'anim-1', 'image-source', 'animate-target-visible');
        expect(next).toHaveLength(1);
        expect(next[0].sourceHandle).toBe('image-source');
        expect(next[0].targetHandle).toBe('animate-target-visible');
    });

    it('assigns image-source handle when an image connection omits sourceHandle', () => {
        const next = addConnectionWithPolicy([], nodes, 'img-1', 'anim-1');
        expect(next).toHaveLength(1);
        expect(next[0].sourceHandle).toBe('image-source');
        expect(next[0].targetHandle).toBeNull();
    });
});
