#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import * as Y from 'yjs';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { installBrowserMeasures } from './collab-bench-browser.mjs';

const BASE_URL = process.env.OPENVIZ_BASE ?? 'http://localhost:3000';
const PROJECT_ID = process.env.COLLAB_BENCH_PROJECT_ID;
const COLLAB_URL = process.env.COLLAB_WS_URL ?? `ws://${new URL(BASE_URL).hostname}:1234`;
const SESSION = 'openviz-collab-bench';
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument.startsWith('--')) continue;
    const [rawKey, inlineValue] = argument.slice(2).split('=', 2);
    const next = process.argv[index + 1];
    if (inlineValue !== undefined) args.set(rawKey, inlineValue);
    else if (next && !next.startsWith('--')) {
        args.set(rawKey, next);
        index += 1;
    } else args.set(rawKey, 'true');
}
const CLIENTS = Number(args.get('clients') ?? 50);
const CURSOR_HZ = Number(args.get('cursor-hz') ?? 33);
const EDIT_HZ = Number(args.get('edit-hz') ?? 1);
const DURATION_SECONDS = Number(args.get('duration-seconds') ?? 60);
const WARMUP_SECONDS = Number(args.get('warmup-seconds') ?? 5);
const CONFIRMED = args.has('confirm-mutable-scene');
const MAX_BUFFER = 16 * 1024 * 1024;
if (args.has('help')) {
    console.log('Usage: COLLAB_BENCH_PROJECT_ID=<dev-project> node scripts/perf/collab-bench.mjs --clients 50 --cursor-hz 33 --edit-hz 1 --duration-seconds 60 --confirm-mutable-scene');
    process.exit(0);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const browser = (...command) => execFileSync('agent-browser', ['--headed', '--session', SESSION, ...command], {
    encoding: 'utf8', timeout: 90_000, maxBuffer: MAX_BUFFER,
});
const evalPage = (script) => {
    const output = browser('eval', script).trim().split('\n').at(-1) ?? '';
    try {
        const value = JSON.parse(output);
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        return output;
    }
};
const percentile = (values, p = 0.95) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
};
const summarize = (values) => ({
    samples: values.length,
    p95: percentile(values),
    min: values.length ? values.reduce((a, b) => Math.min(a, b), Infinity) : null,
    max: values.length ? values.reduce((a, b) => Math.max(a, b), -Infinity) : null,
});

if (!PROJECT_ID) throw new Error('Set COLLAB_BENCH_PROJECT_ID to a dedicated development project.');
if (!CONFIRMED) throw new Error('This test mutates and restores a scene. Re-run with --confirm-mutable-scene.');
if (!Number.isInteger(CLIENTS) || CLIENTS < 2 || CLIENTS > 50) throw new Error('--clients must be from 2 to 50.');
if (!Number.isFinite(CURSOR_HZ) || CURSOR_HZ < 30 || CURSOR_HZ > 40) throw new Error('--cursor-hz must be from 30 to 40.');
if (EDIT_HZ !== 1) throw new Error('--edit-hz must be 1 for the specified workload.');
if (!Number.isInteger(DURATION_SECONDS) || DURATION_SECONDS < 10) throw new Error('--duration-seconds must be at least 10.');

const peers = [];
let started = false;
let sceneId;
let nodeId;
let selectedNodePayloadBytes = null;
const documentSyncSamples = [];
const cursorSamples = [];

function waitForProvider(provider, index, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => finish(new Error(`Peer ${index} did not sync within ${timeoutMs} ms.`)), timeoutMs);
        const onSynced = ({ state }) => { if (state) finish(); };
        const onAuthFailed = ({ reason }) => finish(new Error(`Peer ${index} authentication failed: ${reason}`));
        const onAttemptsFailed = () => finish(new Error(`Peer ${index} exhausted connection retries.`));
        const finish = (error) => {
            clearTimeout(timeout);
            provider.off('synced', onSynced);
            provider.off('authenticationFailed', onAuthFailed);
            provider.off('maxAttemptsFailed', onAttemptsFailed);
            if (error) reject(error);
            else resolve();
        };
        provider.on('synced', onSynced);
        provider.on('authenticationFailed', onAuthFailed);
        provider.on('maxAttemptsFailed', onAttemptsFailed);
    });
}

function makePeer(index, token) {
    const doc = new Y.Doc();
    const websocketProvider = new HocuspocusProviderWebsocket({ url: COLLAB_URL, autoConnect: false });
    const provider = new HocuspocusProvider({
        websocketProvider,
        name: sceneId,
        document: doc,
        token,
    });
    provider.attach();
    const client = { doc, provider, websocketProvider, interval: undefined, index };
    peers.push(client);
    return client;
}

