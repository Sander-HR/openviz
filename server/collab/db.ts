import * as dotenv from 'dotenv';
dotenv.config();

import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../src/lib/db/schema';

type CollabDb = PostgresJsDatabase<typeof schema>;

let instance: CollabDb | null = null;

/**
 * Lazy Drizzle client for the standalone collaboration process.
 * Created on first use so importing auth/persistence modules in unit tests
 * never opens a database connection.
 */
export function getDb(): CollabDb {
    if (!instance) {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error('DATABASE_URL is not set — the collaboration server cannot reach Postgres');
        }
        instance = drizzle(postgres(url, { max: 10 }), { schema });
    }
    return instance;
}
