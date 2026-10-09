# Plan: Collab Streaming & Lazy Asset Loading

**Generated**: 2025-10-08 (v2 — testing-environment constraints applied)
**Estimated Complexity**: Medium-High (3 sprints; migration script dropped, no backwards-compat paths)
**Supersedes/extends**: `app-performance-optimization-plan.md` (Sprints 0–4 landed; this is the follow-up phase)

## Overview

Deep-dive analysis of live collab found that **97.5% of a heavy scene's Y.Doc is embedded Studio canvases carrying full-res base64 images** (measured: 40.4MB `ydoc` + 40.4MB `data` for the "Test" project). The same content crosses the network twice per cold open, serially (REST GET gates readiness → then full Y.Doc WS sync), and Studio's dual-mounted canvas fetches+decodes every layer image on project open even while the user is in Workbench.

This plan makes **S3/MinIO the single asset repository** — scene data holds refs only, never base64 — and layers asset delivery by need:

```
Workbench first paint   → ≤512px WebP thumbnail (already in doc, tiny)
While user works        → ≤1024px WebP preview prefetched in background (new tier)
Zoom > 200% / Studio    → full-res original, fetched on demand
Video nodes             → static poster frame only; full video loads in fullscreen
```

Plus the two collab transfer fixes: parallel lite-readiness + join, and server fetch column pruning.

