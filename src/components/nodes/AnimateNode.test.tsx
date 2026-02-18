import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AnimateNode } from './AnimateNode';
import { useStore } from '../../store/useStore';
import { renderService } from '../../services/renderService';

// Mock dependencies
vi.mock('../../store/useStore');
vi.mock('../../services/renderService');

describe('AnimateNode logic', () => {
    const mockStore = {
        setActiveNodeId: vi.fn(),
        updateWorkbenchNode: vi.fn(),
        workbenchNodes: [],
        connections: [],
        removeConnection: vi.fn(),
        addWorkbenchNode: vi.fn(),
        addConnection: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as any).mockReturnValue(mockStore);
        (renderService.animate as any).mockResolvedValue({
            success: true,
            images: ['video.mp4']
        });
    });

    it('should identify two frames when connected and use correct workflow', async () => {
        // 1. Setup Mock State with 2 source nodes and 2 connections
        const sourceNode1 = {
            id: 'source-1',
            type: 'image',
            project: { thumbnail: 'thumb1.png', canvas: { width: 512, height: 512 } },
            width: 512,
            height: 512,
            x: 0,
            y: 0
        };
        const sourceNode2 = {
            id: 'source-2',
            type: 'image',
            project: { thumbnail: 'thumb2.png', canvas: { width: 512, height: 512 } },
            width: 512,
            height: 512,
            x: 0,
            y: 600
        };

        const animateNodeData = {
            id: 'animate-id',
            type: 'animate',
            data: {
                prompt: 'test prompt',
                settings: { workflowId: 'video_standard' }
            },
            width: 320,
            height: 400,
            x: 600,
            y: 300
        };

        mockStore.workbenchNodes = [sourceNode1, sourceNode2, animateNodeData] as any;
        mockStore.connections = [
            { id: 'c1', from: 'source-1', to: 'animate-id' },
            { id: 'c2', from: 'source-2', to: 'animate-id' }
        ] as any;

        // 2. Render Component
        const { getByText } = render(
            <AnimateNode id="animate-id" data={animateNodeData as any} selected={true} />
        );

        // 3. Trigger Animation
        const animateButton = getByText('Animate', { selector: 'span' }).closest('button');
        if (!animateButton) throw new Error('Button not found');
        animateButton.click();

        // 4. Verify renderService.animate call
        expect(renderService.animate).toHaveBeenCalledWith(expect.objectContaining({
            workflowId: 'animate_from_to',
            init_image: 'thumb1.png',
            end_image: 'thumb2.png',
            prompt: 'test prompt'
        }));
    });
});
