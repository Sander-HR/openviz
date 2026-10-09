#!/usr/bin/env node
/**
 * OpenViz performance harness.
 *
 * Modes:
 *   lh    Authenticated Lighthouse runs against given URLs (desktop preset).
 *   flow  Dashboard -> project-open chunk capture + studio/workbench switch latency.
 *   all   Both (default).
 *
 * Usage:
 *   node scripts/perf-lighthouse.mjs [all|lh|flow] [--url <u>]... [--project <id>] [--workspace <id>]
 *
 * Env:
 *   APP_URL          Base URL of a RUNNING production server (default http://localhost:3000)
 *   PERF_PROJECT_ID  Project id for flow mode (default: first project in recents order)
 *   PERF_WS_ID       Workspace id (default: discovered from /api/projects)
 *   PERF_HEADFUL     Set to 1 to watch Chrome (default headless)
 *
 * Output: docs/performance/runs/<timestamp>/{lighthouse-*.json, flow.json, summary.md}
 *
 * Auth: mints an Auth.js v5 session JWT with the app's own encoder
 * (@auth/core/jwt.js + NEXTAUTH_SECRET) so runs are authenticated without a
 * browser login. The dev admin user (all-zero id, admin@example.com) is used.
 */
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode as encodeAuthJwt } from "../node_modules/@auth/core/jwt.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Env / args
// ---------------------------------------------------------------------------

function loadDotEnv() {
    try {
        const raw = readFileSync(path.join(ROOT, ".env"), "utf8");
        for (const line of raw.split("\n")) {
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (!m) continue;
            let value = m[2];
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (process.env[m[1]] === undefined) process.env[m[1]] = value;
        }
    } catch {
        /* no .env — rely on process env */
    }
}

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith("--")) ?? "all";
function flagValue(name, fallback = undefined) {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
}
const urls = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--url") urls.push(args[i + 1]);

const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PROJECT_ID = flagValue("project", process.env.PERF_PROJECT_ID);
const WS_ID = flagValue("workspace", process.env.PERF_WS_ID);
const HEADFUL = process.env.PERF_HEADFUL === "1";

// ---------------------------------------------------------------------------
// Session cookie (Auth.js v5 JWT, minted locally)
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = "authjs.session-token";
const DEV_ADMIN = {
    id: "00000000-0000-0000-0000-000000000000",
    email: "admin@example.com",
    name: "Dev Admin",
};

async function mintSessionCookie() {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("NEXTAUTH_SECRET missing from .env");
    return encodeAuthJwt({
        token: { sub: DEV_ADMIN.id, email: DEV_ADMIN.email, name: DEV_ADMIN.name },
        secret,
        salt: SESSION_COOKIE_NAME,
    });
}

async function apiFetch(pathname) {
    const cookie = await mintSessionCookie();
    const res = await fetch(`${APP_URL}${pathname}`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
    });
    if (!res.ok) throw new Error(`API ${pathname} -> ${res.status}`);
    return res.json();
}

// ---------------------------------------------------------------------------
// Minimal CDP client (Node 22 global WebSocket)
// ---------------------------------------------------------------------------

class CdpSession {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        this.ready = new Promise((resolve, reject) => {
            this.ws.addEventListener("open", () => resolve());
            this.ws.addEventListener("error", () => reject(new Error("CDP websocket error")));
        });
        this.ws.addEventListener("message", (event) => {
            const msg = JSON.parse(typeof event.data === "string" ? event.data : Buffer.from(event.data).toString());
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                if (msg.error) reject(new Error(`${msg.error.message}${msg.error.data ? ` (${msg.error.data})` : ""}`));
                else resolve(msg.result ?? {});
            } else if (msg.method) {
                for (const cb of this.listeners.get(msg.method) ?? []) cb(msg.params);
            }
        });
    }

    async send(method, params = {}) {
        await this.ready;
        const id = this.nextId++;
        this.ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject: (err) => reject(new Error(`CDP ${method}: ${err.message}`)) });
        });
    }

    on(method, cb) {
        if (!this.listeners.has(method)) this.listeners.set(method, []);
        this.listeners.get(method).push(cb);
    }

    close() {
        try { this.ws.close(); } catch { /* noop */ }
    }
}

async function launchChrome() {
    const { launch } = await import("chrome-launcher");
    const chrome = await launch({
        headless: !HEADFUL,
        chromeFlags: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
    });
    const version = await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json();
    return { chrome, browser: new CdpSession(version.webSocketDebuggerUrl) };
}

