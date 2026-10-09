import { createHash } from "node:crypto";
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

/**
 * Recursively replace inline data URLs (mock-mode uploads store base64
 * directly on nodes, bloating scenes to tens of MB) with a small marker.
 * Used by the ?lite=1 response variant — see docs/performance/baseline.md.
 */
export function stripInlineData(value: unknown): unknown {
    if (typeof value === "string") {
        return value.startsWith("data:") && value.length > 64 ? "[stripped-inline-data]" : value;
    }
    if (Array.isArray(value)) return value.map(stripInlineData);
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            out[key] = stripInlineData(entry);
        }
        return out;
    }
    return value;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    // Make mock-mode payload bloat visible in dev (mock uploads inline base64
    // into node data; production S3 mode stores URLs instead — see docs/performance).
    if (process.env.NODE_ENV !== "production" && scene) {
        const megabytes = JSON.stringify(scene.data).length / 1024 / 1024;
        console.info(`[perf] scene payload for project ${id}: ${megabytes.toFixed(2)} MB`);
    }

    // Reads stay side-effect free: lastViewedAt is updated by an explicit
    // POST /api/projects/:id/viewed so this response is cacheable.
    const lite = new URL(req.url).searchParams.get("lite") === "1";
    let sceneData: unknown = scene ? scene.data : null;
    if (lite && sceneData !== null) {
        sceneData = stripInlineData(sceneData);
    }

    let body = {
        ...project,
        scene: sceneData,
        sceneVersion: scene?.version ?? 0,
    };
    // Lite mode strips every inline data URL in the response — the scene
    // nodes AND project-level fields like thumbnailUrl (mock-mode uploads
    // store base64 on both).
    if (lite) {
        body = stripInlineData(body) as typeof body;
    }

    // Deterministic, cheap ETag: scene content changes always bump the scene
    // version; project metadata (rename/move) bumps updatedAt. Hashing the
    // full body would be wasteful for multi-MB mock-mode scenes.
    const fingerprint = JSON.stringify({
        v: body.sceneVersion,
        u: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : String(project.updatedAt ?? ""),
        n: project.name,
    });
    const etag = `"${createHash("sha1").update(fingerprint).digest("hex")}"`;

    if (req.headers.get("if-none-match") === etag) {
        return new NextResponse(null, {
            status: 304,
            headers: { ETag: etag, "Cache-Control": "private, max-age=5, stale-while-revalidate=60" },
        });
    }

    return NextResponse.json(body, {
        headers: { ETag: etag, "Cache-Control": "private, max-age=5, stale-while-revalidate=60" },
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
