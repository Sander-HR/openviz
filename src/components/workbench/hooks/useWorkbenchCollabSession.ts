import { useSession } from 'next-auth/react';

import { useStore } from '@/store/useStore';
import { useCollabSession, type UseCollabSessionResult } from './useCollabSession';

/** Collaboration server WebSocket URL (env-driven; local dev default). */
const COLLAB_SERVER_URL = process.env.NEXT_PUBLIC_COLLAB_URL ?? 'ws://localhost:1234';

export interface WorkbenchCollabSession extends UseCollabSessionResult {
    /** True once the shared document is synced and owns scene writes. */
    active: boolean;
}

/**
 * Joins the collaboration room for the currently open project when a user is
 * signed in. The Workbench component only renders outside STUDIO mode, so no
 * extra view gating is required here.
 */
export function useWorkbenchCollabSession(): WorkbenchCollabSession {
    const currentProjectId = useStore((state) => state.currentProjectId);
    const collabSessionActive = useStore((state) => state.collabSessionActive);
    const { data: session } = useSession();

    const result = useCollabSession({
        projectId: currentProjectId,
        userId: session?.user?.id ?? '',
        userName: session?.user?.name ?? session?.user?.email ?? 'Guest',
        serverUrl: COLLAB_SERVER_URL,
    });

    return { ...result, active: collabSessionActive };
}
