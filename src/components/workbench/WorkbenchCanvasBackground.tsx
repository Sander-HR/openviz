import { Background, BackgroundVariant } from '@xyflow/react';

import { useWorkbenchThemeStore } from '@/store/slices/workbenchThemeSlice';

/**
 * FR-015 — theme-dependent canvas dot grid.
 * Light: two-layer low-contrast grid (existing behavior). Dark: single
 * #2a2a2c dot layer at 100% opacity on the viz-bg surface. Restyles in place
 * when the theme changes; node cards, toolbars and panels are unaffected.
 */
export function WorkbenchCanvasBackground() {
    const canvasTheme = useWorkbenchThemeStore((state) => state.canvasTheme);

    if (canvasTheme === 'dark') {
        return <Background variant={BackgroundVariant.Dots} gap={12} size={1.4} color="#2a2a2c" />;
    }

    return (
        <>
            <Background id="smalldots" variant={BackgroundVariant.Dots} gap={12} size={1} color="#c6cfdb" />
            <Background id="fatdots" color="#a0afc3" variant={BackgroundVariant.Dots} gap={56} size={1.1} />
        </>
    );
}
