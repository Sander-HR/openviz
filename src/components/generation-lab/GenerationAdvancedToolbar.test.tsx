import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { GenerationAdvancedToolbar } from '@/components/generation-lab/GenerationAdvancedToolbar';
import type { AdvancedConfiguration } from '@/components/generation-lab/generationNodeMockup.types';

const DEFAULTS: AdvancedConfiguration = { open: false, steps: 30, guidance: 4, referenceResolution: 1024 };
const ANCHOR = { flowX: 430, flowY: 90, width: 280 };

/** Controlled harness: applies patches like the lab canvas does. */
function Harness({ initial = DEFAULTS }: { initial?: AdvancedConfiguration }) {
    const [value, setValue] = useState(initial);
    return (
        <ReactFlowProvider>
            <GenerationAdvancedToolbar anchor={ANCHOR} value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} />
        </ReactFlowProvider>
    );
}

describe('GenerationAdvancedToolbar — floating advanced settings above the generate node', () => {
    it('shows only the settings icon in the toolbar and keeps the panel hidden until clicked', () => {
        render(<Harness />);
        const toggle = screen.getByRole('button', { name: /advanced settings/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('region', { name: /advanced settings/i })).not.toBeInTheDocument();
    });

    it('reveals the floating panel with exactly the three power-user controls on click', () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: /advanced settings/i }));

        expect(screen.getByLabelText(/generation quality|steps/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/prompt adherence|guidance/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/reference resolution/i)).toBeInTheDocument();
    });

    it('reports safe defaults: 30 steps, guidance 4.0, 1024 reference resolution', () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: /advanced settings/i }));

        expect((screen.getByLabelText(/generation quality|steps/i) as HTMLSelectElement).value).toBe('30');
        expect(Number((screen.getByLabelText(/prompt adherence|guidance/i) as HTMLInputElement).value)).toBe(4);
        expect((screen.getByLabelText(/reference resolution/i) as HTMLSelectElement).value).toBe('1024');
    });

    it('patches the advanced configuration on change', () => {
        const onChange = vi.fn();
        render(
            <ReactFlowProvider>
                <GenerationAdvancedToolbar anchor={ANCHOR} value={{ ...DEFAULTS, open: true }} onChange={onChange} />
            </ReactFlowProvider>,
        );

        fireEvent.change(screen.getByLabelText(/generation quality|steps/i), { target: { value: '50' } });
        expect(onChange).toHaveBeenCalledWith({ steps: 50 });

        fireEvent.change(screen.getByLabelText(/prompt adherence|guidance/i), { target: { value: '6.5' } });
        expect(onChange).toHaveBeenCalledWith({ guidance: 6.5 });

        fireEvent.change(screen.getByLabelText(/reference resolution/i), { target: { value: '2048' } });
        expect(onChange).toHaveBeenCalledWith({ referenceResolution: 2048 });
    });

    it('never renders deferred controls (mask, LoRA, control conditioning, upscale) in the MVP UI', () => {
        render(
            <ReactFlowProvider>
                <GenerationAdvancedToolbar anchor={ANCHOR} value={{ ...DEFAULTS, open: true }} onChange={vi.fn()} />
            </ReactFlowProvider>,
        );
        const text = screen.getByRole('region', { name: /advanced settings/i }).textContent ?? '';
        expect(text).not.toMatch(/mask/i);
        expect(text).not.toMatch(/lora/i);
        expect(text).not.toMatch(/control conditioning|controlnet/i);
        expect(text).not.toMatch(/upscale/i);
    });
});
