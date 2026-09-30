import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Make3DPanel } from './Make3DPanel';

describe('Make3DPanel', () => {
    it('exposes reference-aligned model controls and queues generation', () => {
        render(<Make3DPanel />);

        fireEvent.click(screen.getByRole('button', { name: 'Highest' }));
        fireEvent.click(screen.getByRole('button', { name: 'Advanced options' }));
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

        expect(screen.getByRole('button', { name: 'Highest' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Advanced options' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('3D generation queued');
    });
});