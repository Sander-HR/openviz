import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, scenes, workspaceMemberships } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

async function canAccessProject(projectId: string, userId: string) {
    const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

    if (!project) {
        return { allowed: false, project: null };
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

    return { allowed: membership.length > 0, project };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await canAccessProject(projectId, session.user.id);
    if (!access.project) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const projectScenes = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, projectId));

    return NextResponse.json(projectScenes);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await canAccessProject(projectId, session.user.id);
    if (!access.project) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { name = "Main", data, isMain = true } = body;

    // Check if a main scene already exists for this project
    if (isMain) {
        const [existingMain] = await db
            .select()
            .from(scenes)
            .where(and(eq(scenes.projectId, projectId), eq(scenes.isMain, true)));

        if (existingMain) {
            // Update the existing main scene
            const [updated] = await db
                .update(scenes)
                .set({
                    data,
                    version: existingMain.version + 1,
                    updatedBy: session.user.id,
                    updatedAt: new Date(),
                })
                .where(eq(scenes.id, existingMain.id))
                .returning();
            return NextResponse.json({ scene: updated.data, version: updated.version });
        }
    }

    // Create a new scene
    const [newScene] = await db
        .insert(scenes)
        .values({
            projectId,
            name,
            data,
            isMain,
            version: 1,
            updatedBy: session.user.id,
        })
        .returning();

    return NextResponse.json({ scene: newScene.data, version: newScene.version });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await canAccessProject(projectId, session.user.id);
    if (!access.project) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { data, expectedVersion } = body as {
        data: unknown;
        expectedVersion?: number;
    };

    // Find and update the main scene
    const [existingMain] = await db
        .select()
        .from(scenes)
        .where(and(eq(scenes.projectId, projectId), eq(scenes.isMain, true)));

    if (existingMain) {
        if (typeof expectedVersion === "number" && expectedVersion !== existingMain.version) {
            return NextResponse.json(
                {
                    error: "Scene version conflict",
                    currentVersion: existingMain.version,
                    scene: existingMain.data,
                },
                { status: 409 }
            );
        }

        const [updated] = await db
            .update(scenes)
            .set({
                data,
                version: existingMain.version + 1,
                updatedBy: session.user.id,
                updatedAt: new Date(),
            })
            .where(eq(scenes.id, existingMain.id))
            .returning();
        return NextResponse.json({ scene: updated.data, version: updated.version });
    }

    // If no main scene exists, create one
    const [newScene] = await db
        .insert(scenes)
        .values({
            projectId,
            name: "Main",
            data,
            isMain: true,
            version: 1,
            updatedBy: session.user.id,
        })
        .returning();

    return NextResponse.json({ scene: newScene.data, version: newScene.version });
}
