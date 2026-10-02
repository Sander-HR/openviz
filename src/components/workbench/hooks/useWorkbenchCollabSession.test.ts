import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    useSession: vi.fn(),
    useParams: vi.fn(),
    useStore: vi.fn(),
    useCollabSession: vi.fn(),
}));

vi.mock('next-auth/react', () => ({ useSession: mocks.useSession }));
vi.mock('next/navigation', () => ({ useParams: mocks.useParams }));
vi.mock('@/store/useStore', () => ({ useStore: mocks.useStore }));
vi.mock('./useCollabSession', () => ({ useCollabSession: mocks.useCollabSession }));

import { useWorkbenchCollabSession } from './useWorkbenchCollabSession';

const sessionResult = {
    status: 'connecting',
    doc: null,
    sceneName: undefined,
    origin: null,
    commands: null,
    localPersistenceAvailable: true,
    provider: null,
    userId: 'user-1',
    userName: 'User One',
    retryWithFreshToken: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
};

describe('useWorkbenchCollabSession', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useStore.mockImplementation((selector: (state: { currentProjectId: string | null; collabSessionActive: boolean }) => unknown) =>
            selector({ currentProjectId: null, collabSessionActive: false }),
        );
        mocks.useParams.mockReturnValue({ id: 'route-project' });
        mocks.useSession.mockReturnValue({ data: { user: { id: 'user-1', name: 'User One' } } });
        mocks.useCollabSession.mockReturnValue(sessionResult);
    });

    it('uses the dynamic project route when the store project id is not hydrated yet', () => {
        renderHook(() => useWorkbenchCollabSession());

        expect(mocks.useCollabSession).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'route-project' }));
    });

    it('prefers the store project id once the workspace has hydrated it', () => {
        mocks.useStore.mockImplementation((selector: (state: { currentProjectId: string | null; collabSessionActive: boolean }) => unknown) =>
            selector({ currentProjectId: 'store-project', collabSessionActive: false }),
        );

        renderHook(() => useWorkbenchCollabSession());

        expect(mocks.useCollabSession).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'store-project' }));
    });
});
