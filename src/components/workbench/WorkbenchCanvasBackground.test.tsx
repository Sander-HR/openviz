import { act, cleanup, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';

// vitest runs without `globals:true`, so RTL's auto-cleanup is not registered;
// unmount explicitly between tests to avoid DOM accumulation.
afterEach(cleanup);

import { WorkbenchCanvasBackground } from './WorkbenchCanvasBackground';
import { useWorkbenchThemeStore } from '@/store/slices/workbenchThemeSlice';

// T014: FR-015 canvas layer theming — light default (two-layer dot grid),
// dark = single low-contrast dot layer (#2a2a2c at 100% opacity). Node cards,
// toolbars and panels are unaffected (covered by their own tests + SC-001 audit).

function backgroundLayers() {
    return Array.from(document.querySelectorAll<SVGElement>('svg.react-flow__background'));
}

// xyflow applies the `color` prop as a CSS custom property on the svg element.
function dotColors(): string[] {
    return backgroundLayers().map((svg) =>
        svg.style.getPropertyValue('--xy-background-pattern-color-props'),
    );
}

describe('WorkbenchCanvasBackground', () => {
    it('renders the light two-layer dot grid by default', () => {
        useWorkbenchThemeStore.setState({ canvasTheme: 'light' });
        render(
            <ReactFlowProvider>
                <WorkbenchCanvasBackground />
            </ReactFlowProvider>,
        );

        expect(backgroundLayers()).toHaveLength(2);
        expect(dotColors().sort()).toEqual(['#a0afc3', '#c6cfdb']);
    });

    it('renders the dark single dot layer at #2a2a2c when theme is dark', () => {
        useWorkbenchThemeStore.setState({ canvasTheme: 'dark' });
        render(
            <ReactFlowProvider>
                <WorkbenchCanvasBackground />
            </ReactFlowProvider>,
        );

        expect(backgroundLayers()).toHaveLength(1);
        expect(dotColors()).toEqual(['#2a2a2c']);
    });

    it('restyles in place when the theme changes while mounted (no remount required)', () => {
        useWorkbenchThemeStore.setState({ canvasTheme: 'light' });
        render(
            <ReactFlowProvider>
                <WorkbenchCanvasBackground />
            </ReactFlowProvider>,
        );

        expect(backgroundLayers()).toHaveLength(2);

        act(() => {
            useWorkbenchThemeStore.getState().setCanvasTheme('dark');
        });

        expect(backgroundLayers()).toHaveLength(1);
        expect(dotColors()).toEqual(['#2a2a2c']);
    });
});
