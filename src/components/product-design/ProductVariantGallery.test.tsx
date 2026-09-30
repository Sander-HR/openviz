import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GenerationJob } from '@/types/generationJob.types';
import { ProductVariantGallery } from './ProductVariantGallery';

const job: GenerationJob = {
    id: 'job-1', workflowId: 'product_concept', workflowVersion: '1.0.0', targetId: 'local', targetKind: 'local', modelTier: 'fp8',
    prompt: 'A lamp', references: [], parameters: {}, status: 'completed', progress: 100,
    outputs: [{ url: '/lamp.png', index: 0, contentType: 'image/png' }], createdAt: 1, updatedAt: 1,
};

describe('ProductVariantGallery', () => {
    it('lets a designer select a completed output as a reference', () => {
        const onSelectReference = vi.fn();
        render(<ProductVariantGallery jobs={[job]} onSelectReference={onSelectReference} />);

        fireEvent.click(screen.getByRole('button', { name: /select concept 1/i }));
        expect(onSelectReference).toHaveBeenCalledWith(job, job.outputs[0]);
    });
});
