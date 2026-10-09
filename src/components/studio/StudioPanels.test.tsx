import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdjustPanel } from './AdjustPanel';
import { VariationPanel } from './VariationPanel';
import { StudioPanelFrame } from './StudioPanelFrame';

describe('Studio screenshot panels', () => {
    it('supports adjustment controls and action callbacks', () => {
        const enhance = vi.fn();
        const rasterize = vi.fn();
        render(<AdjustPanel onEnhance={enhance} onRasterize={rasterize} />);
        expect(screen.getByRole('heading', { name: 'Adjust' })).toBeInTheDocument();
        expect(screen.getByLabelText('Exposure')).toBeInTheDocument();

        const exposure = screen.getByLabelText('Exposure');
        fireEvent.change(exposure, { target: { value: '4.2' } });
        expect(exposure).toHaveValue('4.2');
        expect(screen.getByText('4.20')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Reset adjustments' }));
        expect(exposure).toHaveValue('0');
        expect(screen.getByText('Adjustments reset')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Toggle settings preview' }));
        expect(screen.getByText('Previewing original')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Enhance' }));
        expect(enhance).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('button', { name: 'Rasterize adjustment' }));
        expect(rasterize).toHaveBeenCalledOnce();
    });

    it('switches Variation modes and exposes editable color palette controls', () => {
        render(<VariationPanel />);
        fireEvent.click(screen.getByRole('tab', { name: 'Color' }));
        expect(screen.getByRole('group', { name: 'color variation controls' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Shuffle palette' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Edit palette color 1' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Edit palette color 1' }));
        expect(screen.getByRole('button', { name: 'Refresh palette' })).toBeInTheDocument();
    });

    it('collapses shared panels to their header', () => {
        render(
            <StudioPanelFrame title="Panel">
                <div data-testid="panel-content">Content</div>
            </StudioPanelFrame>
        );

        const toggle = screen.getByRole('button', { name: 'Panel' });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('panel-content').parentElement).toHaveClass('overflow-y-auto');
        expect(screen.getByTestId('panel-content')).toBeInTheDocument();

        fireEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByTestId('panel-content')).not.toBeInTheDocument();
    });
});