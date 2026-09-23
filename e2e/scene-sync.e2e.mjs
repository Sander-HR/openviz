#!/usr/bin/env node
/**
 * e2e/scene-sync.e2e.mjs
 *
 * End-to-end test for workbench -> backend scene synchronization.
 *
 * Validates the fix in src/hooks/useAutoSaveScene.ts + gesture-end flushes:
 *   1. Log in as dev admin and open a project's workbench.
 *   2. Drag a node with real mouse events (down, incremental moves, up).
 *   3. Assert the new position is persisted to Postgres shortly after
 *      mouse-up (immediate save on gesture end, not only via the 1s debounce).
 *   4. Reload the page as fast as possible after mouse-up and assert the NEW
 *      position is rendered. With the old debounce-only behavior a reload
 *      within ~1s of mouse-up would restore the stale position.
 *   5. Restore the node to its original position (keeps the test re-runnable).
 *
 * Requirements:
 *   - dev server running at BASE_URL (default http://localhost:3000)
 *   - openviz-postgres container with a main scene for PROJECT_ID
 *   - agent-browser CLI installed
 *
 * Usage: node e2e/scene-sync.e2e.mjs
 */

import { execFileSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const PROJECT_ID = process.env.PROJECT_ID ?? '9ad32117-9cda-4a96-a112-b7591439e61f';
const SESSION = 'e2e-scene-sync';
const DRAG = { dx: 60, dy: 40 }; // screen pixels
const TOL = 12; // flow-px tolerance (snap grid is 5px)

const MAX_BUFFER = 64 * 1024 * 1024;

const ab = (...args) =>
    execFileSync('agent-browser', ['--session', SESSION, ...args], { encoding: 'utf8', timeout: 90_000, maxBuffer: MAX_BUFFER });

const db = (sql) =>
    execFileSync(
        'docker',
        ['exec', '-i', 'openviz-postgres', 'psql', '-U', 'openviz', '-d', 'openviz', '-t', '-A', '-c', sql],
        { encoding: 'utf8', timeout: 30_000, maxBuffer: MAX_BUFFER }
    ).trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
    console.log(`  FAIL  ${msg}`);
    failures += 1;
};
const approx = (a, b, tol = TOL) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

/** Run an eval; handles agent-browser's JSON encoding of object/string results. */
const evalJson = (js) => {
    const out = ab('eval', js).trim();
    try {
        const value = JSON.parse(out);
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return value; // plain string result
            }
        }
        return value;
    } catch {
        return out; // raw string result
    }
};

const nodePosEval = (id) => `(() => {
    const el = document.querySelector('[data-id="${id}"]');
    if (!el) return JSON.stringify({ error: 'node element not found' });
    const vp = document.querySelector('.react-flow__viewport');
    let zoom = 1;
    const m = (vp && vp.style.transform ? vp.style.transform : '').match(/scale\\(([-\\d.]+)\\)/);
    if (m) zoom = parseFloat(m[1]);
    const t = el.style.transform || '';
    const mm = t.match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
    return JSON.stringify({ x: mm ? parseFloat(mm[1]) : null, y: mm ? parseFloat(mm[2]) : null, zoom });
})()`;

/** Read a node's flow position; retries while React Flow settles transforms. */
async function readNodePos(id, tries = 10) {
    let last = null;
    for (let i = 0; i < tries; i += 1) {
        last = evalJson(nodePosEval(id));
        if (last && Number.isFinite(last.x) && Number.isFinite(last.y)) return last;
        await sleep(400);
    }
    const diag = evalJson(`(() => {
        const el = document.querySelector('[data-id="${id}"]');
        if (!el) return JSON.stringify({ error: 'missing' });
        const r = el.getBoundingClientRect();
        return JSON.stringify({
            cls: (el.className || '').toString().slice(0, 100),
            styleAttr: (el.getAttribute('style') || '').slice(0, 200),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            url: location.href,
            flowNodes: document.querySelectorAll('.react-flow__node').length,
        });
    })()`);
    throw new Error(`could not read DOM position for ${id}: last=${JSON.stringify(last)} diag=${JSON.stringify(diag)}`);
}

const pickUnobscuredNodeEval = (ids) => `(() => {
    const ids = ${JSON.stringify(ids)};
    for (const id of ids) {
        const el = document.querySelector('[data-id="' + id + '"]');
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const top = document.elementFromPoint(cx, cy);
        if (top && (el.contains(top) || top.contains(el))) return id;
    }
    return null;
})()`;

