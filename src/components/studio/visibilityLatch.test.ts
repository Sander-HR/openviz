import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibilityLatch } from './visibilityLatch';

describe('useVisibilityLatch (Sprint 3 — Studio visibility gating)', () => {
    it('starts armed when visible at mount', () => {
        const { result } = renderHook(() => useVisibilityLatch(true));
        expect(result.current).toBe(true);
    });

    it('stays disarmed while hidden, arms on first visibility', () => {
        const { result, rerender } = renderHook(({ active }) => useVisibilityLatch(active), { initialProps: { active: false } });
        expect(result.current).toBe(false);
        rerender({ active: true });
        expect(result.current).toBe(true);
    });

    it('is one-way: hiding again never disarms (no re-fetch flicker)', () => {
        const { result, rerender } = renderHook(({ active }) => useVisibilityLatch(active), { initialProps: { active: false } });
        rerender({ active: true });
        expect(result.current).toBe(true);
        rerender({ active: false });
        expect(result.current).toBe(true);
    });
});
