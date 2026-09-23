import { describe, expect, it } from 'vitest';
import type { WorkbenchToolType } from '@/types';

// T003: pure tool semantics (FR-006 sticky vs FR-007 one-shot, C-2.2 shortcut map)
// Module under test: src/store/workbenchTools.ts (T004 implements it)

describe('workbenchTools — shortcut map', () => {
    it('maps every tool key to its WorkbenchToolType (C-2.2)', async () => {
        const { TOOL_SHORTCUT_MAP } = await import('./workbenchTools');
        expect(TOOL_SHORTCUT_MAP).toEqual({
            v: 'select',
            h: 'hand',
            d: 'draw',
            e: 'eraser',
            a: 'arrow',
            t: 'text',
            n: 'note',
            m: 'media',
        });
    });

    it('covers all eight tools exactly once', async () => {
        const { TOOL_SHORTCUT_MAP } = await import('./workbenchTools');
        const tools: WorkbenchToolType[] = Object.values(TOOL_SHORTCUT_MAP);
        expect(tools).toHaveLength(8);
        expect(new Set(tools).size).toBe(8);
    });
});

describe('workbenchTools — sticky classification (FR-006)', () => {
    it('draw and eraser are sticky', async () => {
        const { isStickyTool } = await import('./workbenchTools');
        expect(isStickyTool('draw')).toBe(true);
        expect(isStickyTool('eraser')).toBe(true);
    });

    it('all other tools are not sticky', async () => {
        const { isStickyTool } = await import('./workbenchTools');
        for (const tool of ['select', 'hand', 'arrow', 'text', 'note', 'media'] as WorkbenchToolType[]) {
            expect(isStickyTool(tool)).toBe(false);
        }
    });
});

describe('workbenchTools — one-shot classification (FR-007)', () => {
    it('arrow, text, note and media are one-shot', async () => {
        const { isOneShotTool } = await import('./workbenchTools');
        for (const tool of ['arrow', 'text', 'note', 'media'] as WorkbenchToolType[]) {
            expect(isOneShotTool(tool)).toBe(true);
        }
    });

    it('select, hand, draw and eraser are not one-shot', async () => {
        const { isOneShotTool } = await import('./workbenchTools');
        for (const tool of ['select', 'hand', 'draw', 'eraser'] as WorkbenchToolType[]) {
            expect(isOneShotTool(tool)).toBe(false);
        }
    });

    it('sticky and one-shot sets are mutually exclusive', async () => {
        const { isStickyTool, isOneShotTool } = await import('./workbenchTools');
        for (const tool of ['select', 'hand', 'draw', 'eraser', 'arrow', 'text', 'note', 'media'] as WorkbenchToolType[]) {
            expect(isStickyTool(tool) && isOneShotTool(tool)).toBe(false);
        }
    });
});
