import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comfyConnectionManager } from '@/services/ai/comfyConnectionManager';
import { AIComputeSettings } from './AIComputeSettings';

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    comfyConnectionManager.reset();
});

describe('AIComputeSettings', () => {
    it('shows connection, hardware, and model sections', () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
        render(<AIComputeSettings />);
        expect(screen.getByRole('heading', { name: 'AI & Compute' })).toBeInTheDocument();
        expect(screen.getByLabelText('ComfyUI endpoint')).toHaveValue('/comfy-api');
        expect(screen.getByText('Hardware detection')).toBeInTheDocument();
        expect(screen.getByText('Models & dependencies')).toBeInTheDocument();
    });

    it('tests the configured connection and reports the result', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/system_stats')) return jsonResponse(200, { devices: [] });
            if (url.endsWith('/object_info')) return jsonResponse(200, {});
            if (url.endsWith('/queue')) return jsonResponse(200, { queue_running: [], queue_pending: [] });
            return jsonResponse(404, {});
        }));
        render(<AIComputeSettings />);
        fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
        expect((await screen.findAllByText('Connected', { exact: true })).length).toBeGreaterThan(0);
    });

    it('retries an unavailable connection every 10 seconds until it connects', async () => {
        vi.useFakeTimers();
        let probeAttempts = 0;
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (!url.endsWith('/system_stats')) return jsonResponse(200, {});
            probeAttempts += 1;
            if (probeAttempts === 1) throw new Error('connect ECONNREFUSED');
            return jsonResponse(200, { devices: [] });
        }));
        render(<AIComputeSettings />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(screen.getByText(/Retrying every 10 seconds/)).toBeInTheDocument();
        expect(probeAttempts).toBe(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(10_000);
        });

        // Exactly one re-probe after the failure TTL — no fan-out requests.
        expect(probeAttempts).toBe(2);
        expect(screen.getAllByText('Connected', { exact: true }).length).toBeGreaterThan(0);
    });

    it('shows that the API key is stored on the account when settings report hasImageApiKey', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/ai/settings')) {
                return jsonResponse(200, { settings: {
                    targetKind: 'local',
                    protocol: 'openai-image',
                    preference: 'automatic',
                    localEndpoint: '/comfy-api',
                    hostedEndpoint: '',
                    imageApiEndpoint: 'https://img.example.com/v1',
                    imageApiKeyless: false,
                    imageApiModel: 'flux-1',
                    imageApiSize: '1024x1024',
                    endpointConcurrency: 2,
                    hasImageApiKey: true,
                } });
            }
            return jsonResponse(404, {});
        }));
        render(<AIComputeSettings />);
        expect(await screen.findByText(/stored on your account/i)).toBeInTheDocument();
    });

    it('renders safely when older persisted settings omit image API models', async () => {
        const { useStore } = await import('@/store/useStore');
        useStore.setState((state) => ({
            ...state,
            computeSettings: { ...state.computeSettings, protocol: 'openai-image', imageApiModels: undefined as unknown as string[] },
        }));
        render(<AIComputeSettings />);
        expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('');
    });
});
