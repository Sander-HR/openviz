import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, workspaces, workspaceMemberships, users } from "@/lib/db/schema";
import { ProjectSchema } from "@/lib/schemas/base";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/projects
 * Fetches all projects for the authenticated user across all workspaces.
 * Auto-initializes user and default workspace if they don't exist.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    // 2. Check for workspace membership
    const userMemberships = await db
        .select()
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, userId));

    let targetWorkspaceId: string;

    if (userMemberships.length === 0) {
        // Create a default workspace
        const [newWorkspace] = await db.insert(workspaces).values({
            name: "Default Workspace",
            slug: `default-${userId.slice(0, 8)}`,
            ownerId: userId,
        }).returning();

        targetWorkspaceId = newWorkspace.id;

        // Add user as owner
        await db.insert(workspaceMemberships).values({
            workspaceId: targetWorkspaceId,
            userId: userId,
            role: "owner",
        });

        // Create the "Introduction" project
        await db.insert(projects).values({
            name: "Introduction",
            description: "Welcome to OpenViz! This is your first project.",
            workspaceId: targetWorkspaceId,
        });
    }

    const userProjects = await db
        .select()
        .from(projects)
        .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
        .innerJoin(workspaceMemberships, eq(workspaces.id, workspaceMemberships.workspaceId))
        .where(eq(workspaceMemberships.userId, userId));

    return NextResponse.json(userProjects.map(p => p.projects));
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
