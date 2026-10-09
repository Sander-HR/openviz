import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { VideoNode } from './VideoNode';
import type { VideoNode as VideoNodeType } from '../../types';

const makeData = (overrides: Partial<NonNullable<VideoNodeType['project']>> = {}): VideoNodeType =>
    ({
        id: 'vid-1',
        type: 'video',
        name: 'Clip',
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        status: 'done',
        project: {
            id: 'vid-1',
            name: 'Clip',
            createdAt: 1,
            lastModifiedAt: 1,
            canvas: { width: 320, height: 180, aspectRatio: 'landscape', zoomLevel: 1, panX: 0, panY: 0, backgroundColor: '#000' },
            layers: [{ id: 'l1', name: 'Clip', type: 'image', visible: true, locked: false, opacity: 100, blendMode: 'normal', strokes: [], image: '/v/clip.mp4', x: 0, y: 0, width: 320, height: 180, order: 1, created: 1, modified: 1 }],
            thumbnail: '/v/clip.mp4',
            ...overrides,
        },
    }) as VideoNodeType;

const renderNode = (data: VideoNodeType) =>
    render(
        <ReactFlowProvider>
            <VideoNode id="vid-1" data={data} selected={false} />
        </ReactFlowProvider>,
    );

describe('VideoNode (Sprint 3 Task 3.3 — poster inline, video only in fullscreen)', () => {
    it('renders the poster image inline and no <video> element while in the workbench', () => {
        renderNode(makeData({ posterUrl: '/v/poster.webp' }));
        expect(document.querySelector('video')).toBeNull();
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', '/v/poster.webp');
    });

    it('opens the fullscreen modal with a playing <video> on play click, and unmounts it on close', async () => {
        renderNode(makeData({ posterUrl: '/v/poster.webp' }));
        fireEvent.click(screen.getByRole('button', { name: /play/i }));
        const video = document.querySelector('video');
        expect(video).not.toBeNull();
        expect(video).toHaveAttribute('src', '/v/clip.mp4');
        fireEvent.click(screen.getByRole('button', { name: /close|exit/i }));
        // AnimatePresence exit animation runs before the portal unmounts.
        await waitFor(() => expect(document.querySelector('video')).toBeNull(), { timeout: 3000 });
    });

    it('renders a placeholder when the poster is missing and still opens fullscreen video', () => {
        renderNode(makeData()); // no posterUrl
        expect(document.querySelector('video')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /play/i }));
        const video = document.querySelector('video');
        expect(video).not.toBeNull();
        expect(video).toHaveAttribute('src', '/v/clip.mp4');
    });

    it('keeps the rendering state untouched by the poster change', () => {
        const data = makeData({ posterUrl: '/v/poster.webp' });
        (data as { status?: string }).status = 'rendering';
        renderNode(data);
        expect(document.querySelector('video')).toBeNull();
        expect(screen.getByText(/rendering video/i)).toBeTruthy();
    });
});