async function openPage(browser, port) {
    const target = await browser.send("Target.createTarget", { url: "about:blank" });
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = targets.find((t) => t.id === target.targetId);
    if (!page?.webSocketDebuggerUrl) throw new Error("Could not resolve page websocket");
    const session = new CdpSession(page.webSocketDebuggerUrl);
    await session.send("Page.enable");
    await session.send("Network.enable");
    await session.send("Runtime.enable");
    return { targetId: target.targetId, session };
}

// ---------------------------------------------------------------------------
// Lighthouse
// ---------------------------------------------------------------------------

async function runLighthouse(chromePort, url) {
    const lighthouse = (await import("lighthouse")).default;
    const result = await lighthouse(url, {
        port: chromePort,
        logLevel: "error",
        onlyCategories: ["performance"],
        formFactor: "desktop",
        screenEmulation: { disabled: true },
        // Real (unthrottled) timings. Lighthouse's CPU-simulation mode
        // miscomputes LCP on this app — trace analysis shows the LCP image
        // paints at ~1s while the simulator reports 10-19s (it double-counts
        // UKM navigation bookkeeping events). Measured values are honest and
        // reproducible on a fixed machine; flow timings below are measured too.
        throttlingMethod: "provided",
        maxWaitForLoad: 90_000,
    });
    const a = result.lhr.audits;
    return {
        url,
        score: Math.round((result.lhr.categories.performance.score ?? 0) * 100),
        metrics: {
            fcp_ms: a["first-contentful-paint"]?.numericValue,
            lcp_ms: a["largest-contentful-paint"]?.numericValue,
            tbt_ms: a["total-blocking-time"]?.numericValue,
            cls: a["cumulative-layout-shift"]?.numericValue,
            si_ms: a["speed-index"]?.numericValue,
        },
        totals: {
            total_bytes: a["total-byte-weight"]?.numericValue,
            request_count: Object.keys(a).length ? result.lhr.environment?.userAgent : undefined,
        },
        audits: pickAudits(a),
    };
}

