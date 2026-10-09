import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { useCallback } from 'react';

import { useStore } from '@/store/useStore';
import { parseCollabUrlMap, resolveCollabServerUrl } from '@/services/collab/collabUrl';
import { useCollabSession, type UseCollabSessionResult } from './useCollabSession';

/**
 * Collaboration server WebSocket URL. Adapts to the domain the page was opened
 * from: per-host map first, then a single override, then derivation from the
 * page location (port 1234; devtunnels hosts take no explicit port).
 */
const COLLAB_SERVER_URL = resolveCollabServerUrl({
    url: process.env.NEXT_PUBLIC_COLLAB_URL,
    byHost: parseCollabUrlMap(process.env.NEXT_PUBLIC_COLLAB_URLS),
});

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
