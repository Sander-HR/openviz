import { pgTable, text, timestamp, uuid, boolean, integer, bigint, real, jsonb, customType, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/** Postgres `bytea` column type (removed from drizzle pg-core in 0.4x). */
export const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
    dataType() {
        return 'bytea';
    },
});

/**
 * Users Table
 */
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name'),
    email: text('email').notNull().unique(),
    image: text('image'),
    emailVerified: timestamp('email_verified', { mode: 'date' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Workspaces Table
 */
export const workspaces = pgTable('workspaces', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    ownerId: uuid('owner_id').references(() => users.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Workspace Memberships Table
 */
export const workspaceMemberships = pgTable('workspace_memberships', {
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
}));

/**
 * Folders Table
 */
export const folders = pgTable('folders', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    parentId: uuid('parent_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Projects Table
 */
export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    workspaceId: uuid('workspace_id').references(() => workspaces.id).notNull(),
    folderId: uuid('folder_id').references(() => folders.id),
    thumbnailUrl: text('thumbnail_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastViewedAt: timestamp('last_viewed_at').defaultNow().notNull(),
});

/**
 * Scenes Table
 */
export const scenes = pgTable('scenes', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id).notNull(),
    name: text('name').notNull(),
    data: jsonb('data').notNull(),
    isMain: boolean('is_main').default(true).notNull(),
    version: integer('version').default(1).notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
    /** Encoded Yjs document for collaborative scenes (NULL until first collaborative save). */
    ydoc: bytea('ydoc'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Jobs Table
 */
export const phoneUploadSessions = pgTable('phone_upload_sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    status: text('status', { enum: ['pending', 'uploading', 'completed', 'expired'] }).default('pending').notNull(),
    s3Key: text('s3_key'),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id).notNull(),
    type: text('type', { enum: ['render', 'animate', 'product'] }).notNull(),
    status: text('status', { enum: ['pending', 'processing', 'completed', 'partial', 'cancelled', 'failed'] }).default('pending').notNull(),
    progress: integer('progress').default(0).notNull(),
    resultUrl: text('result_url'),
    error: text('error'),
    retryOf: uuid('retry_of'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Relations
 */

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
    owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
    members: many(workspaceMemberships),
    projects: many(projects),
}));

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
    workspace: one(workspaces, { fields: [workspaceMemberships.workspaceId], references: [workspaces.id] }),
    user: one(users, { fields: [workspaceMemberships.userId], references: [users.id] }),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
    workspace: one(workspaces, { fields: [folders.workspaceId], references: [workspaces.id] }),
    parent: one(folders, {
        fields: [folders.parentId],
        references: [folders.id],
        relationName: 'parentFolder',
    }),
    children: many(folders, { relationName: 'parentFolder' }),
    projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
    workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
    folder: one(folders, { fields: [projects.folderId], references: [folders.id] }),
    scenes: many(scenes),
    jobs: many(jobs),
}));

export const scenesRelations = relations(scenes, ({ one }) => ({
    project: one(projects, { fields: [scenes.projectId], references: [projects.id] }),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
    project: one(projects, { fields: [jobs.projectId], references: [projects.id] }),
}));

/** Redacted execution-target metadata. Provider credentials are not stored in this table. */
export const executionTargets = pgTable('execution_targets', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    kind: text('kind', { enum: ['local', 'hosted', 'hybrid'] }).notNull(),
    endpoint: text('endpoint').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status', { enum: ['unknown', 'checking', 'ready', 'degraded', 'unavailable', 'auth-required'] }).notNull(),
    authState: text('auth_state', { enum: ['unknown', 'valid', 'missing', 'expired', 'invalid'] }).notNull(),
    capabilities: jsonb('capabilities'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** Per-user durable AI preferences. Secrets are encrypted server-side. */
export const aiComputeSettings = pgTable('ai_compute_settings', {
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
    targetKind: text('target_kind', { enum: ['local', 'hosted', 'hybrid'] }).notNull().default('local'),
    protocol: text('protocol', { enum: ['comfyui', 'openai-image'] }).notNull().default('comfyui'),
    preference: text('preference', { enum: ['automatic', 'low-memory', 'balanced', 'high-quality', 'hosted'] }).notNull().default('automatic'),
    localEndpoint: text('local_endpoint').notNull().default('/comfy-api'),
    hostedEndpoint: text('hosted_endpoint').notNull().default(''),
    imageApiEndpoint: text('image_api_endpoint').notNull().default(''),
    imageApiKeyCiphertext: text('image_api_key_ciphertext'),
    imageApiKeyUpdatedAt: timestamp('image_api_key_updated_at'),
    imageApiKeyless: boolean('image_api_keyless').notNull().default(false),
    imageApiModel: text('image_api_model').notNull().default(''),
    imageApiSize: text('image_api_size').notNull().default('1024x1024'),
    endpointConcurrency: integer('endpoint_concurrency').notNull().default(2),
    activeProfileId: uuid('active_profile_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    activeProfileIdx: index('ai_compute_settings_active_profile_idx').on(table.activeProfileId),
}));

/** Reusable per-user AI endpoint profiles. API keys are not stored here. */
export const aiEndpointProfiles = pgTable('ai_endpoint_profiles', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['local', 'hosted', 'hybrid'] }).notNull(),
    protocol: text('protocol', { enum: ['comfyui', 'openai-image'] }).notNull(),
    endpoint: text('endpoint').notNull(),
    model: text('model').notNull().default(''),
    imageSize: text('image_size').notNull().default('1024x1024'),
    keyless: boolean('keyless').notNull().default(false),
    hasApiKey: boolean('has_api_key').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    userNameUnique: uniqueIndex('ai_endpoint_profiles_user_name_unique').on(table.userId, table.name),
    userIdx: index('ai_endpoint_profiles_user_idx').on(table.userId),
}));

