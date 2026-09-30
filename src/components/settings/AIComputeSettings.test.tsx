import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AIComputeSettings } from './AIComputeSettings';

vi.mock('@/services/renderService', () => ({
    renderService: { checkConnection: vi.fn().mockResolvedValue(true) },
}));

describe('AIComputeSettings', () => {
    it('shows connection, hardware, and model sections', () => {
        render(<AIComputeSettings />);
        expect(screen.getByRole('heading', { name: 'AI & Compute' })).toBeInTheDocument();
        expect(screen.getByLabelText('ComfyUI endpoint')).toHaveValue('/comfy-api');
        expect(screen.getByText('Hardware detection')).toBeInTheDocument();
        expect(screen.getByText('Models & dependencies')).toBeInTheDocument();
    });

    it('tests the configured connection and reports the result', async () => {
        render(<AIComputeSettings />);
        fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
        expect((await screen.findAllByText('Connected', { exact: true })).length).toBeGreaterThan(0);
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
