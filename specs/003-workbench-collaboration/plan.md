# Implementation Plan: Real-Time Workbench Collaboration

**Branch**: `003-workbench-collaboration` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-workbench-collaboration/spec.md`, plus the go-decision handoff from `.specify/assessments/react-flow-yjs-collaboration/decision.md` (Option C, phased: M1 online collaboration + presence, M2 offline queue + merge).

**Planning input from user**: "consider dismissing current database backend if something else fits better for this collaboration mode" — evaluated in [research.md](./research.md) Decision 1. **Verdict: keep Postgres/Drizzle; no backend dismissal is justified at target scale.**

## Summary

Enable 2–5 project members to co-edit a project's main workbench scene concurrently with guaranteed convergence (no lost edits), live presence/cursors, membership-only access, and full offline editing that merges on reconnect. Technical approach: a CRDT shared-document layer (Yjs) per project scene, synced through a self-hosted Hocuspocus WebSocket server running as a standalone tsx process; persistence stays on Postgres via Drizzle (existing `scenes` table plus an optional encoded-document column); client-side offline queuing via IndexedDB; local-only undo by tagging spec-002 gesture transactions with per-user origins.

## Technical Context

**Language/Version**: TypeScript (strict, ESM) — React 19 / Next.js 16 app runtime for the client; Node.js + `tsx` for the standalone collaboration server process.

**Primary Dependencies**: Existing — `@xyflow/react` 12, Zustand, TanStack Query, Drizzle ORM + Postgres, NextAuth v5 (beta), Tailwind, Framer Motion, Radix. New — `yjs`, `y-indexeddb`, `@hocuspocus/server` (+ database extension), `@hocuspocus/provider`; test-only: `fake-indexeddb`.

**Storage**: Postgres via Drizzle (kept — see research Decision 1). Existing `scenes` table (`data` jsonb, `version`, `updatedBy`) plus one generated migration adding an optional `ydoc` bytea column. Client-side IndexedDB (via `y-indexeddb`) holds the offline edit queue; it is browser-local state, not a new backend.

**Testing**: Vitest + React Testing Library (existing setup). Convergence/offline/undo logic tested with real in-memory Yjs documents synced over a fake provider bus (no network); `fake-indexeddb` for offline-queue tests; Hocuspocus auth/persistence hooks tested against the Drizzle schema.

**Target Platform**: Web — modern browsers with WebSocket + IndexedDB; Node.js server process for the collab endpoint.

**Project Type**: Web application (existing Next.js app) + one standalone realtime server module (`server/collab/`).

**Performance Goals**: 2–5 concurrent editors per room, scenes under ~100 nodes (documents in the tens-of-KB range). Edits visible to all sessions without reload; presence entry visible within 2 seconds of join (SC-003); cursor updates throttled to animation frames (~16 ms while moving). No strict latency SLA (assessment: best-effort at target scale).

**Constraints**: Constitution gates — no `any`/`@ts-ignore`, TDD per layer, zustand/react-query/hook boundaries, Tailwind-only styling, files ≤300 lines, named exports, absolute imports, generated Drizzle migrations only, "no second bundler entry point" (sidecar justified in Complexity Tracking).

**Scale/Scope**: One room per project main scene; 2–5 users per room; <100 nodes; single-instance server deployment (multi-instance Yjs fan-out is out of scope).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Type Safety (no `any`, tsc clean) | PASS (by design) | Yjs and Hocuspocus ship full TypeScript types; all new modules typed at the boundary (`src/types/collab.types.ts`). Any untyped escape hatch fails review. |
| II | Test-First, Layered | PASS (by design) | Every logic-layer artifact (services, hooks, store slice changes, server modules) is test-first per tasks layering; component behavior tests derive from spec acceptance criteria before implementation; coverage floor never regresses. |
| III | State Architecture | PASS (by design) | Collab session/presence state extends the existing `workbenchCollaborationSlice`; provider lifecycle and token fetch live in `useCollabSession.ts` (hook); no `fetch`/`useEffect` in view components; server-state reads remain TanStack Query. |
| IV | Styling & UI Primitives | PASS (by design) | Presence indicators, cursor overlay, and status chip are Tailwind + Framer Motion; no new primitive dependencies beyond existing Radix usage. |
| V | Module Boundaries & File Limits | PASS (by design) | New files split by concern (≤300 lines), named exports, absolute imports; folder mapping respected: types → `src/types/`, API/business logic → `src/services/collab/` + API route, state → `src/store/slices/`, UI → `src/components/workbench/`. |
| — | Tech stack: Postgres via Drizzle, generated migrations | PASS | Backend kept (research Decision 1); the single schema change (`scenes.ydoc`) ships as a generated migration. |
| — | Tech stack: "do not introduce a second bundler entry point" | **VIOLATION — justified** | The Hocuspocus server is a standalone `tsx`-run process (`server/collab/`). See Complexity Tracking. |
| — | Quality gates (lint/tsc/vitest green, coverage floor) | PASS (enforced) | Gates run before merge as in prior features; multi-client convergence tests are part of the suite. |

**Post-Phase-1 re-check**: still passing. Phase 1 design added no new principles violations: data model adds one nullable column (generated migration), contracts add one API route and one WS endpoint (both typed), and the offline queue is browser-local IndexedDB (not a second backend). The single justified complexity entry (sidecar process) is unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-workbench-collaboration/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── collab-transport.md      # WS endpoint, room identity, auth handshake, sync/awareness semantics
│   ├── room-token-api.md        # POST /api/projects/:id/scenes/collab-token
│   ├── scene-persistence-collab.md  # Server save semantics, lazy import, autosave interplay
│   └── presence-awareness.md    # Presence/cursor payload shape and lifecycle
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
└── collab/                          # NEW: standalone Hocuspocus process (tsx runtime, not bundled)
    ├── index.ts                     # Bootstrap: port/env, extensions, lifecycle
    ├── auth.ts                      # onAuthenticate: room-token verification + membership re-check
    └── persistence.ts               # onLoadDocument / onSaveDocument → Drizzle upsert + lazy import

src/
├── types/
│   └── collab.types.ts              # RoomToken, CollabSessionStatus, PresenceEntry, doc mapping types
├── services/
│   └── collab/
│       ├── roomTokenService.ts      # Signed short-lived token issue/verify (shared by route + server)
│       ├── sceneDocMapping.ts       # Scene JSON <-> shared-document structure (seed + extract)
│       └── collabProviderFactory.ts # Provider + y-indexeddb binding + awareness + local origin
├── store/
│   └── slices/workbenchCollaborationSlice.ts   # EXTEND: presence list, session status, local origin
├── components/
│   └── workbench/
│       ├── hooks/useCollabSession.ts          # Provider lifecycle: connect/disconnect/reconnect, doc -> store
│       ├── PresenceIndicator.tsx              # Who's-in-scene chip (replaces SSE-derived presence)
│       ├── CursorOverlay.tsx                  # Remote cursor indicators on the canvas
│       └── CollabStatusChip.tsx               # Connected / offline-queued status
├── app/
│   └── api/projects/[id]/scenes/
│       └── collab-token/route.ts    # POST: issue room token (NextAuth + membership check)

drizzle/
└── 000N_add_scenes_ydoc.sql         # GENERATED migration: scenes.ydoc bytea NULL
```

**Structure Decision**: Single web application with one new standalone server module. The client stays entirely inside the existing Next.js app (workbench component tree, store slices, hooks, services) per the constitution's folder mapping; only the WebSocket-capable Hocuspocus process lives outside `src/`, because App Router cannot handle WS upgrades (research Decision 2). No new top-level app entry points are added to the bundler/build pipeline.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Standalone `tsx` server process at `server/collab/` (adjacent to "do not introduce a second bundler entry point") | Yjs requires bidirectional WebSocket connections. Next.js App Router route handlers cannot accept WS upgrades and do not expose the HTTP server's upgrade events; a collab endpoint must therefore run as its own listener/process. The process is executed directly with `tsx` (no separate bundle, no second build pipeline) and reuses the same Drizzle schema module and env config as the app. | Embedding via Next.js `instrumentation.ts`: still requires a second raw WS listener inside the app process, is fragile under dev HMR and multi-instance deploys (each instance would hold divergent in-memory document state), and is non-idiomatic. Hosted Yjs platforms: rejected by the assessment (self-hosted requirement, data egress). Rolling our own WS server on a custom Next server: reintroduces exactly the "second entry point" the constraint targets. |
