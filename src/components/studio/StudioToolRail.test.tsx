import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudioToolRail } from './StudioToolRail';

describe('StudioToolRail', () => {
    it('opens the classic Create workflow below Make 3D', () => {
        const onChange = vi.fn();
        render(<StudioToolRail active="generate" onChange={onChange} activeUtility="layers" onUtilityChange={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Create (Legacy)' }));

        expect(onChange).toHaveBeenCalledWith('legacy');
        expect(screen.getByRole('button', { name: 'Create (Legacy)' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('routes utility actions without changing the workflow', () => {
        const onUtilityChange = vi.fn();
        render(<StudioToolRail active="generate" onChange={vi.fn()} activeUtility="layers" onUtilityChange={onUtilityChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Assets' }));

        expect(onUtilityChange).toHaveBeenCalledWith('assets');
    });
});