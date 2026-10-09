import { auth } from '@/lib/auth';
import { createDatabaseAISettingsRepository } from '@/services/ai/databaseAISettingsRepository';
import type { AISettingsUpdate } from '@/types/aiSettings.types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateSchema = z.object({
    targetKind: z.enum(['local', 'hosted', 'hybrid']).optional(),
    protocol: z.enum(['comfyui', 'openai-image']).optional(),
    preference: z.enum(['automatic', 'low-memory', 'balanced', 'high-quality', 'hosted']).optional(),
    localEndpoint: z.string().min(1).optional(),
    hostedEndpoint: z.string().optional(),
    imageApiEndpoint: z.string().optional(),
    imageApiKey: z.string().nullable().optional(),
    imageApiKeyless: z.boolean().optional(),
    imageApiModel: z.string().optional(),
    imageApiSize: z.string().regex(/^\d+x\d+$/).optional(),
    endpointConcurrency: z.number().int().min(1).max(3).optional(),
}).strict();

async function userRepository() {
    const session = await auth();
    return session?.user?.id ? createDatabaseAISettingsRepository(session.user.id) : null;
}

export async function GET() {
    const repository = await userRepository();
    if (!repository) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ settings: await repository.get() });
}

export async function PATCH(request: Request) {
    const repository = await userRepository();
    if (!repository) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = updateSchema.safeParse(await request.json() as unknown);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const settings = await repository.upsert(parsed.data as AISettingsUpdate);
    return NextResponse.json({ settings });
}