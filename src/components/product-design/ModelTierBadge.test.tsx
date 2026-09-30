import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ModelTierBadge } from './ModelTierBadge';

describe('ModelTierBadge', () => {
    it('shows the selected tier and explanation', () => {
        render(<ModelTierBadge tier="FP8" explanation="24 GB free VRAM" />);
        expect(screen.getByText('FP8')).toBeInTheDocument();
        expect(screen.getByTitle('24 GB free VRAM')).toBeInTheDocument();
    });
});
