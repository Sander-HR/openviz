import { auth, db } from '@/lib/auth';
import { taskRecords } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

const TASK_STATUSES = ['queued', 'active', 'completed', 'partial', 'failed', 'cancelled', 'interrupted'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = (await req.json().catch(() => null)) as unknown;
    if (!isRecord(body)) return NextResponse.json({ error: 'A patch object is required.' }, { status: 400 });

    const set: Record<string, unknown> = { updatedAt: Date.now() };
    if (body.status !== undefined) {
        if (typeof body.status !== 'string' || !TASK_STATUSES.includes(body.status as (typeof TASK_STATUSES)[number])) {
            return NextResponse.json({ error: 'Invalid task status.' }, { status: 400 });
        }
        set.status = body.status;
    }
    if (body.error !== undefined) {
        if (body.error !== null && typeof body.error !== 'string') return NextResponse.json({ error: 'Invalid error value.' }, { status: 400 });
        set.error = body.error;
    }
    if (body.outputIds !== undefined) {
        if (!Array.isArray(body.outputIds) || !body.outputIds.every((entry) => typeof entry === 'string')) {
            return NextResponse.json({ error: 'Invalid outputIds.' }, { status: 400 });
        }
        set.outputIds = body.outputIds;
    }

    const updated = await db.update(taskRecords).set(set).where(eq(taskRecords.id, id)).returning({ id: taskRecords.id });
    if (updated.length === 0) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    return NextResponse.json({ id });
}
