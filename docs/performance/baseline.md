# Performance Baseline (Sprint 0)

**Captured**: 2026-10-08 · production build (`pnpm run build` + `next start`, Next.js 16.2.4, webpack)
**Environment**: local host, docker-compose Postgres/Redis/MinIO (`localhost:5434/6379/4566`), dev-admin session (all-zero user id)
**Tooling**: `pnpm run perf` → `scripts/perf-lighthouse.mjs` (Lighthouse desktop preset + CDP flow capture, authenticated via minted Auth.js JWT)

## Flow 1 — Dashboard load (`/files/<ws>/recents`)

| Metric | Value | Note |
|---|---|---|
| Lighthouse score | **58** | desktop, authenticated |
| FCP | 2715ms | |
| LCP | **14340ms** | dominated by project-card thumbnails (data-URL images from scene JSONB) |
| TBT | 126ms | |
| CLS | 0.000 | |
| Total transferred | **32.2MB** | per-card `/api/projects/[id]/previews` N+1 + base64 thumbnails (mock mode) |
| Main-thread work | 1.1s | Script Evaluation 445ms, Other 485ms |

## Flow 2 — Dashboard → open project (CDP capture, warm dashboard)

### Small project ("Untitled", scene JSONB ≈ 133KB)

| Metric | Value |
|---|---|
| Open → canvas interactive | **457ms** |
| Post-nav requests | 30 (17 JS chunks + RSC payload fetches + API calls) |
| View switch workbench→studio | **80ms** |
| View switch studio→workbench | **95ms** |
| Heap after both views mounted | 75MB |

Chunks downloaded *after* the click (what Sprint 1 preloading must eliminate):
`app/projects/[id]/layout-*.js`, `04a6ace5-*.js`, `3619-*.js`, `3824-*.js` (xyflow),
`2928-*.js`, `4808.*.js`, `1584.*.js`, `9099-*.js`, `9105-*.js`, `5116-*.js`,
`7658.*.js`, `980-*.js`, `5908.*.js`, `d0efa934.*.js`, `4558.*.js` (konva, 312K),
`7481-*.js`, `2721.*.js`

### Heavy project ("Test", scene JSONB ≈ **40.9MB** — mock-mode base64 bloat)

| Metric | Value | vs small |
|---|---|---|
| Open → canvas interactive | **3611ms** | 8× slower |
| Post-nav requests | 51 | includes repeated `/api/projects/[id]` fetches |
| View switch workbench→studio | **290ms** | dual-mount no longer "instant" |
| View switch studio→workbench | **587ms** | both canvas engines render heavy scenes |
| Heap after both views mounted | **412MB** | 5.5× |

## Flow 3 — Workbench route load (`/projects/<id>/workbench`)

| Metric | Value | Note |
|---|---|---|
| Lighthouse score | **28** | desktop, authenticated |
| FCP | 2710ms | |
| LCP | 8560ms | canvas content behind JS evaluation |
| TBT | **1253ms** | dual-mount: Konva + ReactFlow + all studio panels evaluate on load |
| Total transferred | 2.2MB | small project |
| Main-thread work | **3.1s** | Script Evaluation **2405ms**, Parsing 229ms, Style&Layout 101ms |
| Bootup time | 2.4s | module evaluation of lazy-loaded view chunks |

## Interpretation → sprint mapping

- **Sprint 1 (preload)**: Flow 2 shows ~700KB of view chunks + route RSC payloads download only after the click; fonts (Inter variable, 728KB) load without preload hints. Goal: zero new chunk downloads on project entry.
- **Sprint 2 (project open)**: heavy-project open is dominated by the 40MB scene JSONB round-trip + store hydration; dashboard LCP is the per-card previews N+1. Goal: cache-first render from IndexedDB, one batched previews request, ETag/304.
- **Sprint 3 (image delivery)**: mock-mode thumbnails are inline base64 (32MB on the dashboard page!); S3 mode pays auth + 307 + fresh presign per image with no HTTP caching. Goal: thumbnail variants, lazy node images, cached presigns, immutable cache headers.
- **Sprint 4 (bundle/runtime)**: workbench TBT 1253ms / bootup 2.4s from evaluating both views' full component trees at once. Goal: defer heavy studio panels out of the initial chunk.

## Results — Sprint 1 (preload & cache headers) · commit `de08af6`

