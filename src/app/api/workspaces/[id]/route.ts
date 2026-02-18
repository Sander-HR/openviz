import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { workspaces, workspaceMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const UpdateWorkspaceSchema = z.object({
    name: z.string().min(1, "Name is required").max(50, "Name is too long"),
});

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workspaceId } = await params;
    const body = await req.json();
    const validated = UpdateWorkspaceSchema.safeParse(body);

    if (!validated.success) {
        return NextResponse.json({ error: validated.error.format() }, { status: 400 });
    }

    // Check permissions (must be a member)
    const membership = await db.query.workspaceMemberships.findFirst({
        where: and(
            eq(workspaceMemberships.workspaceId, workspaceId),
            eq(workspaceMemberships.userId, session.user.id)
        ),
    });

    if (!membership) {
        return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
    }

    // Update workspace
    const [updatedWorkspace] = await db
        .update(workspaces)
        .set({
            name: validated.data.name,
            updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId))
        .returning();

    return NextResponse.json(updatedWorkspace);
}

export async function DELETE(
    _: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: workspaceId } = await params;

    // Check permissions (must be owner)
    const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
    });

    if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (workspace.ownerId !== session.user.id) {
        return NextResponse.json({ error: "Only the owner can delete the workspace" }, { status: 403 });
    }

    // Delete workspace (assuming cascade delete is handled by database or manual cleanup needed)
    // For now, we'll try to delete directly.
    try {
        await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete workspace:", error);
        return NextResponse.json({ error: "Failed to delete workspace. Ensure it is empty." }, { status: 500 });
    }
}
