import { auth } from "@/lib/auth";
import { db } from "@/lib/auth";
import { projects, workspaceMemberships } from "@/lib/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const MAX_PREVIEW_IDS = 100;
const PREVIEWS_PER_PROJECT = 12;



// postgres-js returns column names as written in the SQL (snake_case).
type PreviewRow = {
    project_id: string;
    id: string | null;
    thumbnail: string | null;
    last_modified_at: number | null;
};

/** Parse and normalize the `ids` query param: split, trim, dedupe, cap. */
export function parsePreviewIds(raw: string): string[] {
    const seen = new Set<string>();
    for (const part of raw.split(",")) {
        const id = part.trim();
        if (!id) continue;
        seen.add(id);
        if (seen.size >= MAX_PREVIEW_IDS) break;
    }
    return [...seen];
}

/**
 * Batched dashboard previews: one request, one Postgres query.
 *
 * Thumbnails are extracted from the main scene's JSONB with
 * jsonb_array_elements so the (potentially multi-MB) scene payload never
 * crosses the network or gets parsed in Node — only the small thumbnail
 * strings do. Replaces the per-card GET /api/projects/:id/previews N+1.
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const ids = parsePreviewIds(url.searchParams.get("ids") ?? "");
    if (ids.length === 0) return NextResponse.json({});

    const memberships = await db
        .select({ workspaceId: workspaceMemberships.workspaceId })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, session.user.id));

    const workspaceIds = memberships.map((m) => m.workspaceId);
    if (workspaceIds.length === 0) return NextResponse.json({});

    const accessible = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(inArray(projects.id, ids), inArray(projects.workspaceId, workspaceIds)));

    const accessibleIds = accessible.map((p) => p.id);
    if (accessibleIds.length === 0) return NextResponse.json({});

    // Build the id list as an explicit ARRAY literal: drizzle/postgres-js
    // interpolates JS arrays as positional params, which Postgres sees as a
    // record ("cannot cast type record to uuid[]"). Values come from DB rows
    // (uuid-typed) and are quote-escaped defensively.
    const idList = accessibleIds.map((value) => `'${value.replace(/'/g, "''")}'`).join(",");

    // postgres-js execute() resolves to a RowList — an array of row objects.
    const rawResult = await db.execute(sql`
        WITH previews AS (
            SELECT
                s.project_id,
                elem->>'id' AS id,
                (elem->'project')->>'thumbnail' AS thumbnail,
                (elem->'project'->>'lastModifiedAt')::bigint AS last_modified_at,
                ROW_NUMBER() OVER (
                    PARTITION BY s.project_id
                    ORDER BY (elem->'project'->>'lastModifiedAt')::bigint DESC NULLS LAST
                ) AS rn
            FROM scenes s
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(s.data->'nodes') = 'array' THEN s.data->'nodes'
                    ELSE '[]'::jsonb
                END
            ) AS elem
            WHERE s.is_main = true
              AND s.project_id = ANY(ARRAY[${sql.raw(idList)}]::uuid[])
              AND elem->>'type' IN ('image', 'video')
              AND (elem->'project')->>'thumbnail' IS NOT NULL
        )
        SELECT project_id, id, thumbnail, last_modified_at
        FROM previews
        WHERE rn <= ${PREVIEWS_PER_PROJECT}
        ORDER BY project_id, last_modified_at DESC NULLS LAST
    `);
    const result = rawResult as unknown as PreviewRow[];

    const rows = result.flatMap((row) => {
        if (!row.project_id || !row.thumbnail) return [];
        return [{ project_id: row.project_id, id: row.id ?? "", thumbnail: row.thumbnail, last_modified_at: row.last_modified_at }];
    });

    const byProject: Record<string, Array<{ id: string; thumbnail: string; lastModifiedAt: number | null }>> = {};
    for (const row of rows) {
        (byProject[row.project_id] ??= []).push({
            id: row.id,
            thumbnail: row.thumbnail,
            lastModifiedAt: row.last_modified_at,
        });
    }

    return NextResponse.json(byProject, {
        headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=60" },
    });
}
