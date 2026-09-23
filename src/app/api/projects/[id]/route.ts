import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, scenes, workspaceMemberships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

async function canAccessProject(projectId: string, userId: string) {
    const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

    if (!project) {
        return { project: null, allowed: false };
    }

    const membership = await db
        .select()
        .from(workspaceMemberships)
        .where(
            and(
                eq(workspaceMemberships.workspaceId, project.workspaceId),
                eq(workspaceMemberships.userId, userId)
            )
        )
        .limit(1);

    return { project, allowed: membership.length > 0 };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { project, allowed } = await canAccessProject(id, session.user.id);
    if (!project) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Fetch the main scene for this project
    const [scene] = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.projectId, id), eq(scenes.isMain, true)))
        .limit(1);

    // Update lastViewedAt when project is accessed
    await db
        .update(projects)
        .set({ lastViewedAt: new Date() })
        .where(eq(projects.id, id));

    return NextResponse.json({
        ...project,
        lastViewedAt: new Date(),
        scene: scene ? scene.data : null,
        sceneVersion: scene?.version ?? 0,
    });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { project, allowed } = await canAccessProject(id, session.user.id);
    if (!project) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    const [updated] = await db
        .update(projects)
        .set({
            ...body,
            updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

    if (!updated) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { project, allowed } = await canAccessProject(id, session.user.id);
    if (!project) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [deleted] = await db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();

    if (!deleted) return NextResponse.json({ error: "Not Found" }, { status: 404 });

    return NextResponse.json(deleted);
}
