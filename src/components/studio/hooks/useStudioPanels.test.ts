import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useStudioPanels } from './useStudioPanels';

describe('useStudioPanels', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('resizes Create and Results in opposite directions', () => {
        const { result, rerender } = renderHook(() => useStudioPanels({ resultsPanelOpen: true, createPanelCollapsed: false }));

        act(() => {
            Object.defineProperty(result.current.containerRef, 'current', {
                configurable: true,
                value: { clientHeight: 600 },
            });
            window.dispatchEvent(new Event('resize'));
            rerender();
        });

        const preventDefault = vi.fn();
        const initialRenderHeight = result.current.renderPanelHeight;

        act(() => {
            result.current.handleResizeStart({ clientY: 300, preventDefault } as unknown as ReactPointerEvent);
        });
        act(() => {
            window.dispatchEvent(new PointerEvent('pointermove', { clientY: 260 }));
        });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(result.current.renderPanelHeight).not.toBe(initialRenderHeight);
        expect(result.current.renderPanelHeight + result.current.resultsPanelHeight).toBeLessThanOrEqual(600);
        expect(result.current.resultsPanelHeight).toBeGreaterThanOrEqual(280);
        expect(result.current.resultsPanelHeight).toBeLessThanOrEqual(400);

        act(() => {
            window.dispatchEvent(new MouseEvent('mouseup'));
        });
    });

    it('ignores resize attempts while Results is collapsed', () => {
        const { result } = renderHook(() => useStudioPanels({ resultsPanelOpen: false, createPanelCollapsed: false }));
        const preventDefault = vi.fn();
        const initialRenderHeight = result.current.renderPanelHeight;

        act(() => {
            result.current.handleResizeStart({ clientY: 300, preventDefault } as unknown as ReactPointerEvent);
        });
        act(() => {
            window.dispatchEvent(new PointerEvent('pointermove', { clientY: 340 }));
        });

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(result.current.renderPanelHeight).toBe(initialRenderHeight);
    });

    it.each([
        { resultsPanelOpen: false, createPanelCollapsed: false },
        { resultsPanelOpen: true, createPanelCollapsed: false },
        { resultsPanelOpen: true, createPanelCollapsed: true },
    ])('keeps short panel stacks within the container', (options) => {
        const { result } = renderHook(() => useStudioPanels(options));

        act(() => {
            Object.defineProperty(result.current.containerRef, 'current', {
                configurable: true,
                value: { clientHeight: 100 },
            });
            window.dispatchEvent(new Event('resize'));
        });

        const stackGap = options.resultsPanelOpen && !options.createPanelCollapsed ? 1.6 * 2 + 5 : 1.6;
        const availableHeight = 100 - 16 - stackGap;

        expect(result.current.renderPanelHeight + result.current.resultsPanelHeight).toBeLessThanOrEqual(availableHeight);
        expect(result.current.renderPanelHeight).toBeGreaterThanOrEqual(0);
        expect(result.current.resultsPanelHeight).toBeGreaterThanOrEqual(0);
    });
});
