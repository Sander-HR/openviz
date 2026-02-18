import * as dotenv from 'dotenv';
dotenv.config();

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString);
const db = drizzle(client);

async function migrate() {
    console.log("Running migration: add_last_viewed_at...");
    
    try {
        await db.execute(sql`
            ALTER TABLE "projects" 
            ADD COLUMN IF NOT EXISTS "last_viewed_at" timestamp DEFAULT now() NOT NULL
        `);
        
        // Update existing rows to have last_viewedAt = updatedAt
        await db.execute(sql`
            UPDATE "projects" 
            SET "last_viewed_at" = "updated_at" 
            WHERE "last_viewed_at" IS NULL
        `);
        
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