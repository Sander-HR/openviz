import { auth } from '@/lib/auth';
import { createDatabaseTargetSettingsRepository } from '@/services/ai/databaseTargetSettingsRepository';
import { createLocalComfyTarget } from '@/services/ai/targets/localComfyTarget';
import { createTargetSettingsService } from '@/services/ai/targetSettingsService';
import type { ExecutionTarget, ExecutionTargetKind } from '@/types/executionTarget.types';
import { NextResponse } from 'next/server';

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function parseTarget(value: unknown): ExecutionTarget | null {
    const candidate = asRecord(value);
    const kind = candidate?.kind;
    if (!candidate || typeof candidate.id !== 'string' || typeof candidate.endpoint !== 'string' || typeof candidate.displayName !== 'string' || !['local', 'hosted', 'hybrid'].includes(String(kind))) return null;
    return {
        id: candidate.id,
        kind: kind as ExecutionTargetKind,
        endpoint: candidate.endpoint,
        displayName: candidate.displayName,
        status: 'unknown',
        authState: 'unknown',
        capabilities: null,
    };
}

async function getService() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const repository = createDatabaseTargetSettingsRepository(session.user.id);
    return createTargetSettingsService({
        repository,
        adapterFactory: (target) => createLocalComfyTarget({ id: target.id, endpoint: target.endpoint }),
    });
}

export async function GET() {
    const service = await getService();
    if (!service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ targets: await service.listTargets() });
}

export async function POST(req: Request) {
    const service = await getService();
    if (!service) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = asRecord(await req.json() as unknown);
    const target = parseTarget(body?.target);
    if (!target) return NextResponse.json({ error: 'A valid redacted execution target is required.' }, { status: 400 });
    const saved = await service.saveTarget(target);
    return NextResponse.json({ target: saved }, { status: 201 });
}
