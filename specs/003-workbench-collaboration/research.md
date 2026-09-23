# Phase 0 Research: Real-Time Workbench Collaboration

## Decision 1: Keep Postgres + Drizzle as the durable backend — do NOT dismiss it (answers planning input)

- **Decision**: The current database backend (Postgres via Drizzle ORM, existing `scenes` table) remains the durable source of truth for scenes under collaboration. No alternative storage engine is adopted. One additive schema change: an optional `ydoc` bytea column on `scenes` (see Decision 5), shipped as a generated Drizzle migration.
- **Rationale**: At the assessed scale (2–5 concurrent editors, <100 nodes, documents in the tens-of-KB range, low update rates — a few small writes per minute even during active dragging), Postgres is not a bottleneck; the collaboration load is trivial for it. The collaboration *transport* (WebSocket/CRDT) is orthogonal to storage: Hocuspocus persists through database callbacks that upsert the existing `scenes` row, so all app data (projects, workspaces, auth, files) stays in one engine with one query path and one backup story. The constitution additionally mandates "Database: Postgres via Drizzle ORM; schema changes require generated migrations" — dismissing the backend would be a constitution amendment, not a plan choice, and nothing in the collaboration requirements justifies that cost. Requester clarification #6 already fixed "keep the existing saved scene state as durable source of truth."
- **Alternatives considered**:
  - *Yjs-native document store (CRDT binary as primary format, y-postgres style)*: still Postgres underneath; a full switch of primary format to binary docs would break the human-readable/inspectable JSON contract that tools and the existing PATCH endpoint rely on. We take the lighter version — an optional `ydoc` column *alongside* `data` jsonb (Decision 5) — which gets lossless CRDT re-seeding without changing the source of truth.
  - *ElectricSQL (Postgres-based row-level sync engine)*: built to sync relational rows to clients, not CRDT document collaboration; would add a second sync service and paradigm alongside Hocuspocus for no benefit at this scale.
  - *Redis as scene store*: Redis is already in the stack (BullMQ) but serves queues/caching here; moving scenes into it loses transactional consistency with app data, Drizzle integration, and queryability — a regression, not an improvement, for <100-node documents.
  - *Hosted Yjs services (Liveblocks/PartyKit)*: external dependency, per-seat cost, data egress off-infrastructure; rejected by requester clarification #5 (self-hosted).
  - *Pglite (in-process WASM Postgres)*: a development convenience, not a production backend; rejected.
