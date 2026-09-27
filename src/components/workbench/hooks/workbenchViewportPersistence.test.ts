import { beforeEach, describe, expect, it } from 'vitest';
import {
    getCenteredWorkbenchViewport,
    getWorkbenchViewport,
    saveWorkbenchViewport,
    WORKBENCH_DEFAULT_ZOOM,
} from './workbenchViewportPersistence';

describe('workbench viewport persistence', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('stores and restores a viewport per project', () => {
        const viewport = { x: 120, y: -40, zoom: 0.75 };
        saveWorkbenchViewport('project-a', viewport);

        expect(getWorkbenchViewport('project-a')).toEqual(viewport);
        expect(getWorkbenchViewport('project-b')).toBeNull();
    });

    it('ignores malformed or out-of-range viewports', () => {
        window.localStorage.setItem('openviz:workbench-viewport:v1:project-a', '{bad');
        expect(getWorkbenchViewport('project-a')).toBeNull();

        window.localStorage.setItem(
            'openviz:workbench-viewport:v1:project-b',
            JSON.stringify({ x: 0, y: 0, zoom: 4 }),
        );
        expect(getWorkbenchViewport('project-b')).toBeNull();
    });

    it('centers content at the default 50% zoom', () => {
        expect(
            getCenteredWorkbenchViewport(
                [{ position: { x: 0, y: 0 }, width: 200, height: 100 }],
                1000,
                800,
            ),
        ).toEqual({ x: 450, y: 375, zoom: WORKBENCH_DEFAULT_ZOOM });
    });

    it('uses a centered fallback for an empty project', () => {
        expect(getCenteredWorkbenchViewport([], 1000, 800)).toEqual({
            x: 500,
            y: 400,
            zoom: WORKBENCH_DEFAULT_ZOOM,
        });
    });
});