function pickAudits(a) {
    const wanted = [
        "first-contentful-paint", "largest-contentful-paint", "speed-index",
        "total-blocking-time", "cumulative-layout-shift",
        "mainthread-work-breakdown", "bootup-time", "font-display",
        "render-blocking-resources", "unused-javascript", "modern-image-formats",
    ];
    const out = {};
    for (const key of wanted) {
        const audit = a[key];
        if (!audit) continue;
        out[key] = { displayValue: audit.displayValue, numericValue: audit.numericValue };
        if (key === "mainthread-work-breakdown" && audit.details?.items) {
            out[key].breakdown = audit.details.items
                .map((i) => ({ group: i.groupLabel, ms: Math.round(i.duration) }))
                .sort((x, y) => y.ms - x.ms);
        }
        if (key === "font-display" && audit.details?.items) {
            out[key].fonts = audit.details.items.map((i) => ({ url: i.url, display: i.fontDisplay ?? null }));
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Flow capture: dashboard -> project open + view switch latency
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForNetworkIdle(session, quietMs = 1500, timeoutMs = 30_000) {
    const start = Date.now();
    let lastActivity = Date.now();
    session.on("Network.requestWillBeSent", () => { lastActivity = Date.now(); });
    while (Date.now() - start < timeoutMs) {
        await sleep(200);
        if (Date.now() - lastActivity > quietMs) return;
    }
}

async function evaluate(session, expression) {
    const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
        throw new Error(`Page eval failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    }
    return result.result?.value;
}

async function runFlow(browser, port, projectId) {
    // Discover workspace + project via authenticated API.
    const projects = await apiFetch("/api/projects");
    const wsId = WS_ID ?? projects[0]?.workspaceId;
    if (!wsId) throw new Error("No workspace found for perf user");
    const target = projectId ? projects.find((p) => p.id === projectId) : projects[0];
    if (!target) throw new Error(`Project ${projectId} not found for perf user`);

    const { targetId, session } = await openPage(browser, port);
    try {
        // 1. Load dashboard to a stable state (this also warms shared chunks).
        await session.send("Page.navigate", { url: `${APP_URL}/files/${wsId}/recents` });
        await waitForNetworkIdle(session, 2000, 90_000);
        await sleep(500);

        // 2. Arm request capture, then double-click the project card.
        const requests = [];
        session.on("Network.requestWillBeSent", (p) => {
            if (["Script", "StyleSheet", "Font", "Image", "Fetch", "XHR"].includes(p.type)) {
                requests.push({ t: Date.now(), type: p.type, url: p.request.url });
            }
        });

        const clickResult = await evaluate(session, `(() => {
            const cards = [...document.querySelectorAll('div.cursor-pointer')];
            // Exact name match first — 'Test' must not open 'Collab Test v3'.
            let card = cards.find((el) => el.textContent?.trim() === ${JSON.stringify(target.name)});
            if (!card) card = cards.find((el) => {
                const texts = [...el.querySelectorAll('h1,h2,h3,h4,p,span,div')].map((n) => n.textContent?.trim());
                return texts.includes(${JSON.stringify(target.name)});
            });
            if (!card) card = cards.find((el) => el.textContent?.includes(${JSON.stringify(target.name)}));
            if (!card) return { ok: false, reason: 'card not found', count: cards.length };
            card.scrollIntoView({ block: 'center' });
            card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
            return { ok: true };
        })()`);
        if (!clickResult?.ok) throw new Error(`Could not open project card: ${JSON.stringify(clickResult)}`);

        const navStart = Date.now();

        // 3. Wait until the workspace canvas is interactive (ReactFlow or Konva).
        let canvasReadyAt = null;
        for (let i = 0; i < 600; i++) {
            await sleep(100);
            const state = await evaluate(session, `(() => ({
                url: location.pathname,
                reactflow: !!document.querySelector('.react-flow'),
                konva: !!document.querySelector('.konvajs-content'),
            }))()`);
            if (state.url.includes("/projects/") && (state.reactflow || state.konva)) {
                canvasReadyAt = Date.now();
                break;
            }
        }
        if (!canvasReadyAt) throw new Error("Workspace canvas never became ready");

        // Guard against opening the wrong project (e.g. substring name matches).
        const openedPath = await evaluate(session, "location.pathname");
        if (!openedPath.includes(target.id)) {
            throw new Error(`Opened ${openedPath} but expected project ${target.id}`);
        }

        // Let late chunks settle, then snapshot post-navigation requests.
        await waitForNetworkIdle(session, 1500, 30_000);
        const afterNav = requests.filter((r) => r.t >= navStart - 50);
        // data: URLs (inline base64 assets — the mock-mode bloat we are trying
        // to fix) must not be printed verbatim.
        for (const r of afterNav) {
            if (r.url.startsWith("data:")) r.url = `[data-url ${r.url.length} chars]`;
        }

        // 4. View switch latency (dual-mount: both views exist in the DOM;
        //    hidden view's toggle button is clickable via el.click()).
        const switches = [];
        const doSwitch = async (title, expectPathSegment) => {
            const clicked = await evaluate(session, `(() => {
                const btn = document.querySelector('button[title=${JSON.stringify(title)}]');
                if (!btn) return false;
                window.__switchT0 = performance.now();
                btn.click();
                return true;
            })()`);
            if (!clicked) { switches.push({ title, ok: false, reason: "toggle button not found" }); return; }
            for (let i = 0; i < 200; i++) {
                await sleep(50);
                const dt = await evaluate(session, `(() => {
                    if (!location.pathname.includes(${JSON.stringify(expectPathSegment)})) return null;
                    return Math.round(performance.now() - window.__switchT0);
                })()`);
                if (dt !== null && dt !== undefined) { switches.push({ title, ok: true, ms: dt }); return; }
            }
            switches.push({ title, ok: false, reason: "timeout" });
        };

        await doSwitch("Back to Studio", "/studio");
        await sleep(300);
        await doSwitch("Switch to Workbench", "/workbench");

        const heap = await evaluate(session, "performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : null");

        return {
            project: { id: target.id, name: target.name, workspaceId: wsId },
            open_to_canvas_ms: canvasReadyAt - navStart,
            post_nav_requests: afterNav.map((r) => (r.url.startsWith("http") ? { type: r.type, url: new URL(r.url).pathname } : { type: r.type, url: r.url })),
            switches,
            heap_used_mb: heap,
        };
    } finally {
        session.close();
        await browser.send("Target.closeTarget", { targetId }).catch(() => {});
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function slugify(url) {
    return new URL(url).pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
}

async function main() {
    await loadDotEnv();
    const startedAt = Date.now();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = path.join(ROOT, "docs", "performance", "runs", stamp);
    await mkdir(outDir, { recursive: true });

    // Discover workspace up front for default Lighthouse URLs.
    let wsId = WS_ID;
    if (!wsId) {
        try {
            const projects = await apiFetch("/api/projects");
            wsId = projects[0]?.workspaceId;
        } catch (err) {
            console.error(`[perf] Could not discover workspace: ${err.message} — is the app running at ${APP_URL}?`);
            process.exit(1);
        }
    }

    const { chrome, browser } = await launchChrome();
    // Auth cookie is set via document.cookie on the app origin (browser-wide,
    // shared by all tabs). Network.setCookies is avoided: this Chrome build
    // rejects its params with a CBOR deserialization error.
    const cookie = await mintSessionCookie();
    const setupPage = await openPage(browser, chrome.port);
    try {
        await setupPage.session.send("Page.navigate", { url: `${APP_URL}/login` });
        for (let i = 0; i < 100; i++) {
            await sleep(100);
            const ready = await evaluate(setupPage.session, "document.readyState === 'complete'").catch(() => false);
            if (ready) break;
        }
        const setOk = await evaluate(setupPage.session, `document.cookie = ${JSON.stringify(`${SESSION_COOKIE_NAME}=${cookie}; path=/`)}; document.cookie.includes(${JSON.stringify(SESSION_COOKIE_NAME)})`);
        if (!setOk) throw new Error("Could not set session cookie via document.cookie");
    } finally {
        setupPage.session.close();
        await browser.send("Target.closeTarget", { targetId: setupPage.targetId }).catch(() => {});
    }

    const summary = { mode, appUrl: APP_URL, workspaceId: wsId, startedAt, lighthouse: [], flow: null };
    let exitCode = 0;

    try {
        if (mode === "lh" || mode === "all") {
            const targets = urls.length ? urls : [`${APP_URL}/files/${wsId}/recents`];
            for (const url of targets) {
                console.log(`[perf] Lighthouse ${url}`);
                try {
                    const result = await runLighthouse(chrome.port, url);
                    summary.lighthouse.push(result);
                    await writeFile(path.join(outDir, `lighthouse-${slugify(url)}.json`), JSON.stringify(result, null, 2));
                } catch (err) {
                    console.error(`[perf] Lighthouse failed for ${url}: ${err.message}`);
                    summary.lighthouse.push({ url, error: err.message });
                    exitCode = 1;
                }
            }
        }

        if (mode === "flow" || mode === "all") {
            console.log("[perf] Flow capture (dashboard -> project open + view switch)");
            try {
                summary.flow = await runFlow(browser, chrome.port, PROJECT_ID);
                await writeFile(path.join(outDir, "flow.json"), JSON.stringify(summary.flow, null, 2));
            } catch (err) {
                console.error(`[perf] Flow capture failed: ${err.message}`);
                summary.flow = { error: err.message };
                exitCode = 1;
            }
        }
    } finally {
        await writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
        console.log(`[perf] Artifacts: ${outDir}`);
        browser.close();
        chrome.kill();
    }

    // Markdown summary for humans.
    const lines = [
        `# Perf run ${stamp}`,
        "",
        `- App: ${APP_URL}`,
        `- Mode: ${mode}`,
        `- Duration: ${Math.round((Date.now() - startedAt) / 1000)}s`,
        "",
    ];
    if (summary.lighthouse.length) {
        lines.push("## Lighthouse (desktop, authenticated)", "", "| URL | Score | FCP | LCP | TBT | CLS | SI |", "|---|---|---|---|---|---|---|");
        for (const run of summary.lighthouse) {
            if (run.error) { lines.push(`| ${run.url} | ERROR: ${run.error} | | | | | |`); continue; }
            const m = run.metrics;
            lines.push(
                `| ${new URL(run.url).pathname} | ${run.score} | ${Math.round(m.fcp_ms ?? 0)}ms | ${Math.round(m.lcp_ms ?? 0)}ms | ${Math.round(m.tbt_ms ?? 0)}ms | ${m.cls?.toFixed(3) ?? "?"} | ${Math.round(m.si_ms ?? 0)}ms |`,
            );
        }
        lines.push("");
    }
    if (summary.flow && !summary.flow.error) {
        const f = summary.flow;
        lines.push(
            "## Flow capture",
            "",
            `- Project: ${f.project.name} (${f.project.id})`,
            `- Open -> canvas interactive: **${f.open_to_canvas_ms}ms**`,
            `- Post-nav requests: ${f.post_nav_requests.length}`,
            `- Heap after both views mounted: ${f.heap_used_mb ?? "?"}MB`,
            "",
            "### View switches",
        );
        for (const s of f.switches) lines.push(`- ${s.title}: ${s.ok ? `${s.ms}ms` : `FAILED (${s.reason})`}`);
        lines.push("", "### Post-navigation asset requests", "");
        for (const r of f.post_nav_requests) lines.push(`- [${r.type}] ${r.url}`);
    } else if (summary.flow?.error) {
        lines.push("## Flow capture", "", `ERROR: ${summary.flow.error}`);
    }
    await writeFile(path.join(outDir, "summary.md"), lines.join("\n"));
    console.log(lines.join("\n"));
    process.exit(exitCode);
}

main().catch((err) => {
    console.error("[perf] Fatal:", err);
    process.exit(1);
});
