import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, workspaces, workspaceMemberships, users } from "@/lib/db/schema";
import { ProjectSchema } from "@/lib/schemas/base";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/projects
 * Fetches all projects for the authenticated user in a specific workspace.
 * Auto-initializes user and default workspace if they don't exist.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    const userId = session.user.id;

    // 1. Ensure user exists in our DB
    const [existingUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!existingUser) {
        await db.insert(users).values({
            id: userId,
            email: session.user.email || "",
            name: session.user.name || "",
        });
    }

    // 2. Check for workspace membership to ensure user can access this workspace
    // If no workspaceId is provided, fallback to matching any workspace the user is in (or return empty)
    // But for this feature request, we want strict filtering. 
    // If workspaceId is missing, we might return an empty list or error, but let's handle the auto-init case first.

    const userMemberships = await db
        .select()
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, userId));

    if (userMemberships.length === 0) {
        // ... (Same auto-init logic as before) ...
        const [newWorkspace] = await db.insert(workspaces).values({
            name: "Default Workspace",
            slug: `default-${userId.slice(0, 8)}`,
            ownerId: userId,
        }).returning();

        await db.insert(workspaceMemberships).values({
            workspaceId: newWorkspace.id,
            userId: userId,
            role: "owner",
        });

        await db.insert(projects).values({
            name: "Introduction",
            description: "Welcome to OpenViz! This is your first project.",
            workspaceId: newWorkspace.id,
        });

        // Return the projects for this new workspace
        const userProjects = await db
            .select()
            .from(projects)
            .where(eq(projects.workspaceId, newWorkspace.id))
            .orderBy(desc(projects.lastViewedAt));

        return NextResponse.json(userProjects);
    }

    if (!workspaceId) {
        // If no workspace specified, return all projects for user (legacy behavior) or empty?
        // Let's return all projects the user has access to for now, or just projects from the first found workspace?
        // The implementation plan says "Filter projects by this workspaceId". 
        // If the frontend always sends workspaceId (which it should), this is fine.
        // If not, let's return all projects the user is a member of workspaces for.
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
            // Force auto-init by calling GET logic or just error out? 
            // Better to error if they somehow skipped the dashboard load.
            return NextResponse.json({ error: "No workspace found. Please refresh the dashboard." }, { status: 400 });
        }
    }

    const validated = ProjectSchema.omit({ id: true, createdAt: true, updatedAt: true }).safeParse(body);

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
