import { auth, db } from '@/lib/auth';
import { projects, scenes, workspaceMemberships } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { issueRoomToken, ROOM_TOKEN_TTL_MS } from '@/services/collab/roomTokenService';

/**
 * POST /api/projects/:id/scenes/collab-token
 *
 * Issues a short-lived (~5 min) signed room token for the project's main
 * scene after full access verification (session + workspace membership).
 * The token is the only credential the collaboration WebSocket accepts.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const membership = await db
        .select()
        .from(workspaceMemberships)
        .where(
            and(
                eq(workspaceMemberships.workspaceId, project.workspaceId),
                eq(workspaceMemberships.userId, session.user.id),
            ),
        )
        .limit(1);
    if (membership.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [mainScene] = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.projectId, projectId), eq(scenes.isMain, true)))
        .limit(1);
    if (!mainScene) {
        return NextResponse.json({ error: 'No main scene' }, { status: 404 });
    }

    const secret = process.env.COLLAB_TOKEN_SECRET;
    if (!secret) {
        return NextResponse.json({ error: 'Collaboration not configured' }, { status: 503 });
    }

    const now = Date.now();
    const token = await issueRoomToken({
        projectId,
        sceneId: mainScene.id,
        userId: session.user.id,
        secret,
        now,
    });

    return NextResponse.json({
        token,
        sceneId: mainScene.id,
        projectId,
        expiresAt: now + ROOM_TOKEN_TTL_MS,
    });
}
