import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComputeSettings } from '@/types/executionTarget.types';

const { storeState, queueState } = vi.hoisted(() => ({
    storeState: {
        computeSettings: {} as ComputeSettings,
        setImageApiModel: vi.fn(),
    },
    queueState: {
        snapshot: { endpoint: '', active: 0, queued: 0, concurrency: 2 },
        listeners: [] as Array<(snapshot: { endpoint: string; active: number; queued: number; concurrency: number }) => void>,
    },
}));

vi.mock('@/store/useStore', () => ({
    useStore: (selector?: (state: typeof storeState) => unknown) =>
        selector ? selector(storeState) : storeState,
}));

vi.mock('@/services/renderService', () => ({
    renderService: { checkConnection: vi.fn().mockResolvedValue(true) },
    imageApiQueue: {
        getSnapshot: (_endpoint: string) => queueState.snapshot,
        subscribe: (listener: (snapshot: { endpoint: string; active: number; queued: number; concurrency: number }) => void) => {
            queueState.listeners.push(listener);
            return () => {
                queueState.listeners = queueState.listeners.filter((item) => item !== listener);
            };
        },
    },
}));

import { ComputePopover } from './ComputePopover';

function makeSettings(overrides: Partial<ComputeSettings> = {}): ComputeSettings {
    return {
        targetKind: 'local',
        protocol: 'comfyui',
        preference: 'automatic',
        localEndpoint: '/comfy-api',
        hostedEndpoint: '',
        imageApiEndpoint: '',
        imageApiKey: '',
        imageApiKeyless: false,
        imageApiModels: [],
        imageApiModel: '',
        imageApiSize: '1024x1024',
        endpointConcurrency: 2,
        ...overrides,
    };
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

const openApiSchema = {
    openapi: '3.0.0',
    info: { title: 'Unsloth', version: '1' },
    paths: {
        '/v1/generate-progress': { get: { operationId: 'progress' } },
        '/v1/load-progress': { get: { operationId: 'loadProgress' } },
        '/v1/cancel': { post: { operationId: 'cancel' } },
    },
};

function openPopover() {
    fireEvent.click(screen.getByRole('button', { name: 'Compute details' }));
}

afterEach(() => {
    vi.unstubAllGlobals();
    storeState.setImageApiModel.mockReset();
    queueState.snapshot = { endpoint: '', active: 0, queued: 0, concurrency: 2 };
    queueState.listeners = [];
});

describe('ComputePopover', () => {
    it('shows live connection state, models, capabilities, and queue for a connected image API', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
            imageApiModel: 'model-a',
        });
        queueState.snapshot = { endpoint: 'http://localhost:8001/v1', active: 1, queued: 3, concurrency: 2 };

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(200, { data: [{ id: 'model-a' }, { id: 'model-b' }] });
            if (url.endsWith('/openapi.json')) return jsonResponse(200, openApiSchema);
            return jsonResponse(404, {});
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<ComputePopover />);
        openPopover();

        expect(await screen.findByText('Connected')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Compute details' })).toHaveTextContent('model-a');
        expect(screen.queryByText(/OpenAI-compatible ·/)).not.toBeInTheDocument();
        const modelSelect = screen.getByLabelText('Active model') as HTMLSelectElement;
        expect(modelSelect.value).toBe('model-a');
        expect(Array.from(modelSelect.options).map((option) => option.value)).toEqual(['model-a', 'model-b']);
        expect(screen.getByText('Progress telemetry')).toBeInTheDocument();
        expect(screen.getByText('Load progress')).toBeInTheDocument();
        expect(screen.getByText('Cancellation')).toBeInTheDocument();
        expect(screen.getByText('OpenViz queue')).toBeInTheDocument();
        expect(screen.getByText('1/2 active · 3 queued')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh compute status' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open AI & Compute settings' })).toBeInTheDocument();
    });

    it('updates the active model when a different model is selected in the dropdown', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
            imageApiModel: 'model-a',
        });

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(200, { data: [{ id: 'model-a' }, { id: 'model-b' }] });
            return jsonResponse(404, {});
        }));

        render(<ComputePopover />);
        openPopover();
        await screen.findByText('Connected');

        fireEvent.change(screen.getByLabelText('Active model'), { target: { value: 'model-b' } });
        expect(storeState.setImageApiModel).toHaveBeenCalledWith('model-b');
    });

    it('caps the active model label in the pill at 20 characters', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
            imageApiModel: 'unsloth/Qwen-Image-2.1-GGUF',
        });

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(200, { data: [{ id: 'unsloth/Qwen-Image-2.1-GGUF' }] });
            return jsonResponse(404, {});
        }));

        render(<ComputePopover />);

        const pill = screen.getByRole('button', { name: 'Compute details' });
        await waitFor(() => expect(pill).toHaveTextContent('unsloth/Qwen-Image-…'));
    });

    it('shows a checking state while the endpoint probe is in flight', () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
        });

        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));

        render(<ComputePopover />);
        openPopover();

        expect(screen.getByText('Checking')).toBeInTheDocument();
        expect(screen.queryByText('Offline')).not.toBeInTheDocument();
    });

    it('surfaces auth-required with the endpoint error message', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKey: 'bad-key',
        });

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(401, { error: { message: 'Invalid API key' } });
            return jsonResponse(404, {});
        }));

        render(<ComputePopover />);
        openPopover();

        expect(await screen.findByText('Auth required')).toBeInTheDocument();
        expect(screen.getByText(/Invalid API key/)).toBeInTheDocument();
    });

    it('shows an offline state with the error message when the endpoint is unreachable', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
        });

        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new Error('network down');
        }));

        render(<ComputePopover />);
        openPopover();

        expect(await screen.findByText('Offline')).toBeInTheDocument();
        expect(screen.getByText('network down')).toBeInTheDocument();
    });

    it('shows ComfyUI hardware and the server-side queue', async () => {
        storeState.computeSettings = makeSettings({ protocol: 'comfyui', localEndpoint: '/comfy-api' });

        const gib = 1024 ** 3;
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/system_stats')) {
                return jsonResponse(200, { devices: [{ name: 'NVIDIA GPU', type: 'cuda', index: 0, vram_total: 24 * gib, vram_free: 8 * gib }] });
            }
            if (url.endsWith('/object_info')) return jsonResponse(200, {});
            if (url.endsWith('/queue')) {
                return jsonResponse(200, { queue_running: [{ prompt_id: 'p1' }], queue_pending: [{ prompt_id: 'p2' }, { prompt_id: 'p3' }] });
            }
            return jsonResponse(404, {});
        }));

        render(<ComputePopover />);
        openPopover();

        expect(await screen.findByText('Connected')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Compute details' })).toHaveTextContent('ComfyUI');
        expect(screen.queryByText('ComfyUI · /comfy-api')).not.toBeInTheDocument();
        expect(screen.getByText(/NVIDIA GPU/)).toBeInTheDocument();
        expect(screen.getByText('8.0 GB / 24.0 GB')).toBeInTheDocument();
        expect(screen.getByText('ComfyUI server')).toBeInTheDocument();
        expect(screen.getByText('1 active · 2 queued')).toBeInTheDocument();
    });

    it('re-probes the endpoint when Refresh is clicked', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
            imageApiModel: 'model-a',
        });

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(200, { data: [{ id: 'model-a' }] });
            if (url.endsWith('/openapi.json')) return jsonResponse(200, openApiSchema);
            return jsonResponse(404, {});
        });
        vi.stubGlobal('fetch', fetchMock);

        render(<ComputePopover />);
        openPopover();
        await screen.findByText('Connected');

        const callsBefore = fetchMock.mock.calls.length;
        fireEvent.click(screen.getByRole('button', { name: 'Refresh compute status' }));
        await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
    });

    it('exposes the live region and dialog semantics for assistive tech', async () => {
        storeState.computeSettings = makeSettings({
            protocol: 'openai-image',
            imageApiEndpoint: 'http://localhost:8001/v1',
            imageApiKeyless: true,
        });

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/models')) return jsonResponse(200, { data: [{ id: 'model-a' }] });
            return jsonResponse(404, {});
        }));

        render(<ComputePopover />);
        const trigger = screen.getByRole('button', { name: 'Compute details' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        openPopover();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('dialog', { name: 'Compute status' })).toBeInTheDocument();
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
});