async function waitForSelector(sel, timeoutMs = 30_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            if (parseInt(ab('get', 'count', sel).trim(), 10) > 0) return true;
        } catch {
            // page may be mid-navigation; keep polling
        }
        await sleep(300);
    }
    return false;
}

async function waitForUrl(fragment, timeoutMs = 30_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (ab('get', 'url').includes(fragment)) return true;
        await sleep(300);
    }
    return false;
}

/** True when the browser holds a valid auth session. */
async function isAuthenticated() {
    try {
        const out = evalJson(`(async () => {
            const r = await fetch('/api/auth/session', { credentials: 'include' });
            const body = await r.json();
            return JSON.stringify({ ok: r.ok, hasUser: Boolean(body && body.user) });
        })()`);
        return Boolean(out && out.ok && out.hasUser);
    } catch {
        return false;
    }
}

/** Re-run the dev login (agent-browser can drop httpOnly session cookies on reloads). */
async function ensureLoggedIn() {
    if (await isAuthenticated()) return false;
    ab('open', `${BASE_URL}/login`);
    await waitForSelector('button');
    ab('find', 'text', 'Dev Login', 'click');
    if (!(await waitForUrl('/dashboard'))) throw new Error('re-login failed');
    return true;
}

function readScene() {
    const raw = db(`SELECT data::text FROM scenes WHERE project_id='${PROJECT_ID}' AND is_main;`);
    return JSON.parse(raw);
}

function sceneVersion() {
    return parseInt(db(`SELECT version FROM scenes WHERE project_id='${PROJECT_ID}' AND is_main;`), 10);
}

