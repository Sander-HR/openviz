import { act, renderHook } from '@testing-library/react';
import { del as idbDel } from 'idb-keyval';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '@/store/useStore';
import { useAISettingsSync } from './useAISettingsSync';

const mocks = vi.hoisted(() => ({
    useSession: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ useSession: mocks.useSession }));

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

// What the server stores for a user who configured an OpenAI-compatible image API.
const serverSettings = {
    targetKind: 'local',
    protocol: 'openai-image',
    preference: 'automatic',
    localEndpoint: '/comfy-api',
    hostedEndpoint: '',
    imageApiEndpoint: 'http://100.85.5.85:8888/v1',
    imageApiKeyless: false,
    imageApiModels: [],
    imageApiModel: 'gpt-image-1',
    imageApiSize: '1024x1024',
    endpointConcurrency: 2,
    hasImageApiKey: true,
    updatedAt: '2026-10-06T00:00:00.000Z',
};

describe('useAISettingsSync', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        await idbDel('openviz-storage-idb');
        // Stale local state: the shape that makes generation-lab report
        // "No image API configured" while the server has a backend.
        useStore.setState((state) => ({
            ...state,
            computeSettings: { ...state.computeSettings, protocol: 'openai-image', imageApiEndpoint: '' },
        }));
        mocks.useSession.mockReturnValue({ status: 'authenticated', data: { user: { id: 'user-1' } } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('applies server settings over a stale local snapshot', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
            String(input).includes('/api/ai/settings') ? jsonResponse(200, { settings: serverSettings }) : jsonResponse(404, {}),
        );
        vi.stubGlobal('fetch', fetchMock);

        renderHook(() => useAISettingsSync());

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai/settings'));
        await act(async () => {});

        const { computeSettings } = useStore.getState();
        expect(computeSettings.protocol).toBe('openai-image');
        expect(computeSettings.imageApiEndpoint).toBe('http://100.85.5.85:8888/v1');
    });

    it('does not sync while unauthenticated', async () => {
        mocks.useSession.mockReturnValue({ status: 'unauthenticated', data: null });
        const fetchMock = vi.fn(async () => jsonResponse(404, {}));
        vi.stubGlobal('fetch', fetchMock);

        renderHook(() => useAISettingsSync());
        await act(async () => {});

        expect(fetchMock).not.toHaveBeenCalledWith('/api/ai/settings');
    });

    it('keeps local state when the settings request fails', async () => {
        const fetchMock = vi.fn(async () => {
            throw new TypeError('Load failed');
        });
        vi.stubGlobal('fetch', fetchMock);

        renderHook(() => useAISettingsSync());
        await act(async () => {});

        expect(useStore.getState().computeSettings.imageApiEndpoint).toBe('');
    });
});
