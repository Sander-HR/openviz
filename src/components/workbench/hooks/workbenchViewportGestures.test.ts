import { describe, expect, it } from 'vitest';
import { WORKBENCH_PAN_MOUSE_BUTTON } from './workbenchViewportGestures';

describe('Workbench viewport gestures', () => {
    it('uses the middle mouse button for drag panning', () => {
        expect(WORKBENCH_PAN_MOUSE_BUTTON).toBe(1);
    });
});
