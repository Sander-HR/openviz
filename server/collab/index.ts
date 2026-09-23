import * as dotenv from 'dotenv';
dotenv.config();

import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { createOnAuthenticate, hasProjectAccessForScene } from './auth';
import { createDbPersistence, createFetch, createStore } from './persistence';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        console.error(`[collab] Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

const port = Number(process.env.COLLAB_PORT ?? 1234);
if (!Number.isInteger(port) || port <= 0) {
    console.error(`[collab] COLLAB_PORT must be a positive integer, got: ${process.env.COLLAB_PORT}`);
    process.exit(1);
}

const secret = requireEnv('COLLAB_TOKEN_SECRET');
requireEnv('DATABASE_URL');

const persistence = createDbPersistence();

const server = new Server({
    port,
    // ~2 s debounced saves per the persistence contract; hard cap so a busy
    // room still flushes regularly.
    debounce: 2000,
    maxDebounce: 10_000,
    extensions: [new Database({ fetch: createFetch(persistence), store: createStore(persistence) })],
    onAuthenticate: createOnAuthenticate({ secret, checkMembership: hasProjectAccessForScene }),
});

await server.listen();
console.log(`[collab] Hocuspocus listening on ws://localhost:${port}`);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[collab] ${signal} received — flushing pending stores before exit`);
    try {
        await server.hocuspocus.flushPendingStores();
    } finally {
        await server.destroy();
        process.exit(0);
    }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
