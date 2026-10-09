import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultsPanel } from './ResultsPanel';
import { useStore } from '../../store/useStore';

vi.mock('../../store/useStore', () => ({
    useStore: vi.fn(),
}));

const setResultsPanelOpen = vi.fn();

describe('ResultsPanel', () => {
    beforeEach(() => {
        setResultsPanelOpen.mockClear();
        vi.mocked(useStore).mockReturnValue({
            renderResults: [],
            activeNodeId: 'default',
            resultsPanelOpen: false,
            setResultsPanelOpen,
            previewingRender: null,
            setPreviewingRender: vi.fn(),
            isPreviewVisible: false,
            setIsPreviewVisible: vi.fn(),
            addResultAsLayer: vi.fn(),
            loadRenderSettings: vi.fn(),
            addGroupToWorkbench: vi.fn(),
            addImageToWorkbench: vi.fn(),
            isRendering: false,
            workbenchNodes: [],
        } as ReturnType<typeof useStore>);
    });

    it('expands upward from the collapsed panel position', () => {
        const view = render(<ResultsPanel height={400} />);

        fireEvent.click(screen.getByText('Results'));
        vi.mocked(useStore).mockReturnValue({
            ...vi.mocked(useStore).mock.results[0].value,
            resultsPanelOpen: true,
        });
        view.rerender(<ResultsPanel height={400} />);

        const panel = screen.getByText('Results').closest('.w-full');
        expect(setResultsPanelOpen).toHaveBeenCalledWith(true);
        expect(panel).toHaveClass('flex-none');
    });
});