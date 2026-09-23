import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, workspaces, workspaceMemberships } from "@/lib/db/schema";
import { ensureUserBootstrap } from "@/lib/services/bootstrap";
import { ProjectSchema } from "@/lib/schemas/base";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/projects
 * Fetches all projects for the authenticated user in a specific workspace.
 * Ensures bootstrap data exists and then fetches projects.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    const userId = session.user.id;
    await ensureUserBootstrap(db, {
        userId,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
    });

    const userMemberships = await db
        .select()
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, userId));

    if (!workspaceId) {
        const userProjects = await db
            .select()
            .from(projects)
            .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
            .innerJoin(workspaceMemberships, eq(workspaces.id, workspaceMemberships.workspaceId))
            .where(eq(workspaceMemberships.userId, userId))
            .orderBy(desc(projects.lastViewedAt));

        return NextResponse.json(userProjects.map(p => p.projects));
    }

    // Verify membership in the requested workspace
    const isMember = userMemberships.some(m => m.workspaceId === workspaceId);
    if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const workspaceProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId))
        .orderBy(desc(projects.lastViewedAt));

    return NextResponse.json(workspaceProjects);
}

/**
 * POST /api/projects
 * Creates a new project in a workspace.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    await ensureUserBootstrap(db, {
        userId: session.user.id,
        email: session.user.email ?? null,
        name: session.user.name ?? null,
        image: session.user.image ?? null,
    });

    // If workspaceId is missing, try to find one for the user
    if (!body.workspaceId) {
        const memberships = await db
            .select()
            .from(workspaceMemberships)
            .where(eq(workspaceMemberships.userId, session.user.id))
            .limit(1);

        if (memberships.length > 0) {
            body.workspaceId = memberships[0].workspaceId;
        } else {
            return NextResponse.json({ error: "No workspace found. Please refresh the dashboard." }, { status: 400 });
        }
    }

    const validated = ProjectSchema.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
        lastViewedAt: true,
    }).safeParse(body);

    if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    // Verify membership in the workspace
    const membership = await db
        .select()
        .from(workspaceMemberships)
        .where(
            and(
                eq(workspaceMemberships.workspaceId, validated.data.workspaceId),
                eq(workspaceMemberships.userId, session.user.id)
            )
        );

    if (membership.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [newProject] = await db.insert(projects).values({
        ...validated.data,
        workspaceId: validated.data.workspaceId,
    }).returning();

    return NextResponse.json(newProject);
}