async function main() {
    console.log(`Collaborative performance benchmark: ${CLIENTS} clients, ${CURSOR_HZ} cursors/sec/client, ${EDIT_HZ} graph edit/sec`);
    browser('open', `${BASE_URL}/login`);
    await sleep(1200);
    if (browser('get', 'url').includes('/login')) {
        browser('find', 'text', 'Dev Login', 'click');
        await sleep(2500);
    }

    const tokenResult = evalPage(`(async () => {
        const response = await fetch('/api/projects/${PROJECT_ID}/scenes/collab-token', { method: 'POST', credentials: 'include' });
        return JSON.stringify({ status: response.status, body: await response.json() });
    })()`);
    if (!tokenResult?.body?.token || tokenResult.status !== 200) {
        throw new Error(`Could not obtain an authorized room token (HTTP ${tokenResult?.status ?? 'unknown'}).`);
    }
    sceneId = tokenResult.body.sceneId;
    browser('open', `${BASE_URL}/projects/${PROJECT_ID}/workbench?collabPerf=1`);

    const browserConnectedAt = Date.now();
    while (Date.now() - browserConnectedAt < 30_000) {
        const connected = evalPage("document.querySelector('[data-testid=\"collab-status-chip\"]')?.getAttribute('data-collab-active') === 'true'");
        if (connected === true) break;
        await sleep(300);
    }
    if (!evalPage("document.querySelector('[data-testid=\"collab-status-chip\"]')?.getAttribute('data-collab-active') === 'true'")) {
        const diagnostics = evalPage(`JSON.stringify({ url: location.href, collabStatus: document.querySelector('[data-testid="collab-status-chip"]')?.getAttribute('data-collab-status'), sessionActive: document.querySelector('[data-testid="collab-status-chip"]')?.getAttribute('data-collab-active'), accessUnavailable: document.body.innerText.includes('Access unavailable') })`);
        throw new Error(`The editor did not activate its shared-document session. Inspect workbench project context/permissions. UI state: ${JSON.stringify(diagnostics)}`);
    }

    installBrowserMeasures(evalPage);
    const peerCount = CLIENTS - 1;
    const syncedPeers = [];
    const batchSize = 8;
    for (let start = 0; start < peerCount; start += batchSize) {
        const batch = Array.from({ length: Math.min(batchSize, peerCount - start) }, (_, offset) => makePeer(start + offset, tokenResult.body.token));
        await Promise.all(batch.map(async (peer) => {
            const synced = waitForProvider(peer.provider, peer.index);
            await peer.websocketProvider.connect();
            await synced;
        }));
        syncedPeers.push(...batch);
        console.log(`  connected ${syncedPeers.length}/${peerCount} external peers`);
    }

    const nodes = syncedPeers[0].doc.getMap('nodes');
    const selectedNode = [...nodes.entries()]
        .filter((entry) => entry[1] instanceof Y.Map)
        .map(([id, value]) => ({ id, value, size: JSON.stringify(value.toJSON()).length }))
        .sort((left, right) => left.size - right.size)[0];
    if (!selectedNode) throw new Error('The dedicated benchmark scene has no graph node to move.');
    nodeId = selectedNode.id;
    selectedNodePayloadBytes = selectedNode.size;
    const controlReadyAt = Date.now();
    while (Date.now() - controlReadyAt < 60_000) {
        if (evalPage("Boolean(window.__openvizCollabBenchControl?.ready)")) break;
        await sleep(100);
    }
    if (!evalPage("Boolean(window.__openvizCollabBenchControl?.ready)")) {
        throw new Error('Workbench document did not finish its initial sync; benchmark will not mutate an unready scene.');
    }
    for (const peer of syncedPeers) {
        peer.provider.setAwarenessField('user', { id: `bench-${peer.index}`, name: `Bench ${peer.index}` });
        peer.provider.on('awarenessUpdate', ({ states }) => {
            for (const state of states) {
                if (state.clientId === peer.provider.awareness?.clientID) continue;
                const sentAt = state.collabBenchSentAt;
                const sampleSequence = state.collabBenchSequence;
                if (typeof sentAt === 'number' && typeof sampleSequence === 'number') {
                    const lastSequence = peer.lastCursorSequences?.get(state.clientId);
                    if (sampleSequence !== lastSequence) {
                        peer.lastCursorSequences ??= new Map();
                        peer.lastCursorSequences.set(state.clientId, sampleSequence);
                        cursorSamples.push(Math.max(0, Date.now() - sentAt));
                    }
                }
            }
        });
        peer.doc.on('update', () => {
            const pulse = peer.doc.getMap('metadata').get('__collabBench');
            if (!pulse || typeof pulse !== 'object') return;
            const sentAt = pulse.sentAt;
            const pulseSequence = pulse.sequence;
            if (typeof sentAt !== 'number' || typeof pulseSequence !== 'number') return;
            const lastSequence = peer.lastDocumentSequence ?? 0;
            if (pulseSequence <= lastSequence) return;
            peer.lastDocumentSequence = pulseSequence;
            documentSyncSamples.push(Math.max(0, Date.now() - sentAt));
        });
        peer.interval = setInterval(() => {
            const sentAt = Date.now();
            const cursorSequence = ++peer.cursorSequence || (peer.cursorSequence = 1);
            peer.provider.setAwarenessField('cursor', { x: (cursorSequence * 13) % 800, y: (peer.index * 17) % 600 });
            peer.provider.setAwarenessField('collabBenchSentAt', sentAt);
            peer.provider.setAwarenessField('collabBenchSequence', cursorSequence);
        }, Math.round(1000 / CURSOR_HZ));
    }

    evalPage('window.__openvizCollabBench.cursorOnlyPhase = true');
    await sleep(5000);
    evalPage('window.__openvizCollabBench.cursorOnlyPhase = false');
    await sleep(WARMUP_SECONDS * 1000);
    evalPage('window.__openvizCollabBench.begin()');
    const benchmarkStart = Date.now();
    evalPage(`window.__openvizCollabBenchControl.start(${JSON.stringify(nodeId)}, ${1000 / EDIT_HZ})`);
    started = true;
    await sleep(DURATION_SECONDS * 1000);
    evalPage('window.__openvizCollabBenchControl.stop()');
    evalPage('window.__openvizCollabBench.end()');

    const browserStats = evalPage('JSON.stringify({ ...window.__openvizCollabBench, graphEdits: window.__openvizCollabBenchControl?.editsMade ?? 0 })');
    const fps = browserStats?.fps ?? [];
    const fpsWindowSeconds = 5;
    const rollingFps = fps.flatMap((_, index) => {
        const window = fps.slice(index, index + fpsWindowSeconds);
        return window.length === fpsWindowSeconds ? [window.reduce((sum, value) => sum + value, 0) / window.length] : [];
    });
    const metrics = {
        clients: CLIENTS,
        cursorHzPerClient: CURSOR_HZ,
        graphEditsPerSecond: EDIT_HZ,
        graphEditsCompleted: browserStats?.graphEdits ?? 0,
        durationSeconds: DURATION_SECONDS,
        sceneNodeCount: nodes.size,
        encodedDocumentBytes: Y.encodeStateAsUpdate(syncedPeers[0].doc).byteLength,
        editedNodePayloadBytes: selectedNodePayloadBytes,
        browserVisibilityState: browserStats?.visibilityState ?? 'unknown',
        documentSyncMs: summarize([...documentSyncSamples, ...(browserStats?.documentSyncMs ?? [])]),
        cursorLatencyMs: summarize(cursorSamples),
        interactionLatencyMs: summarize(browserStats?.interactionLatencyMs ?? []),
        sustainedFps: {
            samples: fps.length,
            windowSeconds: fpsWindowSeconds,
            minimum: rollingFps.length ? Math.min(...rollingFps) : null,
            minimumOneSecondBucket: fps.length ? Math.min(...fps) : null,
            average: fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : null,
        },
        cursorOnlyGraphMutations: browserStats?.cursorOnlyGraphMutations ?? null,
    };
    const report = {
        projectId: PROJECT_ID,
        sceneId,
        collabUrl: COLLAB_URL,
        startedAt: new Date(benchmarkStart).toISOString(),
        metrics,
        targets: {
            documentSyncP95Ms: 200,
            cursorLatencyP95Ms: 150,
            interactionLatencyP95Ms: 100,
            minimumFps: 30,
        },
        passed: {
            documentSync: metrics.documentSyncMs.p95 !== null && metrics.documentSyncMs.p95 < 200,
            cursorLatency: metrics.cursorLatencyMs.p95 !== null && metrics.cursorLatencyMs.p95 < 150,
            interactionLatency: metrics.interactionLatencyMs.p95 !== null && metrics.interactionLatencyMs.p95 < 100,
            frameRate: metrics.sustainedFps.minimum !== null && metrics.sustainedFps.minimum >= 30,
            cursorRenderIsolation: metrics.cursorOnlyGraphMutations === 0,
        },
    };
    console.log(JSON.stringify(report, null, 2));
    if (process.env.OPENVIZ_BENCH_OUT) writeFileSync(process.env.OPENVIZ_BENCH_OUT, `${JSON.stringify(report, null, 2)}\n`);
    if (Object.values(report.passed).some((pass) => !pass)) process.exitCode = 2;
}

try {
    await main();
} finally {
    if (started && nodeId) {
        try { browser('eval', 'window.__openvizCollabBenchControl?.cleanup()'); } catch { /* browser may have closed */ }
        await sleep(2500);
    }
    for (const peer of peers) {
        if (peer.interval) clearInterval(peer.interval);
        peer.provider.destroy();
        peer.websocketProvider.destroy();
        peer.doc.destroy();
    }
    if (process.env.COLLAB_BENCH_KEEP_BROWSER !== '1') {
        try { browser('close'); } catch { /* session may not have launched */ }
    }
}
