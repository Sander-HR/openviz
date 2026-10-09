import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { projects, scenes, users, workspaceMemberships, workspaces } from "../db/schema";
import {
    createExampleSceneData,
    DEFAULT_EXAMPLE_PROJECT_DESCRIPTION,
    DEFAULT_EXAMPLE_PROJECT_NAME,
    DEFAULT_WORKSPACE_NAME,
    DEFAULT_WORKSPACE_SLUG_PREFIX,
} from "./bootstrapTemplates";

type DatabaseClient = ReturnType<typeof drizzle>;
type DatabaseTransaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

export interface EnsureUserBootstrapInput {
    userId: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
}

export interface BootstrapResult {
    workspaceId: string;
    workspaceCreated: boolean;
    exampleProjectId: string;
    exampleProjectCreated: boolean;
}

function fallbackEmailForUser(userId: string): string {
    return `missing-${userId}@local.invalid`;
}

function buildWorkspaceSlug(userId: string): string {
    return `${DEFAULT_WORKSPACE_SLUG_PREFIX}-${userId.slice(0, 8)}`;
}

async function ensureWorkspaceForUser(tx: DatabaseTransaction, userId: string): Promise<{ workspaceId: string; created: boolean }> {
    const memberships = await tx
        .select({ workspaceId: workspaceMemberships.workspaceId })
        .from(workspaceMemberships)
        .where(eq(workspaceMemberships.userId, userId))
        .limit(1);

    if (memberships.length > 0) {
        return { workspaceId: memberships[0].workspaceId, created: false };
    }

    const slug = buildWorkspaceSlug(userId);
    const insertResult = await tx
        .insert(workspaces)
        .values({
            name: DEFAULT_WORKSPACE_NAME,
            slug,
            ownerId: userId,
        })
        .onConflictDoNothing({ target: workspaces.slug })
        .returning({ id: workspaces.id });

    let workspaceId = insertResult[0]?.id;
    if (!workspaceId) {
        const existingWorkspace = await tx
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.slug, slug))
            .limit(1);

        workspaceId = existingWorkspace[0]?.id;
    }

    if (!workspaceId) {
        throw new Error("Failed to resolve default workspace");
    }

    await tx
        .insert(workspaceMemberships)
        .values({
            workspaceId,
            userId,
            role: "owner",
        })
        .onConflictDoNothing();

    return { workspaceId, created: insertResult.length > 0 };
}

async function ensureExampleProjectForWorkspace(
    tx: DatabaseTransaction,
    workspaceId: string,
    updatedBy: string
): Promise<{ projectId: string; created: boolean }> {
    const existingProjects = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId))
        .limit(1);

    if (existingProjects.length > 0) {
        return { projectId: existingProjects[0].id, created: false };
    }

    const [createdProject] = await tx
        .insert(projects)
        .values({
            name: DEFAULT_EXAMPLE_PROJECT_NAME,
            description: DEFAULT_EXAMPLE_PROJECT_DESCRIPTION,
            workspaceId,
        })
        .returning({ id: projects.id });

    const sceneData = createExampleSceneData();
    await tx.insert(scenes).values({
        projectId: createdProject.id,
        name: "Main",
        data: sceneData,
        isMain: true,
        version: 1,
        updatedBy,
    });

    return { projectId: createdProject.id, created: true };
}

export async function ensureUserBootstrap(dbClient: DatabaseClient, input: EnsureUserBootstrapInput): Promise<BootstrapResult> {
    const sanitizedEmail = input.email && input.email.trim().length > 0
        ? input.email
        : fallbackEmailForUser(input.userId);

    return dbClient.transaction(async (tx) => {
        await tx
            .insert(users)
            .values({
                id: input.userId,
                email: sanitizedEmail,
                name: input.name ?? null,
                image: input.image ?? null,
            })
            .onConflictDoUpdate({
                target: users.id,
                set: {
                    email: sql`coalesce(nullif(${sanitizedEmail}, ''), ${users.email})`,
                    name: sql`coalesce(${input.name ?? null}, ${users.name})`,
                    image: sql`coalesce(${input.image ?? null}, ${users.image})`,
                    updatedAt: new Date(),
                },
            });

        const workspaceResult = await ensureWorkspaceForUser(tx, input.userId);
        const projectResult = await ensureExampleProjectForWorkspace(tx, workspaceResult.workspaceId, input.userId);

        return {
            workspaceId: workspaceResult.workspaceId,
            workspaceCreated: workspaceResult.created,
            exampleProjectId: projectResult.projectId,
            exampleProjectCreated: projectResult.created,
        };
    });
}

export async function ensureBootstrapForDevAdmin(databaseUrl: string, user: EnsureUserBootstrapInput): Promise<BootstrapResult> {
    const queryClient = postgres(databaseUrl);
    const dbClient = drizzle(queryClient);

    try {
        return await ensureUserBootstrap(dbClient, user);
    } finally {
        await queryClient.end();
    }
}
