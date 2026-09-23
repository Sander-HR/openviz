import { and, eq } from 'drizzle-orm';
import type { onAuthenticatePayload } from '@hocuspocus/server';
import { verifyRoomToken } from '../../src/services/collab/roomTokenService';
import { projects, scenes, workspaceMemberships } from '../../src/lib/db/schema';
import { getDb } from './db';

export interface OnAuthenticateDependencies {
    /** Shared HMAC secret; when missing the hook fails closed. */
    secret?: string;
    /** Membership re-check for (sceneId, userId). Injectable for tests. */
    checkMembership: (sceneId: string, userId: string) => Promise<boolean>;
    /** Injectable clock for deterministic expiry checks in tests. */
    now?: number;
}

/**
 * Default membership re-check mirroring the app's `canAccessProject` pattern:
 * scene → project → workspace membership for the user.
 */
export async function hasProjectAccessForScene(sceneId: string, userId: string): Promise<boolean> {
    const db = getDb();
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1);
    if (!scene) return false;

    const [project] = await db.select().from(projects).where(eq(projects.id, scene.projectId)).limit(1);
    if (!project) return false;

    const membership = await db
        .select()
        .from(workspaceMemberships)
        .where(
            and(
                eq(workspaceMemberships.workspaceId, project.workspaceId),
                eq(workspaceMemberships.userId, userId),
            ),
        )
        .limit(1);

    return membership.length > 0;
}

/**
 * Hocuspocus `onAuthenticate` handler (SC-006): verifies the room token
 * (signature, expiry, scene scope) and re-checks project membership in
 * Postgres. Returns the authenticated context or null to reject.
 */
export function createOnAuthenticate(deps: OnAuthenticateDependencies) {
    return async (data: onAuthenticatePayload): Promise<Record<string, unknown> | null> => {
        if (!deps.secret) return null;

        const result = await verifyRoomToken(data.token, {
            secret: deps.secret,
            expectedSceneId: data.documentName,
            now: deps.now,
        });
        if (!result.ok) return null;

        const isMember = await deps.checkMembership(result.payload.sceneId, result.payload.userId);
        if (!isMember) return null;

        return { userId: result.payload.userId };
    };
}