async function main() {
    console.log('E2E: workbench scene sync on mouse release\n');
    console.log(`  base url:   ${BASE_URL}`);
    console.log(`  project id: ${PROJECT_ID}\n`);

    try {
        // ------------------------------------------------------------------
        console.log('[1/6] Baseline from database');
        const baseline = readScene();
        const version0 = sceneVersion();
        const candidates = baseline.nodes.filter(
            (n) => n.type === 'image' && Number.isFinite(n.x) && Number.isFinite(n.y)
        );
        if (candidates.length === 0) throw new Error('no draggable image node with x/y in main scene');
        console.log(`  main scene version: ${version0}, candidate nodes: ${candidates.length}`);

        // ------------------------------------------------------------------
        console.log('[2/6] Login as dev admin');
        ab('open', `${BASE_URL}/login`);
        if (!(await waitForSelector('button'))) throw new Error('login page did not render buttons');
        ab('find', 'text', 'Dev Login', 'click');
        if (!(await waitForUrl('/dashboard'))) throw new Error('did not reach /dashboard after login');
        pass('logged in, on dashboard');

        // Clear persisted app state so every run starts from a clean slate (no stale
        // viewMode, no stale node positions). zustand persist uses idb-keyval, which
        // lives in the 'keyval' IndexedDB database under the key 'openviz-storage-idb'.
        // (deleteDatabase would fail while the page holds an open connection.)
        evalJson(`(() => {
            return new Promise((resolve) => {
                try {
                    const req = indexedDB.open('keyval');
                    req.onsuccess = () => {
                        const db = req.result;
                        if (!db.objectStoreNames.contains('keyval')) { resolve('no-store'); return; }
                        const tx = db.transaction('keyval', 'readwrite');
                        tx.objectStore('keyval').delete('openviz-storage-idb');
                        tx.oncomplete = () => { db.close(); resolve('cleared'); };
                        tx.onerror = () => resolve('tx-error');
                    };
                    req.onerror = () => resolve('open-error');
                } catch (e) {
                    resolve('exception');
                }
            });
        })()`);
        await sleep(1000);

        // ------------------------------------------------------------------
        console.log('[3/6] Open project and switch to workbench');
        ab('open', `${BASE_URL}/projects/${PROJECT_ID}`);
        const hasWorkbenchToggle = await waitForSelector('[title="Switch to Workbench"]');
        if (hasWorkbenchToggle) {
            ab('click', '[title="Switch to Workbench"]');
        }
        if (!(await waitForSelector('.react-flow__node'))) throw new Error('workbench nodes did not render');
        await sleep(2500); // let fitView settle

        const pickedId = evalJson(pickUnobscuredNodeEval(candidates.map((n) => n.id)));
        if (!pickedId) throw new Error('no candidate node is visible/unobscured in the viewport');
        const target = candidates.find((n) => n.id === pickedId);
        console.log(`  dragging node ${target.id} (db pos: ${target.x}, ${target.y})`);

        const before = await readNodePos(target.id);
        if (!approx(before.x, target.x) || !approx(before.y, target.y)) {
            fail(`DOM baseline (${before.x}, ${before.y}) != DB baseline (${target.x}, ${target.y})`);
        } else {
            pass(`baseline: DOM matches DB at (${before.x}, ${before.y}), zoom=${before.zoom.toFixed(3)}`);
        }

        const versionAfterEntry = sceneVersion(); // absorbs workbench-entry autosave
        console.log(`  scene version settled at: ${versionAfterEntry}`);

        // ------------------------------------------------------------------
        console.log('[4/6] Drag node with real mouse events');
        const box = JSON.parse(ab('get', 'box', `[data-id="${target.id}"]`, '--json')).data;
        const sx = box.x + box.width / 2;
        const sy = box.y + box.height / 2;

        // agent-browser's CLI only accepts integer coordinates.
        ab('mouse', 'move', String(Math.round(sx)), String(Math.round(sy)));
        ab('mouse', 'down');
        const steps = 8;
        for (let i = 1; i <= steps; i += 1) {
            ab('mouse', 'move', String(Math.round(sx + (DRAG.dx * i) / steps)), String(Math.round(sy + (DRAG.dy * i) / steps)));
            await sleep(30);
        }
        const tMouseUp = Date.now();
        ab('mouse', 'up');
        pass(`mouse released at node center, dragged (${DRAG.dx}, ${DRAG.dy}) screen px`);

        // ------------------------------------------------------------------
        console.log('[5/6] Verify sync + immediate reload persistence');
        const after = await readNodePos(target.id, 3);
        // Synthetic CDP drags can drop a few pixels; assert direction + magnitude,
        // then treat the actual position as the source of truth for persistence.
        const expectedDx = DRAG.dx / before.zoom;
        const expectedDy = DRAG.dy / before.zoom;
        const gotDx = after.x - before.x;
        const gotDy = after.y - before.y;
        if (gotDx > 0.4 * expectedDx && gotDy > 0.4 * expectedDy) {
            pass(`DOM moved: (${before.x}, ${before.y}) -> (${after.x}, ${after.y})`);
        } else {
            fail(
                `DOM did not move as expected: delta (${gotDx.toFixed(1)}, ${gotDy.toFixed(1)}), wanted ~(${expectedDx.toFixed(1)}, ${expectedDy.toFixed(1)})`
            );
        }

        // Reload as fast as possible after mouse-up (old code saved only >=1s later).
        const tReload = Date.now();
        ab('reload');
        console.log(`  reload issued ${tReload - tMouseUp}ms after mouse-up`);
        await sleep(2000); // let the page settle before probing auth
        const reloginNeeded = await ensureLoggedIn();
        if (reloginNeeded) {
            console.log('  NOTE: browser lost its session cookie on reload — re-logged in');
            ab('open', `${BASE_URL}/projects/${PROJECT_ID}`);
        }
        if (!(await waitForSelector('.react-flow__node', 45_000))) throw new Error('nodes did not render after reload');
        await sleep(2000); // let fitView settle

        const reloaded = await readNodePos(target.id);

        // Diagnostics: where does each layer's data live right after the reload?
        const persistPos = evalJson(`(() => {
            return new Promise((resolve) => {
                try {
                    const req = indexedDB.open('keyval');
                    req.onsuccess = () => {
                        const db = req.result;
                        const tx = db.transaction('keyval', 'readonly');
                        const g = tx.objectStore('keyval').get('openviz-storage-idb');
                        g.onsuccess = () => {
                            try {
                                const state = JSON.parse(g.result);
                                const n = (state?.workbenchNodes || []).find((x) => x.id === '${target.id}');
                                resolve(JSON.stringify({ persist: n ? { x: n.x, y: n.y } : null }));
                            } catch (e) {
                                resolve(JSON.stringify({ persist: 'parse-error' }));
                            }
                        };
                        g.onerror = () => resolve(JSON.stringify({ persist: 'read-error' }));
                    };
                    req.onerror = () => resolve(JSON.stringify({ persist: 'open-error' }));
                } catch (e) {
                    resolve(JSON.stringify({ persist: 'exception' }));
                }
            });
        })()`);
        const pendingPos = evalJson(`(() => {
            return new Promise((resolve) => {
                try {
                    const req = indexedDB.open('openviz-scene-sync');
                    req.onsuccess = () => {
                        const db = req.result;
                        const tx = db.transaction('pending', 'readonly');
                        const g = tx.objectStore('pending').get('${PROJECT_ID}');
                        g.onsuccess = () => {
                            try {
                                const rec = g.result;
                                const n = rec?.data?.nodes?.find((x) => x.id === '${target.id}');
                                resolve(JSON.stringify({ pending: rec ? { expectedVersion: rec.expectedVersion, pos: n ? { x: n.x, y: n.y } : null, savedAt: rec.savedAt } : null }));
                            } catch (e) {
                                resolve(JSON.stringify({ pending: 'parse-error' }));
                            }
                        };
                        g.onerror = () => resolve(JSON.stringify({ pending: 'read-error' }));
                    };
                    req.onerror = () => resolve(JSON.stringify({ pending: 'open-error' }));
                } catch (e) {
                    resolve(JSON.stringify({ pending: 'exception' }));
                }
            });
        })()`);
        console.log(`  layers after reload: persist=${JSON.stringify(persistPos)} pending=${JSON.stringify(pendingPos)}`);

        if (approx(reloaded.x, after.x) && approx(reloaded.y, after.y)) {
            pass(`after reload the NEW position is rendered: (${reloaded.x}, ${reloaded.y})`);
        } else if (approx(reloaded.x, before.x) && approx(reloaded.y, before.y)) {
            fail(`REGRESSION: reload restored the STALE position (${reloaded.x}, ${reloaded.y})`);
        } else {
            fail(`reload position unexpected: (${reloaded.x}, ${reloaded.y}); want ~(${after.x}, ${after.y})`);
        }

        // Backend state: version must have advanced and saved pos must match.
        let persisted = null;
        const deadline = Date.now() + 8_000;
        while (Date.now() < deadline && !persisted) {
            const v = sceneVersion();
            if (v > versionAfterEntry) {
                const n = readScene().nodes.find((node) => node.id === target.id);
                if (n && approx(n.x, after.x) && approx(n.y, after.y)) persisted = { version: v, x: n.x, y: n.y };
            }
            if (!persisted) await sleep(150);
        }
        if (persisted) {
            const latency = Date.now() - tMouseUp;
            pass(
                `backend persisted new position (${persisted.x}, ${persisted.y}), version ${versionAfterEntry} -> ${persisted.version} (observed within ${latency}ms of mouse-up)`
            );
        } else {
            fail('backend never received the new node position within 8s');
        }

        // ------------------------------------------------------------------
        console.log('[6/6] Restore original position (keeps test re-runnable)');
        // Viewport may have re-fitted after the reload — re-query the node's box.
        const boxAfter = JSON.parse(ab('get', 'box', `[data-id="${target.id}"]`, '--json')).data;
        const rx = boxAfter.x + boxAfter.width / 2;
        const ry = boxAfter.y + boxAfter.height / 2;
        // Drag from wherever the node actually is back to its original flow position.
        const restoreDx = (before.x - reloaded.x) * reloaded.zoom;
        const restoreDy = (before.y - reloaded.y) * reloaded.zoom;
        ab('mouse', 'move', String(Math.round(rx)), String(Math.round(ry)));
        ab('mouse', 'down');
        for (let i = 1; i <= steps; i += 1) {
            ab('mouse', 'move', String(Math.round(rx + (restoreDx * i) / steps)), String(Math.round(ry + (restoreDy * i) / steps)));
            await sleep(30);
        }
        ab('mouse', 'up');
        await sleep(2500); // debounce window for the restore save

        const restored = readScene().nodes.find((node) => node.id === target.id);
        if (restored && approx(restored.x, target.x) && approx(restored.y, target.y)) {
            pass(`node restored to (${restored.x}, ${restored.y})`);
        } else {
            fail(
                `restore failed: db now has (${restored?.x ?? '?'}, ${restored?.y ?? '?'}), wanted (${target.x}, ${target.y})`
            );
        }
    } catch (error) {
        fail(`aborted: ${error.message}`);
    } finally {
        try {
            ab('close');
        } catch {
            // ignore
        }
    }

    console.log(failures === 0 ? '\nRESULT: PASS ✅' : `\nRESULT: FAIL ❌ (${failures} failure(s))`);
    process.exit(failures === 0 ? 0 : 1);
}

main();
