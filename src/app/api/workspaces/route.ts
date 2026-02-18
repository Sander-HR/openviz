import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { workspaces, workspaceMemberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateWorkspaceSchema = z.object({
    name: z.string().min(1, "Name is required").max(50, "Name is too long"),
});

/**
 * GET /api/workspaces
 * Fetches all workspaces for the authenticated user.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const userWorkspaces = await db
        .select({
            id: workspaces.id,
            name: workspaces.name,
            slug: workspaces.slug,
            role: workspaceMemberships.role,
        })
        .from(workspaces)
        .innerJoin(workspaceMemberships, eq(workspaces.id, workspaceMemberships.workspaceId))
        .where(eq(workspaceMemberships.userId, userId));

    return NextResponse.json(userWorkspaces);
}

/**
 * POST /api/workspaces
 * Creates a new workspace.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const validated = CreateWorkspaceSchema.safeParse(body);

    if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    const userId = session.user.id;
    const slug = `${validated.data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`;

    // Create the workspace
    const [newWorkspace] = await db.insert(workspaces).values({
        name: validated.data.name,
        slug: slug,
        ownerId: userId,
    }).returning();

    // Add user as owner
    await db.insert(workspaceMemberships).values({
        workspaceId: newWorkspace.id,
        userId: userId,
        role: "owner",
    });

    return NextResponse.json(newWorkspace);
}
