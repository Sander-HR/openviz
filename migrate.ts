import * as dotenv from 'dotenv';
dotenv.config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
const db = drizzle(client);

async function migrate() {
    console.log("Running migration: add_folders...");
    
    try {
        // Create folders table
        await db.execute(sql`
            CREATE TABLE IF NOT EXISTS "folders" (
                "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
                "name" text NOT NULL,
                "workspace_id" uuid REFERENCES "workspaces"("id") NOT NULL,
                "parent_id" uuid REFERENCES "folders"("id"),
                "created_at" timestamp DEFAULT now() NOT NULL,
                "updated_at" timestamp DEFAULT now() NOT NULL
            )
        `);
        console.log("Created folders table");

        // Add folder_id to projects
        await db.execute(sql`
            ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "folder_id" uuid REFERENCES "folders"("id")
        `);
        console.log("Added folder_id to projects");

        // Add indexes
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS "folders_workspace_id_idx" ON "folders"("workspace_id")
        `);
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS "folders_parent_id_idx" ON "folders"("parent_id")
        `);
        await db.execute(sql`
            CREATE INDEX IF NOT EXISTS "projects_folder_id_idx" ON "projects"("folder_id")
        `);
        console.log("Created indexes");

        console.log("Migration completed successfully!");
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        await client.end();
    }
    
    process.exit(0);
}

migrate();