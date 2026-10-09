import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { useExtractionAssets } from './useExtractionAssets';
import { useStore } from '@/store/useStore';

const PALETTE_ASSET = {
    id: 'asset-1',
    projectId: 'default',
    kind: 'palette',
    extractionRecordId: 'rec-1',
    payload: { swatches: ['#a1a1aa', '#047857'] },
    createdAt: 1_700_000_000_000,
};

function makeWrapper() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Wrapper({ children }: { children?: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return Wrapper;
}

describe('useExtractionAssets (T030, FR-023)', () => {
    beforeEach(() => {
        useStore.setState({ currentProjectId: null });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('lists assets for the default project when no project is active', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([PALETTE_ASSET]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useExtractionAssets(), { wrapper: makeWrapper() });
        await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(fetchMock).toHaveBeenCalledWith('/api/extraction-assets?projectId=default');
        expect(result.current.assets).toHaveLength(1);
        expect(result.current.assets[0].id).toBe('asset-1');
    });

    it('lists assets for the active project when one is set', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);
        useStore.setState({ currentProjectId: 'project-42' });

        const { result } = renderHook(() => useExtractionAssets(), { wrapper: makeWrapper() });
        await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(fetchMock).toHaveBeenCalledWith('/api/extraction-assets?projectId=project-42');
        expect(result.current.assets).toEqual([]);
    });

    it('surfaces a list error instead of failing silently', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useExtractionAssets(), { wrapper: makeWrapper() });
        await vi.waitFor(() => expect(result.current.error).not.toBeNull());

        expect(result.current.error?.message).toContain('boom');
    });
});
