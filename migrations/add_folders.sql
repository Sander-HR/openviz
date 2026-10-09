-- Add folders table
CREATE TABLE IF NOT EXISTS "folders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "workspace_id" uuid REFERENCES "workspaces"("id") NOT NULL,
    "parent_id" uuid REFERENCES "folders"("id"),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add folder_id to projects (allows null = root level)
ALTER TABLE "projects" ADD COLUMN "folder_id" uuid REFERENCES "folders"("id");

-- Add index for faster folder queries
CREATE INDEX IF NOT EXISTS "folders_workspace_id_idx" ON "folders"("workspace_id");
CREATE INDEX IF NOT EXISTS "folders_parent_id_idx" ON "folders"("parent_id");
CREATE INDEX IF NOT EXISTS "projects_folder_id_idx" ON "projects"("folder_id");