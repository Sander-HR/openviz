import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkbenchKeyboardShortcuts } from './useWorkbenchKeyboardShortcuts';

// T007: tool shortcut activation (C-2.2), input-focus suppression (C-2.3),
// and regression assertions for pre-existing bindings (FR-017).

function makeOptions(overrides: Partial<ReturnType<typeof baseOptions>> = {}) {
    return { ...baseOptions(), ...overrides };
}

function baseOptions() {
    return {
        copyToClipboard: vi.fn(),
        pasteFromClipboard: vi.fn(),
        duplicateWorkbenchNode: vi.fn(),
        removeWorkbenchNode: vi.fn(),
        reorderWorkbenchNode: vi.fn(),
        activeNodeId: 'node-1' as string | null,
        selectedNodeIds: ['node-1'] as string[],
        getMousePosition: vi.fn(() => ({ x: 0, y: 0 })),
        screenToFlowPosition: vi.fn((p: { x: number; y: number }) => p),
        setActiveWorkbenchTool: vi.fn(),
        undoWorkbench: vi.fn(),
        redoWorkbench: vi.fn(),
        panViewport: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        fitView: vi.fn(),
        resetView: vi.fn(),
        zoomTo100: vi.fn(),
        clearSelection: vi.fn(),
    };
}

function pressKey(key: string, init: KeyboardEventInit = {}) {
    act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
    });
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('useWorkbenchKeyboardShortcuts — tool activation (C-2.2)', () => {
    it.each([
        ['v', 'select'],
        ['d', 'draw'],
        ['e', 'eraser'],
        ['a', 'arrow'],
        ['t', 'text'],
        ['n', 'note'],
        ['m', 'media'],
    ] as const)('pressing %s activates the %s tool', (key, tool) => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey(key);
        expect(options.setActiveWorkbenchTool).toHaveBeenCalledWith(tool);
    });

    it('ignores modifier-combined tool keys (FR-017: Mod shortcuts unchanged)', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('v', { ctrlKey: true });
        expect(options.setActiveWorkbenchTool).not.toHaveBeenCalledWith('select');
    });
});

describe('useWorkbenchKeyboardShortcuts — input focus suppression (C-2.3)', () => {
    it.each([
        ['input', 'INPUT'],
        ['textarea', 'TEXTAREA'],
    ] as const)('does not switch tools while typing in a %s', (_label, tag) => {
            const options = makeOptions();
            renderHook(() => useWorkbenchKeyboardShortcuts(options));
            const el = document.createElement(tag);
            document.body.appendChild(el);
            el.focus();

            act(() => {
                el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
            });
            expect(options.setActiveWorkbenchTool).not.toHaveBeenCalled();
        },
    );

    it('does not switch tools while editing a contenteditable element', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        // jsdom does not implement HTMLElement.isContentEditable — define it
        // explicitly so the handler's contenteditable guard is exercised.
        Object.defineProperty(el, 'isContentEditable', { value: true });
        document.body.appendChild(el);

        act(() => {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        });
        expect(options.setActiveWorkbenchTool).not.toHaveBeenCalled();
    });
});

describe('useWorkbenchKeyboardShortcuts — viewport and cancellation shortcuts', () => {
    it.each([
        ['ArrowUp', 'up'],
        ['ArrowDown', 'down'],
        ['ArrowLeft', 'left'],
        ['ArrowRight', 'right'],
    ] as const)('maps %s to viewport panning', (key, direction) => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey(key);
        expect(options.panViewport).toHaveBeenCalledWith(direction);
    });

    it('maps zoom and view shortcuts', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('+');
        pressKey('=');
        pressKey('-');
        pressKey('1', { shiftKey: true });
        pressKey('0', { shiftKey: true });
        pressKey('r', { shiftKey: true });
        expect(options.zoomIn).toHaveBeenCalledTimes(2);
        expect(options.zoomOut).toHaveBeenCalledTimes(1);
        expect(options.fitView).toHaveBeenCalledTimes(1);
        expect(options.zoomTo100).toHaveBeenCalledTimes(1);
        expect(options.resetView).toHaveBeenCalledTimes(1);
    });

    it('clears selection on Escape', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('Escape');
        expect(options.clearSelection).toHaveBeenCalledTimes(1);
    });
});

describe('useWorkbenchKeyboardShortcuts — pre-existing bindings unchanged (FR-017)', () => {
    it('Mod+z undoes, Mod+y redoes', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('z', { metaKey: true });
        expect(options.undoWorkbench).toHaveBeenCalledTimes(1);
        pressKey('y', { ctrlKey: true });
        expect(options.redoWorkbench).toHaveBeenCalledTimes(1);
    });

    it('Mod+c / Mod+v / Mod+d copy, paste and duplicate', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('c', { metaKey: true });
        expect(options.copyToClipboard).toHaveBeenCalledTimes(1);
        pressKey('v', { metaKey: true });
        expect(options.pasteFromClipboard).toHaveBeenCalledWith({ x: 0, y: 0 });
        pressKey('d', { metaKey: true });
        expect(options.duplicateWorkbenchNode).toHaveBeenCalledTimes(1);
    });

    it('Delete removes the selection when present', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('Delete');
        expect(options.removeWorkbenchNode).toHaveBeenCalledTimes(1);
    });

    it('[ and ] reorder the active node back/front', () => {
        const options = makeOptions();
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('[');
        expect(options.reorderWorkbenchNode).toHaveBeenCalledWith('node-1', 'back');
        pressKey(']');
        expect(options.reorderWorkbenchNode).toHaveBeenCalledWith('node-1', 'front');
    });

    it('Delete without a selection does nothing', () => {
        const options = makeOptions({ selectedNodeIds: [] });
        renderHook(() => useWorkbenchKeyboardShortcuts(options));
        pressKey('Backspace');
        expect(options.removeWorkbenchNode).not.toHaveBeenCalled();
    });
});
