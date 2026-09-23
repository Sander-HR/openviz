import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, scenes, workspaceMemberships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const encoder = new TextEncoder();

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

function sseEvent(event: string, payload: unknown) {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await canAccessProject(projectId, session.user.id);
    if (!access.project) return NextResponse.json({ error: "Not Found" }, { status: 404 });
    if (!access.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let cleanupStream: (() => void) | null = null;

    const stream = new ReadableStream({
        async start(controller) {
            let closed = false;
            let lastKnownVersion = -1;
            let heartbeat: ReturnType<typeof setInterval> | undefined;
            let polling: ReturnType<typeof setInterval> | undefined;
            const onAbort = () => {
                cleanup();
            };

            const cleanup = () => {
                if (closed) return;
                closed = true;
                req.signal.removeEventListener("abort", onAbort);

                if (heartbeat) {
                    clearInterval(heartbeat);
                    heartbeat = undefined;
                }
                if (polling) {
                    clearInterval(polling);
                    polling = undefined;
                }
            };

            cleanupStream = cleanup;
            req.signal.addEventListener("abort", onAbort);

            const enqueueSafe = (event: string, payload: unknown) => {
                if (closed) return false;
                try {
                    controller.enqueue(sseEvent(event, payload));
                    return true;
                } catch {
                    cleanup();
                    return false;
                }
            };

            const pollScene = async () => {
                if (closed) return;

                const [mainScene] = await db
                    .select()
                    .from(scenes)
                    .where(and(eq(scenes.projectId, projectId), eq(scenes.isMain, true)))
                    .limit(1);

                if (!mainScene) {
                    return;
                }

                if (lastKnownVersion !== mainScene.version) {
                    lastKnownVersion = mainScene.version;
                    enqueueSafe("scene.snapshot", {
                        projectId,
                        version: mainScene.version,
                        updatedAt: mainScene.updatedAt,
                        data: mainScene.data,
                    });
                }
            };

            try {
                await pollScene();
            } catch {
                cleanup();
                return;
            }

            heartbeat = setInterval(() => {
                enqueueSafe("scene.heartbeat", { timestamp: Date.now() });
            }, 15000);

            polling = setInterval(() => {
                void pollScene().catch(() => {
                    cleanup();
                });
            }, 2000);

            // In the Edge/runtime stream API there is no explicit disconnect callback,
            // so cleanup will happen when stream is GC'd by platform or if an enqueue throws.
            if (!enqueueSafe("scene.connected", { projectId, timestamp: Date.now() })) {
                cleanup();
            }
        },
        cancel() {
            cleanupStream?.();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
