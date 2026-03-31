import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Jobs Table
 */
export const jobs = pgTable('jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id).notNull(),
    type: text('type', { enum: ['render', 'animate'] }).notNull(),
    status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending').notNull(),
    progress: integer('progress').default(0).notNull(),
    resultUrl: text('result_url'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Relations
 */

export const usersRelations = relations(users, ({ many }) => ({
    memberships: many(workspaceMemberships),
    ownedWorkspaces: many(workspaces),
}));

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
