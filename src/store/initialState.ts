import { Project } from '../types';

export const INITIAL_PROJECT: Project = {
    id: 'default',
    name: 'Untitled Project',
    createdAt: Date.now(),
    lastModifiedAt: Date.now(),
    canvas: {
        width: 1024,
        height: 768,
        aspectRatio: 'landscape',
        zoomLevel: 1,
        panX: 0,
        panY: 0,
        backgroundColor: '#ffffff',
    },
    layers: [
        {
            id: 'bg-layer',
            name: 'Background',
            type: 'sketch',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            order: 0,
            created: Date.now(),
            modified: Date.now(),
        },
        {
            id: 'layer-1',
            name: 'Layer 1',
            type: 'sketch',
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'normal',
            strokes: [],
            order: 1,
            created: Date.now(),
            modified: Date.now(),
        }
    ],
};
