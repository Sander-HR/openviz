import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { RenderNode } from './RenderNode';
import { useStore } from '../../store/useStore';
import { renderService } from '../../services/renderService';

vi.mock('../../store/useStore');
vi.mock('../../services/renderService');

describe('RenderNode generation behavior', () => {
    const mockStore = {
        updateWorkbenchNode: vi.fn(),
        addRenderResultGroup: vi.fn(),
        connections: [],
        workbenchNodes: [],
        addWorkbenchNode: vi.fn(),
        addConnection: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useStore).mockReturnValue(mockStore);
        vi.mocked(renderService.generate).mockResolvedValue({
            success: true,
            images: ['result-1.png', 'result-2.png'],
        });
    });

    it('creates standalone result placeholders without creating output edges', async () => {
        const nodeData = {
            id: 'render-id',
            type: 'render' as const,
            x: 100,
            y: 200,
            width: 320,
            height: 500,
            data: {
                prompt: 'Render a product shot',
                stylePreset: 'Photorealistic',
                drawingInfluence: 0.65,
                numImages: 2,
                referenceImage: 'data:image/png;base64,abc',
            },
        };

        const { getByText } = render(
            <ReactFlowProvider>
                <RenderNode id="render-id" data={nodeData} selected={true} />
            </ReactFlowProvider>
        );

        const generateButton = getByText('Generate', { selector: 'span' }).closest('button');
        if (!generateButton) {
            throw new Error('Generate button not found');
        }

        generateButton.click();

        await vi.waitFor(() => {
            expect(renderService.generate).toHaveBeenCalledTimes(1);
        });

        expect(mockStore.addWorkbenchNode).toHaveBeenCalledTimes(2);
        expect(mockStore.addConnection).not.toHaveBeenCalled();
    });
});
