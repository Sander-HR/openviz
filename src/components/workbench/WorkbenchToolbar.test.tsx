import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkbenchToolType } from '@/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest runs without `globals:true`, so RTL's auto-cleanup is not registered;
// unmount explicitly between tests to avoid DOM accumulation.
afterEach(cleanup);
import { WorkbenchToolbar } from './WorkbenchToolbar';

// T008/T009: toolbar structure (C-1.1–C-1.3) and click activation (C-2.1).

const TOOL_TITLES: Array<[WorkbenchToolType, string]> = [
    ['select', 'Select (V)'],
    ['draw', 'Draw (D)'],
    ['eraser', 'Eraser (E)'],
    ['arrow', 'Arrow (A)'],
    ['text', 'Text (T)'],
    ['note', 'Note (N)'],
    ['media', 'Media (M)'],
];

function renderToolbar(
    activeTool: WorkbenchToolType = 'select',
    sketchFormats: Array<{ label: string; width: number; height: number }> = [],
    canUndo = true,
    canRedo = true
) {
    const onSelectTool = vi.fn();
    const onMediaUpload = vi.fn();
    const onMediaUploadFromPhone = vi.fn();
    const onFormatSelect = vi.fn();
    const utils = render(
        <WorkbenchToolbar
            activeTool={activeTool}
            freehandColor="#ffffff"
            freehandStrokeWidth={4}
            onSelectTool={onSelectTool}
            onFreehandColorChange={vi.fn()}
            onFreehandStrokeWidthChange={vi.fn()}
            onUndo={vi.fn()}
            onRedo={vi.fn()}
            canUndo={canUndo}
            canRedo={canRedo}
            onMediaUpload={onMediaUpload}
            onMediaUploadFromPhone={onMediaUploadFromPhone}
            sketchFormats={sketchFormats}
            onFormatSelect={onFormatSelect}
        />
    );
    return { onSelectTool, onMediaUpload, onMediaUploadFromPhone, onFormatSelect, ...utils };
}

describe('WorkbenchToolbar — structure (C-1)', () => {
    it('shows the Workbench tools in order Select→Media without a Hand tool', () => {
        renderToolbar();
        const titles = TOOL_TITLES.map(([, title]) => screen.queryByTitle(title));
        // All present
        for (const el of titles) {
            expect(el).not.toBeNull();
        }
        // Exactly seven tool buttons (no duplicates in the toolbar)
        expect(titles.filter(Boolean)).toHaveLength(7);
        // Order: each subsequent button must follow the previous in document order
        for (let i = 1; i < titles.length; i++) {
            expect(titles[i - 1]!.compareDocumentPosition(titles[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        }
    });

    it('marks only the active tool with aria-pressed="true" (C-1.3)', () => {
        renderToolbar('arrow');
        expect(screen.getByTitle('Arrow (A)').getAttribute('aria-pressed')).toBe('true');
        for (const [tool, title] of TOOL_TITLES) {
            if (tool === 'arrow') continue;
            expect(screen.getByTitle(title).getAttribute('aria-pressed')).toBe('false');
        }
    });
});

describe('WorkbenchToolbar — history availability', () => {
    it('disables Undo and Redo when their actions are unavailable', () => {
        renderToolbar('select', [], false, false);

        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    });
});

describe('WorkbenchToolbar — click activation (C-2.1)', () => {
    it.each(TOOL_TITLES)('clicking %s activates the %s tool', (tool, title) => {
        const { onSelectTool } = renderToolbar();
        fireEvent.click(screen.getByTitle(title));
        expect(onSelectTool).toHaveBeenCalledWith(tool);
    });

    it('clicking an already-active tool does not error and still reports the tool', () => {
        const { onSelectTool } = renderToolbar('select');
        fireEvent.click(screen.getByTitle('Select (V)'));
        expect(onSelectTool).toHaveBeenCalledWith('select');
    });
});

describe('WorkbenchToolbar — Media submenu (C-1.4, C-1.5)', () => {
    it('opens a submenu containing Upload and Upload from phone', () => {
        renderToolbar();
        // Radix DropdownMenu.Trigger opens on pointerdown (button 0)
        fireEvent.pointerDown(screen.getByTitle('Media (M)'), { button: 0 });

        expect(screen.getByText('Upload')).toBeTruthy();
        expect(screen.getByText('Upload from phone')).toBeTruthy();
    });

    it('Upload triggers onMediaUpload and closes the submenu', () => {
        const { onMediaUpload } = renderToolbar();
        // Radix DropdownMenu.Trigger opens on pointerdown (button 0)
        fireEvent.pointerDown(screen.getByTitle('Media (M)'), { button: 0 });

        fireEvent.click(screen.getByText('Upload'));

        expect(onMediaUpload).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Upload from phone')).toBeNull();
    });

    it('Upload from phone triggers onMediaUploadFromPhone', () => {
        const { onMediaUploadFromPhone } = renderToolbar();
        // Radix DropdownMenu.Trigger opens on pointerdown (button 0)
        fireEvent.pointerDown(screen.getByTitle('Media (M)'), { button: 0 });

        fireEvent.click(screen.getByText('Upload from phone'));

        expect(onMediaUploadFromPhone).toHaveBeenCalledTimes(1);
    });

    it('selecting a Create new format calls onFormatSelect', () => {
        const { onFormatSelect } = renderToolbar('media', [
            { label: 'Square 1:1', width: 1024, height: 1024 },
        ]);
        fireEvent.pointerDown(screen.getByTitle('Media (M)'), { button: 0 });
        fireEvent.click(screen.getByText('Create new'));
        fireEvent.click(screen.getByText('Square 1:1'));

        expect(onFormatSelect).toHaveBeenCalledWith(1024, 1024);
    });

    it('Create-new section lists only the provided sketch formats (C-1.5)', () => {
        renderToolbar('media', [
            { label: 'A4 portrait', width: 794, height: 1123 },
            { label: 'Square 1:1', width: 1024, height: 1024 },
        ]);
        // Radix DropdownMenu.Trigger opens on pointerdown (button 0)
        fireEvent.pointerDown(screen.getByTitle('Media (M)'), { button: 0 });

        expect(screen.getByText('Create new')).toBeTruthy();
        // The format list expands on demand (pre-existing sketch creation, FR-017)
        fireEvent.click(screen.getByText('Create new'));

        expect(screen.getByText('A4 portrait')).toBeTruthy();
        expect(screen.getByText('Square 1:1')).toBeTruthy();
    });
});
