import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest runs without `globals:true`, so RTL's auto-cleanup is not registered;
// unmount explicitly between tests to avoid DOM accumulation.
afterEach(cleanup);

const { storeState, routerPush } = vi.hoisted(() => ({
    storeState: {
        currentProjectId: null,
        project: { name: 'Test Project' },
        setName: () => {},
    },
    routerPush: () => {},
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush }),
}));
vi.mock('../../store/useStore', () => ({
    useStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));
vi.mock('../../hooks/useCurrentProject', () => ({
    useCurrentProject: () => ({ project: null, updateProjectName: () => {}, isUpdating: false }),
}));

import { ProjectHeader } from './ProjectHeader';
import { useWorkbenchThemeStore } from '@/store/slices/workbenchThemeSlice';

// T017: FR-015 — top-left application menu with Light/Dark canvas theme select.

// Radix triggers open on pointer interaction; jsdom needs the explicit
// pointer sequence before the click event.
function openAppMenu() {
    const trigger = screen.getByRole('button', { name: /OpenViz/i });
    fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
    fireEvent.pointerUp(trigger, { pointerType: 'mouse', button: 0 });
    fireEvent.click(trigger);
}

describe('ProjectHeader app menu', () => {
    it('renders the OpenViz app-menu trigger next to the project name', () => {
        render(<ProjectHeader />);

        expect(screen.getByRole('button', { name: /OpenViz/i })).toBeInTheDocument();
    });

    it('selecting Dark from the menu sets and persists the theme store', async () => {
        useWorkbenchThemeStore.setState({ canvasTheme: 'light' });
        render(<ProjectHeader />);

        openAppMenu();
        const darkItem = await screen.findByText('Dark');
        fireEvent.click(darkItem);

        expect(useWorkbenchThemeStore.getState().canvasTheme).toBe('dark');
        const raw = localStorage.getItem('openviz.workbench.canvasTheme');
        expect(raw).toContain('"canvasTheme":"dark"');
    });

    it('marks the active theme with a check indicator', async () => {
        useWorkbenchThemeStore.setState({ canvasTheme: 'dark' });
        render(<ProjectHeader />);

        openAppMenu();
        await screen.findByText('Light');

        const darkRow = screen.getByText('Dark').closest('[role="menuitem"]');
        const lightRow = screen.getByText('Light').closest('[role="menuitem"]');
        // Active row carries an extra <Check> icon: [Moon, Check] vs [Sun]
        expect(darkRow?.querySelectorAll('svg')).toHaveLength(2);
        expect(lightRow?.querySelectorAll('svg')).toHaveLength(1);
    });
});
