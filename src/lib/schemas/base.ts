import { z } from 'zod';

/**
 * User Schema (NextAuth compatible)
 */
export const UserSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).nullable(),
    email: z.string().email(),
    image: z.string().url().nullable(),
    emailVerified: z.date().nullable(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Workspace Schema
 */
export const WorkspaceSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(50),
    slug: z.string().min(1).max(50),
    ownerId: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

/**
 * Workspace Membership Role
 */
export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

/**
 * Workspace Membership Schema
 */
export const WorkspaceMembershipSchema = z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: WorkspaceRoleSchema,
    joinedAt: z.date(),
});

export type WorkspaceMembership = z.infer<typeof WorkspaceMembershipSchema>;

/**
 * Project Schema
 */
export const ProjectSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    workspaceId: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastViewedAt: z.date(),
    thumbnailUrl: z.string().optional().nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Scene Schema (The actual canvas data)
 */
export const SceneSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string().min(1).max(100),
    data: z.record(z.string(), z.any()), // JSON representation of the canvas
    isMain: z.boolean().default(true),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type Scene = z.infer<typeof SceneSchema>;

/**
 * Job Status Schema
 */
export const JobStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/**
 * Job Type Schema
 */
export const JobTypeSchema = z.enum(['render', 'animate']);
export type JobType = z.infer<typeof JobTypeSchema>;

/**
 * Job Schema (AI task tracking)
 */
export const JobSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    type: JobTypeSchema,
    status: JobStatusSchema,
    progress: z.number().min(0).max(100).default(0),
    resultUrl: z.string().url().optional().nullable(),
    error: z.string().optional().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type Job = z.infer<typeof JobSchema>;