- **Sources**: `src/lib/db/schema.ts:71-84` (scenes table incl. version/updatedBy); `.specify/memory/constitution.md` (Technology Stack Constraints); `.specify/assessments/react-flow-yjs-collaboration/clarifications.md` (#5, #6); Hocuspocus persistence extension docs (https://github.com/dokobot/hocuspocus).

## Decision 2: Run Hocuspocus as a standalone tsx process (`server/collab/`), not embedded in Next.js

- **Decision**: The collaboration server is a standalone Node process executed with `tsx` from `server/collab/index.ts` (dev script + service in prod), reusing the app's Drizzle schema module and env configuration. It listens on its own port for WebSocket connections.
- **Rationale**: Yjs requires bidirectional WebSocket transport. Next.js App Router route handlers cannot accept WS upgrades, and Next does not expose its HTTP server's upgrade events; any collab endpoint must therefore own a listener. A standalone process is Hocuspocus's standard deployment: clean lifecycle (start/stop/restart independent of app deploys), trivially testable in isolation, and it fits the existing docker-compose topology (`app + postgres + redis` → add `collab`). It imports `src/lib/db/schema.ts` directly (plain TS, no Next-specific code) so persistence uses the same Drizzle model as the app.
- **Alternatives considered**:
  - *Embed via `instrumentation.ts` inside the Next.js node runtime*: still requires a second raw WS listener in-process; fragile under dev HMR (double-start guards needed) and wrong for multi-instance deploys (each instance would hold divergent in-memory document state without a shared-state extension); non-idiomatic.
  - *Hosted Yjs platform*: rejected by clarification #5.
  - *Custom WebSocket server replacing Hocuspocus*: re-implements auth/awareness/persistence/lifecycle that Hocuspocus provides; no benefit at this scale.
- **Constitution note**: This is the single justified complexity entry in plan.md (adjacent to "do not introduce a second bundler entry point" — it is a `tsx` runtime process, not a bundler/build entry).
- **Sources**: Next.js App Router route handler constraints (https://nextjs.org/docs/app); Hocuspocus server docs (https://github.com/dokobot/hocuspocus); `docker-compose.yml` services; `package.json` scripts.

## Decision 3: Room identity = project main scene; auth via short-lived signed room tokens issued by an API route

- **Decision**: One collaboration room per project main scene, named by scene ID (matches the existing per-project scene identity and the spec's "one session maps to one project's main workbench scene"). The client obtains a short-lived signed token from `POST /api/projects/:id/scenes/collab-token` (NextAuth session + workspace-membership check, reusing the existing `canAccessProject` pattern) and presents it when opening the WebSocket. The Hocuspocus `onAuthenticate` hook verifies the signature/scope/expiry and re-checks project membership in the database before admitting the connection.
- **Rationale**: FR-009 requires collaboration to stay strictly inside the existing access model with no new access paths. NextAuth v5 session cookies are not a stable cross-process contract for a separate server; a purpose-scoped, ~5-minute token keeps the collab server's trust surface minimal (one HMAC/JWT secret + one DB membership query) while identity still originates in NextAuth. Defense-in-depth: even a leaked token expires quickly and is useless without membership.
- **Alternatives considered**:
  - *Pass the NextAuth session JWT directly over WS*: couples the collab server to full session verification and hands it long-lived credentials — larger blast radius if the server is compromised; no per-room scoping.
  - *Read session cookies at WS upgrade in the sidecar*: depends on NextAuth v5-beta cookie internals across processes; fragile and non-idiomatic.
  - *No auth (dev-only)*: rejected — FR-006/SC-006 make access control a first-release requirement.
- **Sources**: `src/app/api/projects/[id]/scenes/stream/route.ts:10-29` (`canAccessProject` pattern); `src/lib/auth.ts`; spec FR-009, US4; Hocuspocus authentication extension docs.

## Decision 4: Client offline support via y-indexeddb; reconnect performs full CRDT sync (M2)

- **Decision**: The client binds the shared document to a per-scene IndexedDB store (`y-indexeddb`) so edits persist across disconnects *and* browser close. On reconnect, the provider performs standard state-vector synchronization: both sides exchange missing updates and converge. No server-side update log is needed — the server merges incoming updates into its in-memory document and persists snapshots (Decision 5).
- **Rationale**: Clarification #8 requires full offline + merge including edits made before the app was closed (SC-004). y-indexeddb is the standard Yjs client-persistence pairing; CRDT semantics make the merge correct by construction (no custom conflict logic). At <100 nodes the stored document stays small, so IndexedDB quota is a non-issue.
- **Alternatives considered**:
  - *Manual operation queue replayed on reconnect*: re-implements CRDT merging badly and breaks under concurrent remote edits; rejected.
  - *Server-side Yjs update log table*: would enable catch-up after server restarts, but the `ydoc` snapshot column (Decision 5) already makes server restarts lossless at this scale; an append-only log adds schema, retention policy, and query cost for no user-visible benefit now.
  - *No offline in v1 (online-first only)*: rejected — explicitly overridden by requester clarification #8; remains the fallback milestone split if M2 testing proves too heavy (assessment Option C phasing).
- **Sources**: Yjs docs on persistence/offline (https://github.com/yjs/yjs); `y-indexeddb` (https://github.com/dmonad/y-indexeddb); spec US3, FR-006/FR-007, SC-004.

## Decision 5: Persistence = existing scene JSON snapshot + optional `ydoc` binary column; lazy import on first collaborative open

- **Decision**: While a room is active, the Hocuspocus server is the single writer for that scene: debounced saves (~2 s after last change) and an immediate save on room close upsert `scenes.data` (JSON extracted from the document), bump `version`, set `updatedBy` (last editor known in the room), and store the encoded Yjs document in `scenes.ydoc`. On load: if `ydoc` exists, decode it (lossless — preserves CRDT metadata); otherwise seed the document from `data` JSON. That seeding path *is* the lazy import required by spec US5; no bulk migration exists or is needed.
- **Rationale**: FR-011 requires durable state to match the converged state; a single-writer server avoids double-write races with the client autosave path (Decision 9). Storing both formats keeps JSON the human-readable source of truth (clarification #6) while making server restarts and re-seeds lossless. The column is nullable, so existing rows are untouched until first collaborative save — migration is additive and generated per constitution.
- **Alternatives considered**:
  - *JSON only (no ydoc column)*: acceptable at this scale but discards CRDT vector-clock metadata on every restart; reconnecting clients would re-sync full state and offline clients with older base states would merge more slowly. Cheap to add, so included.
  - *Yjs binary as sole storage format*: violates clarification #6 (scene JSON remains the durable source of truth) and breaks tooling that inspects `scenes.data`.
- **Sources**: `src/lib/db/schema.ts:71-84`; `src/app/api/projects/[id]/scenes/route.ts` (PATCH/version semantics); spec FR-010/FR-011, US5; Hocuspocus database extension docs.

## Decision 6: Undo = spec-002 gesture transactions tagged with per-user Yjs origins + per-client UndoManager with trackedOrigins

- **Decision**: Each completed local gesture (the atomic unit defined by feature 002) is applied to the shared document as a single Yjs transaction tagged with that user's origin. Every client runs a `Y.UndoManager` configured with `trackedOrigins: [ownOrigin]`, so Undo/Redo covers exactly the user's own completed gestures and never touches remote changes (FR-008).
- **Rationale**: Resolves carried-forward question 2 without a second history system: spec 002's "one drag = one undo" UX is preserved because one gesture = one tracked transaction, and CRDT-safe multi-user semantics fall out of origin tracking for free. A new local edit after Undo truncates the redo path per existing history expectations (spec edge case), matching Yjs UndoManager behavior.
- **Alternatives considered**:
  - *Keep spec-002's snapshot stack and reconcile with remote changes*: two sources of truth for history; reconciliation under concurrent remote edits is exactly the bug class this feature eliminates; rejected.
  - *Shared/global undo stack*: rejected by clarification #7 (confusing in multi-user editing).
  - *Per-property origins instead of per-gesture*: would fragment one drag into many undo steps, breaking 002's accepted UX; rejected.
- **Sources**: Yjs UndoManager/origin docs (https://github.com/yjs/yjs); `specs/002-atomic-node-undo/spec.md` (FR-001…FR-008); spec FR-008, SC-005.

## Decision 7: Presence and cursors via Yjs awareness, throttled to animation frames

- **Decision**: Presence (who is in the scene) and cursor positions ride on the Yjs awareness protocol that Hocuspocus relays natively. Each client publishes `{ user: { id, name }, cursor: { x, y } | null }`, updated at most once per animation frame while the pointer moves (≈16 ms), with `cursor: null` when idle. The presence list is derived from current awareness states; entries disappear automatically on disconnect/provider destroy (satisfies FR-005).
- **Rationale**: Resolves carried-forward question 3: at 2–5 users, rAF-throttled cursor payloads are well under ~1 KB/s per user — negligible against the existing transport budget, and no separate presence channel or polling is needed. Reuses the workbench's existing pointer-tracking hook as the input source.
- **Alternatives considered**:
  - *Separate SSE presence channel*: duplicates a transport we are adding alongside; two sources of truth for "who is here"; rejected (the existing SSE stream stays only for backward compatibility, Decision 8).
  - *Unthrottled pointer events*: bursts during fast drags would multiply payload size for no visual benefit; rAF throttling is the standard cursor pattern.
- **Sources**: Yjs awareness protocol (`y-protocols/awareness`); Hocuspocus awareness docs; `src/components/workbench/hooks/useWorkbenchPointerTracking.ts`; spec US2, FR-003…FR-005, SC-003.

## Decision 8: The existing SSE stream endpoint stays unchanged for compatibility; the workbench switches to the collab session

- **Decision**: `GET /api/projects/[id]/scenes/stream` and its client hook remain available but are no longer extended. The workbench's presence/lock/status UI migrates from SSE-derived state to awareness/collab-session state (new `PresenceIndicator`, `CursorOverlay`, `CollabStatusChip`). Single-user sessions (no room joined) keep today's behavior.
- **Rationale**: Avoids running two live-update paths for the same data in the workbench (double sources of truth, divergent presence). Keeping the endpoint untouched bounds rollout risk and leaves a fallback; it can be retired in a later cleanup feature once no consumers remain.
- **Alternatives considered**:
  - *Extend SSE to carry Yjs updates*: SSE is one-directional; Yjs needs bidirectional sync — impossible without adding WS anyway, at which point Hocuspocus supersedes the hand-rolled stream.
  - *Delete the SSE endpoint now*: breaks any non-workbench consumers during rollout; premature.
- **Sources**: `src/app/api/projects/[id]/scenes/stream/route.ts`; `src/components/workbench/hooks/useSceneStream.ts`; the shipped collaboration scope documented in this feature specification.

## Decision 9: While a collab room is active, the server is the single scene writer; client autosave PATCH is suppressed for that scene

- **Decision**: When the workbench has an active collab session, the existing `useAutoSaveScene` JSON-PATCH autosave path is suspended for that scene (the Hocuspocus persistence callbacks own writes, Decision 5). When no room is active (single-user use), the existing autosave/versioned-PATCH path is unchanged. The optimistic-concurrency (`expectedVersion`/409) machinery stays intact for the single-user path and for any non-collab writers.
- **Rationale**: Two writers to one scene row (client PATCH + server snapshot) would race on `version` and produce 409 storms or lost-snapshot windows exactly when collaboration is most active. Single-writer-per-mode keeps FR-011's consistency guarantee simple to reason about and test.
- **Alternatives considered**:
  - *Client autosave continues, server snapshots merge around it*: requires cross-process version coordination between the PATCH route and the collab server (shared lock or dual CAS) — significant complexity for a write path that is redundant while a room is live.
  - *Route all writes through the collab server always (even single-user)*: forces every single-user edit through WS + server round-trip and changes offline behavior for non-collaborative users; larger behavioral change than the spec requires (FR-012 demands unchanged single-user behavior).
- **Sources**: `src/hooks/useAutoSaveScene.ts`; `src/app/api/projects/[id]/scenes/route.ts` (409 semantics); spec FR-011/FR-012.

## Resolved Technical Unknowns

- **Language/version**: TypeScript strict, ESM; React 19 / Next.js 16 client; Node.js + tsx server process.
- **Transport**: WebSocket via self-hosted Hocuspocus (standalone process); Yjs document sync + awareness over the same connection.
- **State boundary**: `workbenchCollaborationSlice` (zustand) holds session status, presence list, and local origin; `useCollabSession.ts` owns provider lifecycle and doc→store projection; React Flow controlled-update path (feature 002 hardening) consumes projected nodes/edges.
- **Persistence**: Postgres `scenes` row (JSON + optional `ydoc`), single-writer server while a room is active; client autosave suppressed per Decision 9; lazy import per Decision 5.
- **Offline**: y-indexeddb per-scene store; CRDT merge on reconnect; no server-side update log.
- **Undo**: per-user origins + `Y.UndoManager` trackedOrigins (Decision 6).
- **Testing**: Vitest with in-memory Yjs document pairs/farms over a fake provider bus for convergence, offline (fake-indexeddb), and undo-origin tests; Hocuspocus auth/persistence hook tests against the Drizzle schema; RTL behavior tests for presence/cursor/status components from spec acceptance criteria.
- **Performance**: rAF-throttled awareness; debounced server saves; no numeric latency SLA beyond SC-003's 2-second presence visibility at target scale.

## Scope alignment with the specification

- In scope per spec: concurrent editing with convergence (US1), presence/cursors (US2), offline + merge (US3, M2), membership-only access (US4), lazy adoption of existing scenes (US5).
- Out of scope per spec (non-goals honored): shared viewport/selection/comments (FR-013), external-stakeholder access (FR-014), multi-scene rooms, >5 users / ≥100-node guarantees, strict latency SLA, bulk migration.
- Carried-forward assessment questions all resolved: deployment topology → Decision 2; spec-002 undo integration → Decision 6; cursor update rate → Decision 7. Planning input on the database backend → Decision 1 (keep Postgres).
