import { auth, db } from '@/lib/auth';
import { taskRecords } from '@/lib/db/schema';
import { NextResponse } from 'next/server';

const TASK_KINDS = ['modify', 'instant-render', 'form-variate', 'color-variate', 'new-view', 'animate', 'extract'] as const;
const TASK_STATUSES = ['queued', 'active', 'completed', 'partial', 'failed', 'cancelled', 'interrupted'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Runtime guard for the persisted TaskRecord shape (FR-019). */
function parseTaskRecord(value: unknown): typeof taskRecords.$inferInsert | null {
    if (!isRecord(value)) return null;
    const kind = value.kind;
    const status = value.status;
    const request = value.request;
    const resolved = value.resolved;
    const outputIds = value.outputIds;
    if (typeof value.id !== 'string' || !TASK_KINDS.includes(kind as (typeof TASK_KINDS)[number])) return null;
    if (!isRecord(request) || !isRecord(resolved)) return null;
    if (typeof resolved.workflow !== 'string' || typeof resolved.prompt !== 'string') return null;
    const seeds = resolved.seeds; // the table column mirrors resolved.seeds (one per output)
    if (!Array.isArray(seeds) || !seeds.every((seed) => typeof seed === 'number')) return null;
    if (!Array.isArray(outputIds) || !outputIds.every((id) => typeof id === 'string')) return null;
    if (typeof value.protocol !== 'string' || (value.protocol !== 'openai-compatible' && value.protocol !== 'comfyui')) return null;
    if (typeof status !== 'string' || !TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) return null;

    const benchmarkStatus = resolved.benchmarkStatus === 'validated' ? 'validated' : 'starting';
    return {
        id: value.id,
        projectId: typeof value.projectId === 'string' ? value.projectId : null,
        kind: kind as (typeof TASK_KINDS)[number],
        request,
        resolved: { ...resolved, benchmarkStatus },
        protocol: value.protocol,
        modelFamily: typeof value.modelFamily === 'string' ? value.modelFamily : null,
        seeds,
        status: status as (typeof TASK_STATUSES)[number],
        queuePositionAtSubmit: typeof value.queuePositionAtSubmit === 'number' ? value.queuePositionAtSubmit : null,
        error: typeof value.error === 'string' ? value.error : null,
        outputIds,
        createdAt: Number(value.createdAt),
        updatedAt: Number(value.updatedAt),
    };
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as unknown;
    const record = parseTaskRecord(isRecord(body) ? body.record : null);
    if (!record || !Number.isFinite(record.createdAt) || !Number.isFinite(record.updatedAt)) {
        return NextResponse.json({ error: 'A valid task record is required.' }, { status: 400 });
    }

    await db.insert(taskRecords).values(record).onConflictDoUpdate({
        target: taskRecords.id,
        set: {
            request: record.request,
            resolved: record.resolved,
            protocol: record.protocol,
            modelFamily: record.modelFamily,
            seeds: record.seeds,
            status: record.status,
            queuePositionAtSubmit: record.queuePositionAtSubmit,
            error: record.error,
            outputIds: record.outputIds,
            updatedAt: record.updatedAt,
        },
    });

    return NextResponse.json({ id: record.id }, { status: 201 });
}
