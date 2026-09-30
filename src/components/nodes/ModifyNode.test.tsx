import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModifyNode } from './ModifyNode';

vi.mock('@xyflow/react', () => ({
    Handle: () => <div data-testid="handle" />,
    Position: { Left: 'left', Right: 'right' },
    useConnection: () => ({ inProgress: false }),
}));

const data = {
    id: 'modify-1',
    type: 'modify' as const,
    x: 0,
    y: 0,
    width: 320,
    height: 560,
    data: {
        workflowId: 'product_edit',
        prompt: '',
        aspectRatio: 'square' as const,
        preservation: 0.78,
        structureStrength: 0.72,
        references: [{ assetId: 'image-1', role: 'primary' as const, token: '@1' }],
        numImages: 1,
        status: 'idle' as const,
    },
};

describe('ModifyNode', () => {
    it('renders Vizcom-style prompt controls and source reference', () => {
        render(<ModifyNode id="modify-1" data={data} selected={false} />);

        expect(screen.getByRole('heading', { name: 'Modify' })).toBeInTheDocument();
        expect(screen.getByLabelText('What should change?')).toBeInTheDocument();
        expect(screen.getAllByText('@1', { exact: true }).length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
    });

    it('updates the prompt and submits through the node callback', () => {
        const onGenerate = vi.fn();
        render(<ModifyNode id="modify-1" data={{ ...data, onGenerate }} selected />);

        fireEvent.change(screen.getByLabelText('What should change?'), {
            target: { value: 'Replace the plastic housing with brushed aluminum.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

        expect(onGenerate).toHaveBeenCalledWith('modify-1');
    });
});
