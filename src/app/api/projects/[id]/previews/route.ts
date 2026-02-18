import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { scenes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch the main scene for this project
    const [scene] = await db
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, id))
        .limit(1);

    if (!scene) {
        return NextResponse.json([]);
    }

    // Extract thumbnails from image/video nodes
    // scene.data is JSONB, structure: { nodes: WorkbenchNode[], connections: any[] }
    const sceneData = scene.data as any;
    const nodes = sceneData.nodes || [];

    const previews = nodes
        .filter((n: any) => (n.type === 'image' || n.type === 'video') && n.project?.thumbnail)
        .sort((a: any, b: any) => (b.project?.lastModifiedAt || 0) - (a.project?.lastModifiedAt || 0))
        .map((n: any) => ({
            id: n.id,
            thumbnail: n.project.thumbnail,
            lastModifiedAt: n.project.lastModifiedAt
        }));

    return NextResponse.json(previews);
}
