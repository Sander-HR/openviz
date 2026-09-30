import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComputeStatusChip } from './ComputeStatusChip';

describe('ComputeStatusChip', () => {
    it('announces ready compute state', () => {
        render(<ComputeStatusChip status="ready" targetName="Local ComfyUI" tier="FP8" />);
        expect(screen.getByRole('status')).toHaveTextContent('Local ComfyUI');
        expect(screen.getByText('FP8')).toBeInTheDocument();
    });

    it('announces unavailable state', () => {
        render(<ComputeStatusChip status="unavailable" targetName="Local ComfyUI" tier="Auto" />);
        expect(screen.getByRole('status')).toHaveTextContent('Unavailable');
    });
});
