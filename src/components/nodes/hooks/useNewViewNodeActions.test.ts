import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { NewViewWorkbenchNode, WorkbenchNode } from '@/types';
import { useStore } from '../../../store/useStore';
import { renderService } from '../../../services/renderService';
import { useNewViewNodeActions } from './useNewViewNodeActions';
import { getGenerationRetry } from '@/services/workbench/generationRetryRegistry';

vi.mock('../../../store/useStore');
vi.mock('../../../services/renderService');
vi.mock('@xyflow/react', () => ({
    useConnection: () => ({ inProgress: false }),
}));

const mockStore = {
    updateWorkbenchNode: vi.fn(),
    addRenderResultGroup: vi.fn(),
    connections: [] as Array<{ id: string; from: string; to: string }>,
    workbenchNodes: [] as WorkbenchNode[],
    addWorkbenchNode: vi.fn(),
};

function makeImageNode(id: string, thumbnail = 'data:image/png;base64,abc'): WorkbenchNode {
    return {
        id,
        type: 'image',
        name: id,
        x: 0,
        y: 0,
        width: 512,
        height: 512,
        project: {
            id,
            name: id,
            createdAt: 0,
            lastModifiedAt: 0,
            canvas: { width: 1024, height: 768, aspectRatio: '4:3', zoomLevel: 1, panX: 0, panY: 0, backgroundColor: '#fff' },
            layers: [],
            thumbnail,
        },
    } as WorkbenchNode;
}

function makeNewViewNode(overrides: Partial<NewViewWorkbenchNode['data']> = {}): NewViewWorkbenchNode {
    return {
        id: 'nv-1',
        type: 'new-view',
        x: 0,
        y: 0,
        width: 280,
        height: 160,
        data: { prompt: '', view: null, ...overrides },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockStore.connections = [];
    mockStore.workbenchNodes = [];
    vi.mocked(useStore).mockReturnValue(mockStore);
});

describe('useNewViewNodeActions', () => {
    it('does nothing when no view is selected', async () => {
        const node = makeNewViewNode(); // view: null
        mockStore.workbenchNodes = [makeImageNode('img-1')];
        mockStore.connections = [{ id: 'c1', from: 'img-1', to: 'nv-1' }];

        const { result } = renderHook(() => useNewViewNodeActions('nv-1', node));
        await act(async () => { await result.current.handleGenerate(); });

        expect(renderService.newView).not.toHaveBeenCalled();
    });

    it('does nothing when no reference image is connected', async () => {
        const node = makeNewViewNode({ view: 'Rear' });
        mockStore.workbenchNodes = [];
        mockStore.connections = [];

        const { result } = renderHook(() => useNewViewNodeActions('nv-1', node));
        await act(async () => { await result.current.handleGenerate(); });

        expect(renderService.newView).not.toHaveBeenCalled();
    });

    it('calls renderService.newView with reference images, view, and source dimensions', async () => {
        const node = makeNewViewNode({ view: 'Rear Right 3/4 view' });
        mockStore.workbenchNodes = [makeImageNode('img-1', 'data:image/png;base64,ref')];
        mockStore.connections = [{ id: 'c1', from: 'img-1', to: 'nv-1' }];
        vi.mocked(renderService.newView).mockResolvedValue({ success: true, images: ['result.png'] });

        const { result } = renderHook(() => useNewViewNodeActions('nv-1', node));
        await act(async () => { await result.current.handleGenerate(); });

        expect(renderService.newView).toHaveBeenCalledWith({
            referenceImages: ['data:image/png;base64,ref'],
            init_image: 'data:image/png;base64,ref',
            view: 'Rear Right 3/4 view',
            width: 1024,
            height: 768,
        });
    });

    it('creates a placeholder image node and updates it with the result on success', async () => {
        const node = makeNewViewNode({ view: 'Front' });
        mockStore.workbenchNodes = [makeImageNode('img-1')];
        mockStore.connections = [{ id: 'c1', from: 'img-1', to: 'nv-1' }];
        vi.mocked(renderService.newView).mockResolvedValue({ success: true, images: ['https://cdn/result.png'] });

        const { result } = renderHook(() => useNewViewNodeActions('nv-1', node));
        await act(async () => { await result.current.handleGenerate(); });

        expect(mockStore.addWorkbenchNode).toHaveBeenCalledTimes(1);
        const placeholder = mockStore.addWorkbenchNode.mock.calls[0][0];
        expect(placeholder.status).toBe('rendering');

        expect(mockStore.updateWorkbenchNode).toHaveBeenCalledWith(
            placeholder.id,
            expect.objectContaining({ status: 'done', project: expect.objectContaining({ thumbnail: 'https://cdn/result.png' }) }),
        );
    });

    it('marks the placeholder as error when the service returns failure', async () => {
        const node = makeNewViewNode({ view: 'Top' });
        mockStore.workbenchNodes = [makeImageNode('img-1')];
        mockStore.connections = [{ id: 'c1', from: 'img-1', to: 'nv-1' }];
        vi.mocked(renderService.newView).mockResolvedValue({ success: false, images: [], error: 'boom' });

        const { result } = renderHook(() => useNewViewNodeActions('nv-1', node));
        await act(async () => { await result.current.handleGenerate(); });

        expect(mockStore.updateWorkbenchNode).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'error', errorMessage: 'boom' }),
        );
    });

    it('retries in the same placeholder node and updates it after success', async () => {
        const node = makeNewViewNode({ view: 'Top' });
        mockStore.workbenchNodes = [makeImageNode('img-1')];
        mockStore.connections = [{ id: 'c1', from: 'img-1', to: 'nv-1' }];
        vi.mocked(renderService.newView)
            .mockResolvedValueOnce({ success: false, images: [], error: 'busy' })
            .mockResolvedValueOnce({ success: true, images: ['retry.png'] });

        const { result } = renderHook(() => useNewViewNodeActions('nv-1', node));
        await act(async () => { await result.current.handleGenerate(); });

        const errorUpdate = mockStore.updateWorkbenchNode.mock.calls.find(([, update]) => update.status === 'error');
        expect(errorUpdate).toBeDefined();
        await act(async () => { getGenerationRetry(errorUpdate?.[0] as string)?.(); });

        expect(renderService.newView).toHaveBeenCalledTimes(2);
        expect(mockStore.addWorkbenchNode).toHaveBeenCalledTimes(1);
        expect(mockStore.updateWorkbenchNode).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'done', project: expect.objectContaining({ thumbnail: 'retry.png' }) }),
        );
    });

    it('exposes isGenerating state that toggles during the call', async () => {
        const node = makeNewViewNode({ view: 'Left' });
        mockStore.workbenchNodes = [makeImageNode('img-1')];
        mockStore.connections = [{ id: 'c1', from: 'img-1', to: 'nv-1' }];
        let resolveFn: (v: { success: boolean; images: string[] }) => void;
        vi.mocked(renderService.newView).mockReturnValue(new Promise(r => { resolveFn = r; }));

        const { result } = renderHook(() => useNewViewNodeActions('nv-1', node));
        expect(result.current.isGenerating).toBe(false);

        act(() => { void result.current.handleGenerate(); });
        expect(result.current.isGenerating).toBe(true);

        await act(async () => { resolveFn!({ success: true, images: ['ok.png'] }); });
        expect(result.current.isGenerating).toBe(false);
    });
});