| Metric | Before | After |
|---|---|---|
| JS chunks downloaded after project click | 17 | **1** (only the route's own layout chunk) |
| Dashboard → open → canvas (small project) | 457ms | **280ms** |
| Lighthouse recents score / FCP | 58 / 2715ms | **69 / 1206ms** |
| Lighthouse workbench score / TBT | 28 / 1253ms | **42 / 489ms** |

Changes: shared view-chunk import promises + idle `AppAssetPreloader` (root layout),
dashboard card hover/focus `router.prefetch` + keyboard open, `/projects/[id]/loading.tsx`
skeleton (unlocks route prefetching), font `<link rel="preload">` hoisted to `<head>`,
font cache headers fixed (`max-age=0` → `public, max-age=86400, stale-while-revalidate=604800`).

## Results — Sprint 2 (fast project open) · this commit

Verified in production build via CDP (in-app navigation, warm dashboard):

| Metric | Before | After |
|---|---|---|
| Open → first node, small project (cold) | ~457ms (harness) | **511ms** (CDP dblclick; harness flow re-run pending) |
| Re-open same project (SWR from IndexedDB) | = cold open | **104ms** (5× faster) |
| Open → first node, heavy 40MB project (cold) | 3611ms | **3554ms** (scene fetch now overlaps; render-bound — Sprint 4 target) |
| Re-open heavy project (SWR) | = cold open | **358ms** (10× faster) |
| Dashboard preview requests | N+1 (one per card) | **1** batched `/api/projects/previews` (22 thumbs / 4 projects in one query) |
| `GET /api/projects/:id` revalidation | full body every time | **ETag + 304**; `Cache-Control: private, max-age=5, swr=60` |
| `lastViewedAt` side effect on GET | mutated per read | stable; explicit `POST …/viewed` (fire-and-forget) |
| Heavy scene payload (`?lite=1`) | 39.0MB | **44KB** (880×, inline data URLs stripped) |
| Collab room token | fetched after scene fetch (Workbench mounts only when ready) | **prefetched in parallel** with the scene fetch (`roomTokenPrefetch.ts`) |
| Redundant autosave on open | full-scene re-save + version bump every open | skipped client-side (hydrated-payload guard) and server-side (idempotent PATCH, no version bump) |

Notes:
- SWR first paint uses the persisted `workbenchNodes` when `lastOpenedProjectId === id`
  (new store field — deliberately not cleared on unmount; `currentProjectId` still is).
  Server data reconciles via `shouldHydrateFromServer`; collab-active sessions are never
  clobbered. Full-page loads remain chunk-load-bound (~2.4s locally) — SWR pays off in
  in-app navigation, which is the real user flow.
- Collab *join* (WebSocket) still starts when Workbench mounts; only the token round-trip
  was parallelized. Moving the mount earlier requires a live collab server to validate
  room-seeding semantics — deferred, not done blind.
- Coverage gate: 169 files / 1120 tests green, 72.84% statements (floor held).

## Results — Sprint 3 (image delivery) · this commit

Verified end-to-end against local MinIO (real upload → thumbnail → cached delivery):

| Item | Result |
|---|---|
| Uploaded objects | `Cache-Control: public, max-age=31536000, immutable` **signed into the presigned PUT** and stored as object metadata — browsers fetch each asset's bytes from S3 exactly once and stop re-hitting `/api/assets/<token>` (no more per-image auth + presign minting) |
| Thumbnail pipeline | `POST /api/assets/thumbnail` → sharp WebP ≤512px: 1600×900 PNG (21KB) → **512×288 WebP**, immutable headers, deterministic key (`thumbnails/<…>.webp`) — progressive enhancement: any failure yields `thumbnailUrl: null`, uploads never break |
| Canvas/dashboard display | `project.thumbnail` now carries the small variant for S3 uploads; full resolution stays on `layer.image` (studio editing) — zero rendering changes needed (`ImageNode` already renders `project.thumbnail`) |
| Resolve route | 307 redirect cached `private, max-age=3600` per user (presign target valid 24h; objects immutable) |
| Backfill | `scripts/backfill-thumbnails.mjs` — idempotent, dry-run by default (`--apply` to write); verified: skips existing thumbnails, reports undecodable objects without crashing |

Scope decisions (documented per plan constraints):
- **Redis presign caching skipped**: with immutable object headers + cached redirects, the
  presign-mint cost is paid once per asset per browser. A Redis layer would cache a value
  that is effectively never re-requested — no measurable win, new failure mode. (The plan
  marked this item optional; docker-compose Redis remains available for future use.)
- **Render-path thumbnails out of scope**: ComfyUI render outputs are remote URLs in their
  own cache domain; thumbnail variants cover the S3 upload path (workbench media uploads).
- Mock mode unchanged: data-URL fallback still applies; Sprint 2's `?lite=1` + SWR already
  address mock-mode payload bloat.

## Results — Sprint 4 (bundle & runtime) · this commit

**Harness fix first**: Lighthouse's CPU-simulation mode (`throttlingMethod: 'simulate'`)
miscomputes LCP on this app. Raw-trace analysis of a simulated run showed the LCP image
(`PaintImage`) painting at **~983ms**, UKM `NavStartToLargestContentfulPaint` duration
**245ms**, and *zero* trace events after t=2s — yet the simulator reported 10–19s (it
double-counts navigation bookkeeping events). The harness now runs with
`throttlingMethod: 'provided'` (real, unthrottled timings — honest on a fixed machine;
flow captures were always measured). Pre-Sprint-4 simulated LCP numbers are **not
comparable** to the ones below.

| Item | Before | After |
|---|---|---|
| Lighthouse `/files/<ws>/recents` (measured) | score 58, FCP 2715ms, TBT 1253ms | **score 100**, FCP **79ms**, LCP **445ms**, TBT **0ms**, CLS 0 |
| Dashboard batch previews response (mock mode) | **25.6MB** (19 full-res base64 thumbs) | **0.55MB** (46× smaller, same 19 thumbs, ≤512px WebP) |
| Project list response (mock mode) | 1.76MB (one 1.7MB PNG data-URL `thumbnailUrl`) | **0.13MB** (13× smaller) |

Dashboard LCP root cause: mock-mode thumbnails were full-resolution base64 in two places —
scene-node thumbnails (batch previews) and per-project `thumbnailUrl` (project list +
single-project GET). Fix: shared sharp-based downsample helper (`downsampleDataUrlThumbnail` /
`downsampleDataUrls`, ≤512px WebP, bounded concurrency, short S3 refs pass through,
undecodable bytes keep the original) applied to `GET /api/projects/previews`,
`GET /api/projects`, `GET /api/projects/:id` (read path — fixes existing rows without a
migration) and `PATCH /api/projects/:id` (write path — keeps the DB lean going forward).
New mock-mode uploads also get a browser-side ≤512px WebP data-URL thumbnail
(`makeThumbnailDataUrl`, canvas + `createImageBitmap`, graceful null when canvas APIs are
missing) so scene JSONB stops accumulating large base64 thumbnails.

Other Sprint 4 items:
- **AI compute probe deferred to idle**: `useAIComputeStatus` ran its endpoint probe on
  mount, and `ComputePopover` mounts with the workbench on every project open. The first
  probe now waits for `requestIdleCallback` (8s timeout; 500ms fallback) — refresh-on-open
  is unchanged and the header pill still shows live status once the idle probe lands.
- **Dead code removed**: legacy Vite entry chain (`index.html`, `src/main.tsx`,
  `src/App.tsx`, ~315 lines) deleted — nothing imports it (Next.js App Router has been the
  runtime since the migration). `src/index.css` was kept: it is imported by
  `src/app/globals.css` (Tailwind directives + design tokens).
- **Bundle**: view-level code splitting (Studio/Workbench via `next/dynamic`) landed in
  Sprint 1 with idle preloading; studio sub-panels are conditionally mounted per workflow
  tab. No further splitting done — the konva chunk (~316KB) loads with the view and is
  warmed by the preloader before navigation.

Flow captures (measured, warm dashboard):

| Project | Open → canvas (cold) | View switch | Heap (both views mounted) |
|---|---|---|---|
| Small ("Untitled", ~133KB scene) | 514ms | 67ms / 84ms | 17MB |
| Heavy ("Test", ~40.9MB mock scene) | **3280ms** (Sprint 0: 3611ms) | 93ms / <100ms | **288MB** (Sprint 0: 412MB) |
| Heavy, in-app re-open (SWR from IndexedDB) | **357ms** (Sprint 2: 358ms — unchanged) | — | — |

Coverage gate: 172 files / 1144 tests passing, **72.61%** statements (floor 46%).

## Note: mock-mode payload sizes are not representative

Without S3/MinIO, `assetUpload` falls back to inlining base64 data URLs into
node data (`src/services/assetUpload.ts`). The "Test" project above carries a
**40.9MB scene JSONB** purely from that bloat; production (S3 mode) scenes are
URL references and typically KB-sized. Treat heavy-project numbers here as an
upper bound. `GET /api/projects/:id?lite=1` returns the same scene with inline
data URLs stripped for lighter fetches, and dev-mode logs record each scene's
payload size on project GET (`[perf] scene payload ...`).

---

# Collab streaming & lazy asset loading (plan v2)

Supersedes the mock-mode note above: Sprint 1 of this plan removed the base64
upload fallback entirely (uploads now fail loud when S3 is down) and wiped all
base64-bloated test scenes from the DB, so every scene in the dev database is
refs-only (KB-sized).

## Results — Collab Sprint 1 (refs-only contract + 3-tier pipeline)

- `uploadBlobToAsset` returns `{url, thumbnailUrl, previewUrl}` — sharp-generate
  `:thumb.webp` (≤512px) + `:preview.webp` (≤1024px) at upload time; scene data
  stores refs only.
- AI render outputs (http **and** provider data-URLs) are re-hosted to S3;
  storage failure = distinct recoverable error, never a base64 fallback.
- Studio exit thumbnails upload as S3 refs (`uploadCanvasThumbnail`); on failure
  the previous thumbnail is kept.
- All `downsample*` safety nets removed from read/write paths (full purge).

## Results — Collab Sprint 2 (streaming readiness + column pruning) · commit pending

**Server fetch** (`server/collab/persistence.ts`): room creation now selects
only `{id, name, ydoc}` when a saved Y.Doc exists (the 40MB `data` JSONB is
never loaded); the full row is read only to seed a brand-new room.

**Client readiness** (`ProjectWorkspace` + `projectReadiness.ts`): the page
gates on `GET /api/projects/:id?lite=1` (KB-sized, inline data stripped) while
the collab join starts in parallel. The full scene is fetched **only** when the
join is terminally unavailable (token endpoint down → `failed`, auth denied,
or still pending after a 5s bounded wait) and nothing was painted from cache.
`resolveSceneHydration` + `settleCollabOutcome` are pure, table-tested.

**Measured (CDP, cold profile, dev server, welcome scene ≈ 1.3KB JSONB):**

| Path | Requests on open | WS sync (recv) | First node painted |
|---|---|---|---|
| Collab **up** | `?lite=1` ×2 + collab-token; **no full-scene GET** | 15.4 KB total (max frame 11.2 KB ≈ doc size) | ~2.2s |
| Collab **down** (token 500 / WS unreachable) | `?lite=1` ×2 → **one** full GET after the 5s wait | — | ~9s (dev; bounded by the wait, then single-user) |

Before this sprint the same open serialized a full-scene REST fetch (MB-sized
when scenes were base64-bloated) *and* a full Y.Doc WS sync of the same bytes.
Both are now KB-sized and parallel; the REST payload on the critical path is
the lite variant only.

Remaining long-lived traffic on open: `POST /viewed` (side-effect moved out of
GET), scene-list GETs (metadata) and the legacy `/scenes/stream` SSE presence
channel (out of scope for this plan — hocuspocus awareness owns presence).

### Sprint 3 — tiered asset delivery (measured 2026-10-09, CDP cold profile)

Scene seeded with a 2000×1200 PNG (S3) + a 640×360 MP4, both uploaded through
the 3-tier pipeline. Asset requests observed per flow:

| Flow | Requests (order) | Full-res / video bytes |
|---|---|---|
| Workbench open | thumb (t+2.7s) → preview after idle (t+2.8s) + video poster | **none** — full PNG and MP4 not fetched |
| Workbench, zoom to 207% (>200% threshold) | + full PNG ×1 (browser-cached after) | full PNG only on demand |
| Studio hidden (dual-mounted, workbench active) | workbench tiers only | **zero** Konva layer fetches while hidden (`useVisibilityLatch`) |
| Open node in Studio (dblclick → /studio) | + full PNG at first visibility | layers load once the latch arms |

Video cards render the captured poster (`<img>`); the MP4 is requested only
when the fullscreen modal opens (unit-tested: no `<video>` element inline).
Before this sprint, opening a workbench with an image node fetched the
full-res asset immediately, and the dual-mounted Studio fetched every layer's
full image at mount — both are now gated.

## How to re-run

```bash
pnpm run build && pnpm start &        # production server on :3000
pnpm run perf                          # all modes (lh + flow) → docs/performance/runs/<ts>/
node scripts/perf-lighthouse.mjs flow --project <id>   # single project flow capture
```

Raw artifacts per run: `docs/performance/runs/<timestamp>/{summary.md, summary.json, flow.json, lighthouse-*.json}` (gitignored — regenerate with the commands above).