### Locked decisions (testing environment — NO backwards-compatibility constraints)
| Decision | Choice | Consequence |
|---|---|---|
| Base64 in scene data | **Never.** S3/MinIO is the asset repository; refs only | Contract change, full purge below |
| Uploads when S3 unreachable | **Fail with a clear error** (toast + no node created) | MinIO always available via docker-compose in this env |
| Existing heavy test scenes (40MB "Test", 13.9MB #2) | **Wipe & start fresh** — delete the affected test projects; all verification uses new uploads | No migration script; ydoc rows die with their scenes |
| Video inline preview | **Poster frame + play button**; full video loads only in fullscreen. Poster captured client-side at upload (canvas → WebP blob → normal asset upload) | No ffmpeg, no new server deps |
| Image quality tiers | **3**: ≤512px WebP / ≤1024px WebP / full-res original (>200% zoom or Studio) | 1024 tier generated **at upload time** (sharp), refs stored in node data |
| Base64 code purge scope | **Full purge**: mock upload fallback, client `makeThumbnailDataUrl`, AND server-side `downsample*` read/write safety nets from Sprints 3–4 | Scene contract = S3 refs only; no dead safety nets |
| Collab scope | Lite readiness + column pruning. Awareness-drag positions (P3) and data/ydoc double-write removal (P4) are **non-goals** | — |

## Prerequisites
- MinIO running (`docker compose up s3`) — the asset repository; already in docker-compose
- `sharp` (installed, Sprint 3), existing thumbnail pipeline (`src/lib/services/thumbnail.ts`, `thumbnailKeyFor` in `src/lib/services/s3.ts`)
- **DB dump before the data wipe** (safety net for test scenes): `pg_dump` to `/tmp/openviz-pre-wipe.dump`
- Perf harness from Sprint 0 (`pnpm run perf`) + CDP scripts for network-waterfall verification
- Collab server for Sprint 2/3 E2E: `pnpm dev:collab` (tsx `server/collab/index.ts`, ws://localhost:1234) — not currently running; peer-sync verification needs two browser contexts (CDP)
- TDD per AGENTS.md: logic layers strict red-green; components behavior-tested from acceptance criteria; coverage floor (72.61% statements) must not regress

---

## Sprint 1: No-base64 invariant + 3-tier upload pipeline

**Goal**: New uploads produce scenes containing only S3 refs at three quality tiers; S3-down is a clean, surfaced error; all data-URL machinery is gone from the codebase.
**Demo/Validation**:
- Upload an image in Workbench with MinIO running → inspect scene JSONB: `layers[].image` + `project.thumbnail` + `project.previewUrl` are short `/api/assets/...` refs; zero `data:` strings
- `docker compose stop s3`, upload again → error toast, no node created, scene unchanged
- Upload a video → poster image asset appears in MinIO, node stores poster ref, inline shows poster (no `<video>` element yet — Sprint 3 swaps the render, but data shape lands here)
- Edit in Studio + exit → flattened canvas is uploaded as an asset; scene JSONB and `projects.thumbnail_url` hold refs only
- Render task (generation-lab or workbench render node) → outputs stored as S3 refs, including provider data-URL responses
- `pnpm test` green, tsc clean, grep: no persisted `data:`-URL writers remain in `src/` (transient AI request payloads like RenderPanel's base64 input are out of scope — they are never stored)

### Task 1.1: Extend thumbnail pipeline with a ≤1024px "preview" tier
- **Location**: `src/lib/services/thumbnail.ts`, `src/app/api/assets/thumbnail/route.ts`, `src/lib/services/s3.ts`
- **Description**: Generalize the generator: `generateVariant(buffer, { maxDim, quality })`. Keep `THUMBNAIL_MAX_DIM=512`; add `PREVIEW_MAX_DIM=1024`. New key scheme: `previewKeyFor(key)` alongside `thumbnailKeyFor`. The thumbnail API accepts `{ key, variant: 'thumb' | 'preview' }` (default `'thumb'`).
- **Dependencies**: none
- **Acceptance Criteria**:
  - Both variants generated from one sharp pass where possible; both stored with immutable Cache-Control
  - Existing thumb keys/behavior unchanged (Sprint 3 consumers unaffected)
- **Validation**: unit tests for key derivation + variant params (red-green); E2E vs MinIO: request both variants, assert dimensions ≤ maxDim and content-type webp

### Task 1.2: Upload path returns all three refs (+ video poster capture)
- **Location**: `src/services/assetUpload.ts`, `src/services/workbench/mediaUploadLogic.ts` (+ tests), `src/types/index.ts`
- **Description**: For image uploads, generate both variants after PUT; return `UploadedAsset { url, thumbnailUrl, previewUrl }`. `buildImageNode` stores `project.thumbnail = thumbnailUrl`, new optional `Project.previewUrl`; layer keeps full-res `url`. New exported `captureVideoPoster(videoBlob): Promise<Blob | null>`: object URL → offscreen `<video preload="metadata" muted>` → seek to `min(0.1, duration/2)`s on `seeked` → canvas ≤512px → WebP blob → uploaded through the normal pipeline → `Project.posterUrl` (new optional field). **Poster failure never fails the upload** (any decode/codec failure → null → placeholder tile later).
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Image node JSON contains only short refs (test with stubbed S3 client)
  - Video node stores `{ full video ref, posterUrl: ref | null }`; no inline base64 anywhere
  - `Project` type gains optional `previewUrl?` and `posterUrl?`
- **Validation**: red-green for `buildImageNode` mapping + pure seek-time/size-clamp logic; jsdom guard test: canvas APIs missing → poster null, upload still succeeds; manual E2E with a sample mp4

### Task 1.3: Remove the base64 fallback — fail loud when S3 is down
- **Location**: `src/services/assetUpload.ts`, upload call sites (`src/components/workbench/hooks/useWorkbenchMediaUpload.ts`, `src/components/studio/Toolbar.tsx`, `src/components/studio/ToolContextMenu.tsx`)
- **Description**: Replace the catch-block `blobToDataUrl` fallback with a typed `AssetStoreUnavailableError`. Call sites catch it → toast ("Asset storage unavailable — start MinIO: docker compose up s3"); no node created. Delete `makeThumbnailDataUrl` + its tests and the fallback branch.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - No code path writes a `data:` URL into scene state (grep-verifiable + test)
  - S3-down upload: toast shown, store unchanged
- **Validation**: red-green for error typing; behavior tests at each call site (toast + no node)

### Task 1.5: Studio-exit thumbnail → asset ref (third data-URL writer)
- **Location**: `src/components/hooks/useCanvasViewport.ts` (`handleExitStudio`), `src/components/studio/Toolbar.tsx` (`handleToggleWorkbench`), `src/store/slices/workbenchSceneActions.ts` (`saveCurrentToWorkbench`), new helper in `src/services/assetUpload.ts`
- **Description**: Discovered during plan review: on every Studio exit, `getFlattenedCanvas()` (`stage.toDataURL()`, base64 PNG) is passed to `saveCurrentToWorkbench`, which (a) writes it into the Y.Doc as `project.thumbnail` in collab mode and (b) REST-PATCHes it to `projects.thumbnail_url` in all modes. New helper `uploadCanvasThumbnail(dataUrl): Promise<string | null>`: data URL → blob → existing `uploadBlobToAsset` pipeline → S3 ref (with thumb/preview variants). Both exit call sites await it and pass the ref; `saveCurrentToWorkbench` receives a ref, never a data URL. **S3-down degradation**: canvas content still syncs to the doc; the thumbnail update is skipped (previous thumbnail kept) with a console warning — a missing thumbnail must never block or lose an edit.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - After a Studio edit + exit: Y.Doc and `projects.thumbnail_url` contain only refs; zero `data:` strings (CDP/DB check)
  - S3-down exit: node content synced, old thumbnail retained, no data URL written anywhere
- **Validation**: red-green for the dataURL→blob conversion + skip-on-failure logic; behavior test at both call sites; manual: edit in Studio with a second browser watching — card thumbnail updates on exit

### Task 1.6: Render-output path honors the refs-only contract
- **Location**: `src/services/ai/targets/openAIImageTarget.ts` (`materializeNativeImageOutputs`), `src/services/renderTaskService.ts` / runners (error surfacing)
- **Description**: The render pipeline re-hosts provider images via the same `uploadBlobToAsset` (Sprint 1 changes apply automatically), but two gaps remain: (a) provider-returned **data URLs are passed through untouched** (`if (!/^https?:\/\//.test(output.url)) return output;`) — route them through the same materialization (data URL → blob → upload) so no base64 ever lands in `renderResults.images[]` / lab state; (b) with Task 1.3's hard-fail, a re-host failure now rejects the whole task even though generation succeeded — surface this as a distinct, actionable error ("image generated but asset storage unavailable") and keep it recoverable via the existing seed-locked re-run (SC-008). Mock target (picsum remote URLs) is untouched — external refs, never persisted bytes.
- **Dependencies**: Task 1.3
- **Acceptance Criteria**:
  - Provider data-URL output → stored as S3 ref (test with stubbed fetcher returning a data URL)
  - S3-down re-host → task fails with the storage-specific error; no `data:` string in outputs
- **Validation**: red-green against the existing target test harness; note generation-lab's in-memory `renderReferences[].dataUrl` is transient (request payload only, never persisted) and stays out of scope

### Task 1.4: Full purge of server-side data-URL safety nets
- **Location**: `src/lib/services/thumbnail.ts` (+ tests), `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/previews/route.ts` (+ tests)
- **Description**: Remove `DATA_URL_DOWNSAMPLE_THRESHOLD`, `downsampleDataUrlThumbnail`, `downsampleDataUrls` and all their call sites (project list, single-project GET+PATCH, batch previews). With uploads wiped (Sprint 2) and the fallback gone, no data-URL source remains — the contract is refs only.
- **Dependencies**: Task 1.3 (run after the fallback is gone so no writer exists first)
- **Acceptance Criteria**:
  - Zero references to `downsample*` / `data:` handling in `src/` (grep-verifiable)
  - All existing route tests still pass after removing the downsample-related cases
- **Validation**: tsc + full suite; grep audit recorded in commit message

---

## Sprint 2: Wipe heavy test data + collab transfer fixes

**Goal**: The environment contains only ref-based scenes; joining a scene streams a small doc; cold open no longer downloads the full scene twice, serially.
**Demo/Validation**:
- DB: zero `data:image`/`data:video` strings in any scene `data` or `projects.thumbnail_url`; heavy projects gone
- CDP capture of a collab join on a fresh multi-node scene: WS sync payload ≈ doc size (KB); REST GET on the critical path is the `?lite=1` variant and overlaps the WS join in time
- `pnpm test` green, tsc clean

### Task 2.1: Wipe heavy base64 test projects
- **Location**: one-off SQL / small script (not a committed migration utility) — document exact statements in `docs/performance/baseline.md`
- **Description**: First `pg_dump` the DB to `/tmp/openviz-pre-wipe.dump`. Identify projects whose scenes contain data URLs (`SELECT ... WHERE data::text LIKE '%data:image%' OR ...`) and delete those project rows (cascades to scenes incl. `ydoc`). Verify zero data-URL strings remain in `scenes.data` and `projects.thumbnail_url`.
- **Dependencies**: Sprint 1 (new pipeline is the only way to create scenes afterward)
- **Acceptance Criteria**:
  - Dump file exists before any deletion
  - Post-wipe audit query returns 0 rows for data-URL patterns across `scenes` + `projects`
  - Remaining projects open and render correctly in the app
- **Validation**: audit SQL output recorded; manual open of a surviving project

### Task 2.2: Server fetch column pruning
- **Location**: `server/collab/persistence.ts` (`createDbPersistence.getScene`), `server/collab/persistence.test.ts`
- **Description**: When a stored `ydoc` exists, select only `id, name, ydoc` (skip the `data` column); full row only on the seed path (`ydoc IS NULL`).
- **Dependencies**: none (parallel with 2.1)
- **Acceptance Criteria**: ydoc-present path issues a query that does not read `data`; behavior identical otherwise
- **Validation**: red-green against the existing fake-deps pattern in persistence.test.ts; manual room-creation check

### Task 2.3: Lite readiness + parallel collab join
- **Location**: `src/app/projects/[id]/ProjectWorkspace.tsx`, `src/hooks/useCurrentProject.ts` (or new `useProjectReadiness`), `src/app/api/projects/[id]/route.ts` (verify `?lite=1` still returns `sceneVersion` + name)
- **Description**: The readiness query fetches `?lite=1` (KB-sized; scene stripped). `isProjectReady` flips on the lite response, so Workbench mounts and the collab join starts immediately. **Fallback path**: if the collab session ends `denied`/`failed` *and* nothing was painted from cache, fetch the full (non-lite) scene once and hydrate the single-user path as today. Track `scenePayloadKind: 'lite' | 'full'` so hydration never runs on a lite payload. SWR (`paintedFromCache`) behavior unchanged.
- **Dependencies**: none (parallel with 2.1/2.2); combined measurement after all three land
- **Acceptance Criteria** (behavior matrix — table-driven tests):
  - collab up + cache hit → paints from cache, lite fetch only, full scene never fetched
  - collab up + no cache → lite fetch → join syncs doc → ready; full scene never fetched
  - collab down + cache hit → paints from cache (single-user), no full fetch
  - collab down + no cache → lite fetch → fallback full fetch → hydrate → ready
- **Validation**: red-green for pure `resolveSceneHydration({ payloadKind, collabStatus, paintedFromCache })`; component behavior tests for the matrix; CDP trace showing REST-lite and WS-join overlapping

### Task 2.4: Measure & record
- **Location**: `docs/performance/baseline.md` (new "Collab streaming" section)
- **Description**: Record before/after: scene ydoc/data sizes, join payload size, cold-open critical path (small + multi-node scenes), REST bytes on open. Note the harness uses fresh profiles (cold); SWR verified separately as in Sprint 2 of the previous plan.
- **Dependencies**: Tasks 2.1–2.3
- **Acceptance Criteria**: section exists with measured numbers and capture method
- **Validation**: review

---

## Sprint 3: Lazy & progressive rendering

**Goal**: The browser only downloads/decodes what the current view needs: thumbnails while working, previews in the background, full-res on demand, video bytes only in fullscreen.
**Demo/Validation** (network waterfall via CDP or DevTools):
- Open workbench → image nodes paint from in-doc thumbnails; **zero** full-res requests; ≤1024 previews start after first interactive frame (idle) and swap in without layout shift
- Switch to Studio → layer image requests fire only now (not at project open); hidden layers fetch nothing until shown
- Zoom an image node past 200% → full-res request fires; below 200% it never does
- Video node: **0** video bytes until fullscreen opens; poster shows immediately
- `pnpm test` green, tsc clean, coverage floor holds

### Task 3.1: Gate Studio layer image loading on view visibility
- **Location**: `src/components/studio/CanvasViewport.tsx` (`URLImage`, ~line 21), `src/components/Studio.tsx` (thread the existing `active` prop down)
- **Description**: `URLImage` currently calls `useImage(src)` unconditionally — Studio is dual-mounted, so every layer image loads at project open even while Workbench is visible. Gate: images load only after the Studio view has been visible at least once (one-way latch per session — no re-fetch flicker on back-and-forth switches), and skip `src` for `layer.visible === false` layers until they become visible. Keep Konva structure identical (empty placeholder as today) so Transformer/selection logic is unaffected.
- **Dependencies**: none
- **Acceptance Criteria**:
  - Studio hidden at mount → no layer image requests (mocked useImage/fetch)
  - After first visibility: all visible layers load; a hidden layer loads when unhidden
  - Hiding Studio again does not unmount/re-fetch loaded images
- **Validation**: component behavior tests; manual waterfall check

### Task 3.2: Progressive tiered image cards in Workbench
- **Location**: new `src/services/workbench/nodeImageTiers.ts` (pure logic) + `src/components/workbench/hooks/useNodeImageTier.ts`, `src/components/nodes/ImageNode.tsx`
- **Description**: Pure selector `pickTier({ zoom, tiers: { thumb, preview?, full } })`: `zoom > 2.0 → full`; else `preview ?? thumb`. Hook per image node: subscribes to React Flow viewport zoom (`projection.viewport.zoom` in WorkbenchContent), renders the current tier's `<img>` (object-cover, fixed node size → no layout shift); once the workbench is interactive (requestIdleCallback after first paint) it kicks off a low-priority background fetch of the preview tier (`new Image()` / `img.decode()`) and swaps src on success. Full-res fetches only when zoom crosses 2.0, with the preview kept as placeholder until it lands. Browser HTTP cache (immutable headers) makes re-visits free — no custom cache layer.
- **Dependencies**: Task 1.2 (`previewUrl` on nodes)
- **Acceptance Criteria**:
  - Initial paint uses only the in-doc thumbnail (no extra requests before idle)
  - Preview loads after idle and swaps in when zoom warrants; no flicker/layout shift
  - Full-res requested only above 2.0 zoom; never below
  - A node without `previewUrl` (e.g., pre-Sprint-1 render output nodes) degrades to thumb/full without errors
- **Validation**: red-green for `pickTier` (table-driven, boundaries incl. exactly 2.0); hook test with mocked viewport store + fake images; manual waterfall

### Task 3.3: Video nodes — poster inline, video only in fullscreen
- **Location**: `src/components/nodes/VideoNode.tsx`
- **Description**: Replace the inline `<video src={full} loop muted>` preview with `<img src={posterUrl}>` + play-button overlay (placeholder tile when `posterUrl` is null). Clicking opens the existing fullscreen modal — the only place a `<video>` element exists. Remove now-dead inline playback state (`isPlaying`, `handleVideoEnded`).
- **Dependencies**: Task 1.2 (poster at upload)
- **Acceptance Criteria**:
  - No `<video>` element (and no video bytes) while the node is in the workbench
  - Fullscreen shows playing video; closing unmounts it
  - Poster-less node renders placeholder + still opens fullscreen
- **Validation**: component behavior tests (no `video` tag pre-fullscreen; present after open); manual network check

### Task 3.4: Measure & record
- **Location**: `docs/performance/baseline.md` (extend Collab section with "Lazy loading" subsection)
- **Description**: Waterfall evidence per acceptance item: request counts/bytes at workbench-open, on studio switch, on zoom cross, on video fullscreen; heap delta if notable.
- **Dependencies**: Tasks 3.1–3.3
- **Acceptance Criteria**: measured numbers recorded with capture method
- **Validation**: review

---

## Testing Strategy
- **Unit (red-green)**: `pickTier`, variant key derivation, seek-time/size-clamp logic, `resolveSceneHydration` matrix
- **Component behavior**: ImageNode tier swapping, VideoNode no-video-until-fullscreen, CanvasViewport visibility gating, upload call-site toasts — from the acceptance criteria above
- **E2E/manual vs local stack**: MinIO + Postgres + collab server; CDP waterfall captures (extend `/tmp/verify-*` patterns into a committed `scripts/verify-collab-streaming.mjs` if useful)
- **Gates per sprint**: `pnpm test` full suite, `tsc` clean, coverage ≥ 72.6% statements (floor 46%), conventional commit per sprint

## Potential Risks & Gotchas
1. **Wipe is destructive to test scenes** — mitigated by the mandatory `pg_dump` before Task 2.1; surviving projects verified in-app afterward. The wiped scenes are regenerable mock data, not user content.
2. **Lite-readiness restructure touches the SWR/single-user interplay** — riskiest task in the plan. Mitigation: pure decision function + 4-case behavior matrix before wiring; existing SWR tests must stay green untouched.
3. **Tier-swap flicker**: naive src swap can flash. Mitigation: preload via `img.decode()`, swap only when decoded; fixed node size + object-cover prevents layout shift.
4. **Poster capture codec failures** (HEVC/Safari): `captureVideoPoster` returns null → placeholder tile; upload never fails because of posters.
5. **Konva gating side effects**: Transformer/selection assume layer structure, not loaded images — gating only the `src` keeps structure stable; verify manually with selection + resize on a freshly-opened studio.
6. **Coverage floor pressure**: canvas/video code is largely untestable in jsdom — keep it thin, test the pure decision logic (same pattern as Sprints 3–4 of the previous plan).
7. **Full purge order matters**: remove the upload fallback (1.3) and the Studio-exit thumbnail writer (1.5) *before* removing read-path safety nets (1.4), so no persisted data-URL writer can exist while readers still handle them; all land in Sprint 1, before the wipe.
8. **Storage cost of the 1024 tier**: ~2× WebP bytes per image in MinIO — negligible at this scale; noted for awareness.
9. **Freehand strokes** (`Layer.strokes`) still ride in the doc (vector points, measured ~0MB here) — out of scope; revisit only if a heavy-sketch scene shows up.
10. **Render re-host failure loses a paid generation**: Task 1.6 makes it fail loudly with a storage-specific error; recovery is the seed-locked re-run (SC-008). Alternative considered: keep the provider's (possibly expiring) URL as a fallback ref — rejected to keep the refs-only contract uniform (all refs are durable S3 objects).
11. **Studio editing lock is implicit, not explicit**: `openNodeInStudio` sets `activeNodeId` but not `selectedNodeIds`, and the presence publisher locks on `selectedNodeIds ∪ gesture ids`. The lock works today only because opening a node in Studio requires selecting it first (and selection can't be cleared while the workbench is hidden). If Sprint 3's two-client manual test shows no lock badge during studio editing, harden by including `activeNodeId` in the published lock set when `viewMode === STUDIO` (one-line change in `useCollabPresencePublisher`).

## Rollback Plan
- Per-sprint git revert (conventional commits).
- Sprint 1 is a contract change: reverting restores base64 fallback + safety nets; code and data stay mutually compatible in either direction (old code renders any `src` string; new code only writes refs).
- Data wipe: restore from `/tmp/openviz-pre-wipe.dump` if needed; otherwise the wiped scenes are simply gone (regenerable test data).
- Sprint 3 rendering changes are view-layer only; revert restores eager loading with no data impact.
