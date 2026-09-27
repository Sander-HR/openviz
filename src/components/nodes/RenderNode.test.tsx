import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { RenderNode } from './RenderNode';
import { useStore } from '../../store/useStore';
import { renderService } from '../../services/renderService';

vi.mock('../../store/useStore');
vi.mock('../../services/renderService');

const connectionState: {
    inProgress: boolean;
    fromNode: { type?: string } | null;
} = { inProgress: false, fromNode: null };

vi.mock('@xyflow/react', async () => {
    return {
        Handle: ({ style, children }: { style?: CSSProperties; children?: ReactNode }) => (
            <div data-testid="rf__handle" style={style}>{children}</div>
        ),
        Position: { Left: 'left' },
        ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
        useConnection: () => connectionState,
    };
});

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
        connectionState.inProgress = false;
        connectionState.fromNode = null;
        vi.mocked(useStore).mockReturnValue(mockStore);
        vi.mocked(renderService.generate).mockResolvedValue({
            success: true,
            images: ['result-1.png', 'result-2.png'],
        });
    });

    it('keeps the visible target centered and limits the idle drop area', () => {
        const nodeData = {
            id: 'render-id',
            type: 'render' as const,
            x: 100,
            y: 200,
            width: 320,
            height: 500,
            data: { prompt: '', stylePreset: '', drawingInfluence: 0, numImages: 1, referenceImage: '' },
        };

        render(<RenderNode id="render-id" data={nodeData} selected={false} />);

        const handles = screen.getAllByTestId('rf__handle');
        expect(handles[0]).toHaveStyle({ top: '50%', opacity: '0', pointerEvents: 'none' });
        expect(handles[1]).toHaveStyle({ pointerEvents: 'none', cursor: 'default' });
    });

    it('expands the receiving drop area during an image connection drag', () => {
        connectionState.inProgress = true;
        connectionState.fromNode = { type: 'imageNode' };

        const nodeData = {
            id: 'render-id',
            type: 'render' as const,
            x: 100,
            y: 200,
            width: 320,
            height: 500,
            data: { prompt: '', stylePreset: '', drawingInfluence: 0, numImages: 1, referenceImage: '' },
        };

        render(<RenderNode id="render-id" data={nodeData} selected={false} />);

        const handles = screen.getAllByTestId('rf__handle');
        expect(handles[0]).toHaveStyle({ top: '50%', opacity: '1', pointerEvents: 'auto' });
        expect(handles[1]).toHaveStyle({ pointerEvents: 'auto', cursor: 'crosshair' });
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

        const { getByText } = render(<RenderNode id="render-id" data={nodeData} selected={true} />);

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
