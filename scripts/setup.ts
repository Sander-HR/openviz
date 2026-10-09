import { spawn, spawnSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { isMissingOrPlaceholder, mergeEnvContent, parseEnvContent, type EnvMap } from "./setupUtils.ts";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");
const NODE_MODULES_PATH = path.join(ROOT, "node_modules");

type SetupMode = "host" | "container";

interface SetupOptions {
    mode: SetupMode;
    startDevServer: boolean;
    persistEnvFile: boolean;
}

const REQUIRED_LOCAL_KEYS = [
    "DATABASE_URL",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
    "DEV_ADMIN_ID",
    "DEV_ADMIN_EMAIL",
    "DEV_ADMIN_NAME",
    "DEMO_PASSWORD",
    "NEXT_PUBLIC_DEMO_PASSWORD",
    "NEXT_PUBLIC_DEV_ADMIN_EMAIL",
    "VITE_USE_MOCK_RENDER",
    "NEXT_PUBLIC_USE_MOCK_RENDER",
] as const;

function parseSetupOptions(argv: string[]): SetupOptions {
    let mode: SetupMode = "host";
    let startDevServer = true;

    for (const arg of argv) {
        if (arg.startsWith("--mode=")) {
            const value = arg.slice("--mode=".length);
            if (value === "container") {
                mode = "container";
            } else if (value === "host") {
                mode = "host";
            } else {
                throw new Error(`Invalid mode: ${value}. Expected host or container.`);
            }
        } else if (arg === "--no-start") {
            startDevServer = false;
        }
    }

    return {
        mode,
        startDevServer,
        persistEnvFile: mode === "host",
    };
}

function runOrThrow(command: string, args: string[]): void {
    const result = spawnSync(command, args, {
        cwd: ROOT,
        stdio: "inherit",
    });

    if (result.status !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(" ")}`);
    }
}

function parseMajorMinor(version: string): { major: number; minor: number } | null {
    const match = version.trim().match(/^(\d+)\.(\d+)\./);
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
    };
}

function shouldRefreshDependencies(): boolean {
    const drizzleVersionResult = spawnSync("pnpm", ["exec", "drizzle-kit", "--version"], {
        cwd: ROOT,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
    });

    if (drizzleVersionResult.status !== 0) {
        return true;
    }

    const parsed = parseMajorMinor(drizzleVersionResult.stdout);
    if (!parsed) {
        return true;
    }

    return parsed.major === 0 && parsed.minor < 31;
}

function ensureDependenciesInstalled(): void {
    if (!existsSync(NODE_MODULES_PATH)) {
        console.log("Installing dependencies...");
        runOrThrow("pnpm", ["install"]);
        return;
    }

    if (shouldRefreshDependencies()) {
        console.log("Updating dependencies to match project versions...");
        runOrThrow("pnpm", ["install"]);
    }
}

async function ensureEnvFileExists(): Promise<void> {
    if (existsSync(ENV_PATH)) {
        return;
    }
    await copyFile(ENV_EXAMPLE_PATH, ENV_PATH);
}

async function parseEnvFile(filePath: string): Promise<EnvMap> {
    const content = await readFile(filePath, "utf-8");
    return parseEnvContent(content);
}

async function writeMergedEnv(updates: EnvMap): Promise<void> {
    const currentContent = await readFile(ENV_PATH, "utf-8");
    await writeFile(ENV_PATH, mergeEnvContent(currentContent, updates), "utf-8");
}

function generateSecret(): string {
    return randomBytes(32).toString("hex");
}

async function collectRequiredEnvValues(existing: EnvMap, mode: SetupMode): Promise<EnvMap> {
    const rl = createInterface({ input: stdin, output: stdout });
    const isInteractive = Boolean(stdin.isTTY && stdout.isTTY);

    const defaults: EnvMap = {
        DATABASE_URL: mode === "container"
            ? "postgres://openviz:openviz@postgres:5432/openviz"
            : "",
        REDIS_URL: mode === "container"
            ? "redis://redis:6379"
            : "redis://localhost:6379",
        NEXTAUTH_URL: "http://localhost:3000",
        DEV_ADMIN_ID: randomUUID(),
        DEV_ADMIN_EMAIL: "admin@example.com",
        DEV_ADMIN_NAME: "Demo Admin",
        DEMO_PASSWORD: "openviz-demo-password",
        NEXT_PUBLIC_DEV_ADMIN_EMAIL: "admin@example.com",
        VITE_USE_MOCK_RENDER: "true",
        NEXT_PUBLIC_USE_MOCK_RENDER: "true",
    };

    const resolved: EnvMap = { ...existing };

    try {
        for (const key of REQUIRED_LOCAL_KEYS) {
            const current = resolved[key];
            if (!isMissingOrPlaceholder(current)) {
                continue;
            }

            if (key === "NEXTAUTH_SECRET") {
                resolved[key] = generateSecret();
                console.log("Generated NEXTAUTH_SECRET.");
                continue;
            }

            if (key === "NEXT_PUBLIC_DEMO_PASSWORD") {
                resolved[key] = resolved.DEMO_PASSWORD || defaults.DEMO_PASSWORD;
                continue;
            }

            if (key === "NEXT_PUBLIC_DEV_ADMIN_EMAIL") {
                resolved[key] = resolved.DEV_ADMIN_EMAIL || defaults.DEV_ADMIN_EMAIL;
                continue;
            }

            const fallback = defaults[key] ?? "";
            if (!isInteractive) {
                if (fallback.length > 0) {
                    resolved[key] = fallback;
                    continue;
                }
                throw new Error(`Missing required env value: ${key}`);
            }

            const prompt = fallback.length > 0
                ? `${key} (${fallback}): `
                : `${key}: `;
            const input = (await rl.question(prompt)).trim();
            resolved[key] = input || fallback;
        }
    } finally {
        rl.close();
    }

    if (resolved.NEXT_PUBLIC_DEMO_PASSWORD !== resolved.DEMO_PASSWORD) {
        resolved.NEXT_PUBLIC_DEMO_PASSWORD = resolved.DEMO_PASSWORD;
    }

    if (resolved.NEXT_PUBLIC_DEV_ADMIN_EMAIL !== resolved.DEV_ADMIN_EMAIL) {
        resolved.NEXT_PUBLIC_DEV_ADMIN_EMAIL = resolved.DEV_ADMIN_EMAIL;
    }

    resolved.VITE_USE_MOCK_RENDER = "true";
    resolved.NEXT_PUBLIC_USE_MOCK_RENDER = "true";

    return resolved;
}

async function validateDatabaseConnection(databaseUrl: string): Promise<void> {
    const { default: postgres } = await import("postgres");
    const sql = postgres(databaseUrl, { max: 1 });
    try {
        await sql`select 1`;
    } finally {
        await sql.end();
    }
}

function applyEnvToProcess(envValues: EnvMap): void {
    for (const [key, value] of Object.entries(envValues)) {
        process.env[key] = value;
    }
}

async function runSetup(): Promise<void> {
    const options = parseSetupOptions(process.argv.slice(2));
    ensureDependenciesInstalled();

    const envFileExists = existsSync(ENV_PATH);
    if (options.persistEnvFile && !envFileExists) {
        await ensureEnvFileExists();
    }

    const existingEnv = envFileExists
        ? await parseEnvFile(ENV_PATH)
        : {};
    const runtimeOverrides: EnvMap = options.mode === "container"
        ? {
            DATABASE_URL: process.env.DATABASE_URL ?? "",
            REDIS_URL: process.env.REDIS_URL ?? "",
            NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "",
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "",
            DEV_ADMIN_ID: process.env.DEV_ADMIN_ID ?? "",
            DEV_ADMIN_EMAIL: process.env.DEV_ADMIN_EMAIL ?? "",
            DEV_ADMIN_NAME: process.env.DEV_ADMIN_NAME ?? "",
            DEMO_PASSWORD: process.env.DEMO_PASSWORD ?? "",
            NEXT_PUBLIC_DEMO_PASSWORD: process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "",
            NEXT_PUBLIC_DEV_ADMIN_EMAIL: process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL ?? "",
            VITE_USE_MOCK_RENDER: process.env.VITE_USE_MOCK_RENDER ?? "",
            NEXT_PUBLIC_USE_MOCK_RENDER: process.env.NEXT_PUBLIC_USE_MOCK_RENDER ?? "",
        }
        : {};
    const resolvedEnv = await collectRequiredEnvValues(
        {
            ...existingEnv,
            ...runtimeOverrides,
        },
        options.mode
    );
    if (options.persistEnvFile) {
        await writeMergedEnv(resolvedEnv);
    }
    applyEnvToProcess(resolvedEnv);

    let databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is required after setup");
    }

    const isInteractive = Boolean(stdin.isTTY && stdout.isTTY) && options.mode === "host";
    while (true) {
        try {
            console.log("Checking database connection...");
            await validateDatabaseConnection(databaseUrl);
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`Database connection failed: ${message}`);

            if (!isInteractive) {
                throw new Error(
                    "Unable to connect to DATABASE_URL. Update .env with a valid Postgres connection and rerun setup."
                );
            }

            const rl = createInterface({ input: stdin, output: stdout });
            try {
                const answer = (await rl.question("Enter a valid DATABASE_URL (leave empty to abort): ")).trim();
                if (!answer) {
                    throw new Error("Setup aborted: DATABASE_URL was not corrected.");
                }

                databaseUrl = answer;
                if (options.persistEnvFile) {
                    await writeMergedEnv({ DATABASE_URL: databaseUrl });
                }
                process.env.DATABASE_URL = databaseUrl;
            } finally {
                rl.close();
            }
        }
    }

    console.log("Applying database schema...");
    runOrThrow("pnpm", ["run", "db:push"]);

    const devAdminId = process.env.DEV_ADMIN_ID;
    const devAdminEmail = process.env.DEV_ADMIN_EMAIL;
    const devAdminName = process.env.DEV_ADMIN_NAME;
    if (!devAdminId || !devAdminEmail || !devAdminName) {
        throw new Error("DEV_ADMIN_ID, DEV_ADMIN_EMAIL, and DEV_ADMIN_NAME are required");
    }

    console.log("Seeding default workspace and example project...");
    const { ensureBootstrapForDevAdmin } = await import("../src/lib/services/bootstrap.ts");
    await ensureBootstrapForDevAdmin(databaseUrl, {
        userId: devAdminId,
        email: devAdminEmail,
        name: devAdminName,
    });

    if (!options.startDevServer) {
        console.log("Setup complete.");
        return;
    }

    console.log("Setup complete. Starting development server...");
    const devProcess = spawn("pnpm", ["run", "dev"], {
        cwd: ROOT,
        stdio: "inherit",
    });

    devProcess.on("exit", (code) => {
        process.exit(code ?? 0);
    });
}

runSetup().catch((error) => {
    console.error("Setup failed.");
    if (error instanceof Error) {
        console.error(error.message);
    } else {
        console.error(error);
    }
    process.exit(1);
});
