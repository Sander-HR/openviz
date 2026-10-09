import { auth, db } from '@/lib/auth';
import { extractionRecords, projectAssets } from '@/lib/db/schema';
import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';

const RECORD_KINDS = ['color', 'material', 'parts'] as const;
const SAMPLE_MODES = ['hierarchy', 'region'] as const;
const ASSET_KINDS = ['palette', 'material-notes', 'part-list'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Runtime guard for the persisted ExtractionRecord shape (FR-018). */
function parseExtractionRecord(value: unknown): typeof extractionRecords.$inferInsert | null {
    if (!isRecord(value)) return null;
    const kind = value.kind;
    const sampleBy = value.sampleBy;
    const components = value.components;
    if (typeof value.id !== 'string' || typeof value.taskId !== 'string' || typeof value.sourceImageId !== 'string') return null;
    if (!RECORD_KINDS.includes(kind as (typeof RECORD_KINDS)[number])) return null;
    if (!SAMPLE_MODES.includes(sampleBy as (typeof SAMPLE_MODES)[number])) return null;
    if (!Array.isArray(components) || !components.every(isRecord)) return null;
    if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return null;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
    return {
        id: value.id,
        taskId: value.taskId,
        sourceImageId: value.sourceImageId,
        kind: kind as (typeof RECORD_KINDS)[number],
        sampleBy: sampleBy as (typeof SAMPLE_MODES)[number],
        components,
        confidence: value.confidence,
        createdAt: value.createdAt,
    };
}

/** Runtime guard for the persisted ProjectAsset shape (FR-023). */
function parseProjectAsset(value: unknown): typeof projectAssets.$inferInsert | null {
    if (!isRecord(value)) return null;
    const kind = value.kind;
    if (typeof value.id !== 'string' || typeof value.projectId !== 'string') return null;
    if (!ASSET_KINDS.includes(kind as (typeof ASSET_KINDS)[number])) return null;
    if (typeof value.extractionRecordId !== 'string') return null;
    if (!isRecord(value.payload)) return null;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
    return {
        id: value.id,
        projectId: value.projectId,
        kind: kind as (typeof ASSET_KINDS)[number],
        extractionRecordId: value.extractionRecordId,
        payload: value.payload,
        createdAt: value.createdAt,
    };
}

/** Save a completed extraction record + its reusable project asset (FR-023). */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as unknown;
    const record = parseExtractionRecord(isRecord(body) ? body.record : null);
    const asset = parseProjectAsset(isRecord(body) ? body.asset : null);
    if (!record || !asset) return NextResponse.json({ error: 'A valid extraction record and project asset are required.' }, { status: 400 });

    await db.insert(extractionRecords).values(record).onConflictDoNothing();
    await db.insert(projectAssets).values(asset).onConflictDoNothing();

    return NextResponse.json({ recordId: record.id, assetId: asset.id }, { status: 201 });
}

/** List a project's saved extraction assets (palettes, material notes, part lists). */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = new URL(req.url).searchParams.get('projectId');
    if (!projectId) return NextResponse.json({ error: 'A projectId query parameter is required.' }, { status: 400 });

    const rows = await db.select().from(projectAssets).where(eq(projectAssets.projectId, projectId)).orderBy(desc(projectAssets.createdAt));
    return NextResponse.json(rows);
}
