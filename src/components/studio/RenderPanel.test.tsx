import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RenderPanel } from './RenderPanel';
import { useStore } from '../../store/useStore';

describe('RenderPanel', () => {
    it('opens the style workflow menu and applies a selection', () => {
        render(<RenderPanel height={600} />);

        const styleButton = screen.getByRole('button', { name: 'Choose style workflow' });
        expect(styleButton).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(styleButton);

        expect(styleButton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Styles', { selector: 'div' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sketch \/ Line Art/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Car Exterior/ })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Sketch \/ Line Art/ }));

        expect(useStore.getState().renderSettings.stylePreset).toBe('Sketch / Line Art');
        expect(styleButton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Styles', { selector: 'div' })).not.toBeInTheDocument();
    });
});