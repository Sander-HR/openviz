import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { useCallback } from 'react';

import { useStore } from '@/store/useStore';
import { resolveCollabServerUrl } from '@/services/collab/collabUrl';
import { useCollabSession, type UseCollabSessionResult } from './useCollabSession';

/** Collaboration server WebSocket URL (env-driven; local dev default). */
const COLLAB_SERVER_URL = resolveCollabServerUrl(process.env.NEXT_PUBLIC_COLLAB_URL);

export interface WorkbenchCollabSession extends UseCollabSessionResult {
    /** True once the shared document is synced and owns scene writes. */
    active: boolean;
    sceneName: string | undefined;
    renameScene(name: string): void;
}

/**
 * Joins the collaboration room for the currently open project when a user is
 * signed in. The Workbench component only renders outside STUDIO mode, so no
 * extra view gating is required here.
 */
export function useWorkbenchCollabSession(): WorkbenchCollabSession {
    const currentProjectId = useStore((state) => state.currentProjectId);
    const routeParams = useParams<{ id: string }>();
    const projectId = currentProjectId ?? routeParams?.id ?? null;
    const collabSessionActive = useStore((state) => state.collabSessionActive);
    const { data: session } = useSession();

    const result = useCollabSession({
        projectId,
        userId: session?.user?.id ?? '',
        userName: session?.user?.name ?? session?.user?.email ?? 'Guest',
        serverUrl: COLLAB_SERVER_URL,
    });
    const renameScene = useCallback((name: string) => {
        result.commands?.setSceneName(name);
    }, [result.commands]);

    return { ...result, active: collabSessionActive, renameScene };
}
