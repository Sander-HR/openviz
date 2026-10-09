import { describe, expect, it } from 'vitest';
import { getFlowModeProps } from './workbenchModeProps';

// T018: mode-derived React Flow props (C-3.1 select mode, C-3.2 hand mode).
// Extracted as a pure function so the contract is testable without rendering
// the full canvas.

describe('getFlowModeProps — select mode (C-3.1)', () => {
    it('enables selection, element selectability, and node dragging', () => {
        const props = getFlowModeProps('select');
        expect(props.selectionOnDrag).toBe(true);
        expect(props.elementsSelectable).toBe(true);
        expect(props.nodesDraggable).toBe(true);
        expect(props.nodesConnectable).toBe(true);
        expect(props.panOnDrag).toBe(false);
    });
});

describe('getFlowModeProps — creation/drawing modes', () => {
    it.each(['draw', 'eraser', 'arrow', 'text', 'note', 'media'] as const)(
        '%s mode disables selection and does not enable hand panning (WIP behavior)',
        (mode) => {
            const props = getFlowModeProps(mode);
            expect(props.selectionOnDrag).toBe(false);
            expect(props.elementsSelectable).toBe(false);
            expect(props.nodesDraggable).toBe(false);
            expect(props.panOnDrag).toBe(false);
        }
    );
});