export const aiComputeSettingsRelations = relations(aiComputeSettings, ({ one }) => ({
    user: one(users, { fields: [aiComputeSettings.userId], references: [users.id] }),
}));

export const aiEndpointProfilesRelations = relations(aiEndpointProfiles, ({ one }) => ({
    user: one(users, { fields: [aiEndpointProfiles.userId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
    memberships: many(workspaceMemberships),
    ownedWorkspaces: many(workspaces),
    aiComputeSettings: many(aiComputeSettings),
    aiEndpointProfiles: many(aiEndpointProfiles),
}));

// ---------------------------------------------------------------------------
// Feature 012 — AI Render Task Parameters (specs/012-ai-render-task-params)
// Deliberate deviation from the uuid/timestamp convention above: all IDs are
// strings (ULID) and timestamps are epoch milliseconds, per data-model.md.
// ---------------------------------------------------------------------------

/** FR-019 machine-readable task record; SC-008 reproducibility source. */
export const taskRecords = pgTable('task_records', {
    id: text('id').primaryKey(),
    projectId: text('project_id'),
    kind: text('kind', { enum: ['modify', 'instant-render', 'form-variate', 'color-variate', 'new-view', 'animate', 'extract'] }).notNull(),
    /** Full RenderTaskRequest, verbatim user-level inputs. */
    request: jsonb('request').notNull(),
    /** Exact ResolvedRenderParameters (provider-neutral) used. */
    resolved: jsonb('resolved').notNull(),
    protocol: text('protocol', { enum: ['openai-compatible', 'comfyui'] }).notNull(),
    modelFamily: text('model_family'),
    /** One seed per output (SC-008 lock target). */
    seeds: jsonb('seeds').notNull(),
    status: text('status', { enum: ['queued', 'active', 'completed', 'partial', 'failed', 'cancelled', 'interrupted'] }).notNull(),
    queuePositionAtSubmit: integer('queue_position_at_submit'),
    error: text('error'),
    /** → GenerationResult rows; a batch shares one task. */
    outputIds: jsonb('output_ids').notNull(),
    // Epoch milliseconds need bigint; int4 overflows at 2001-09-09.
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
}, (table) => ({
    projectIdIdx: index('task_records_project_id_idx').on(table.projectId),
    statusIdx: index('task_records_status_idx').on(table.status),
}));

/** Structured extraction result for a kind='extract' task (FR-018). */
export const extractionRecords = pgTable('extraction_records', {
    id: text('id').primaryKey(),
    taskId: text('task_id').references(() => taskRecords.id, { onDelete: 'cascade' }).notNull(),
    sourceImageId: text('source_image_id').notNull(),
    kind: text('kind', { enum: ['color', 'material', 'parts'] }).notNull(),
    sampleBy: text('sample_by', { enum: ['hierarchy', 'region'] }).notNull(),
    /** Array of ExtractionComponent; background excluded. */
    components: jsonb('components').notNull(),
    /** Overall record confidence, 0–1. */
    confidence: real('confidence').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => ({
    taskIdIdx: index('extraction_records_task_id_idx').on(table.taskId),
}));

/** Saved, referenceable unit of design data created from an extraction record (FR-023). */
export const projectAssets = pgTable('project_assets', {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    kind: text('kind', { enum: ['palette', 'material-notes', 'part-list'] }).notNull(),
    /** Provenance → ExtractionRecord.id. */
    extractionRecordId: text('extraction_record_id').references(() => extractionRecords.id, { onDelete: 'cascade' }).notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
}, (table) => ({
    projectIdIdx: index('project_assets_project_id_idx').on(table.projectId),
}));

export const taskRecordsRelations = relations(taskRecords, ({ one }) => ({
    extractionRecord: one(extractionRecords, { fields: [taskRecords.id], references: [extractionRecords.taskId] }),
}));

export const extractionRecordsRelations = relations(extractionRecords, ({ one }) => ({
    task: one(taskRecords, { fields: [extractionRecords.taskId], references: [taskRecords.id] }),
    projectAsset: one(projectAssets, { fields: [extractionRecords.id], references: [projectAssets.extractionRecordId] }),
}));

export const projectAssetsRelations = relations(projectAssets, ({ one }) => ({
    extractionRecord: one(extractionRecords, { fields: [projectAssets.extractionRecordId], references: [extractionRecords.id] }),
}));
