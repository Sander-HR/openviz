# Quickstart: Validate Real-Time Workbench Collaboration

## Prerequisites

- Repository dependencies installed (`pnpm install`) — includes the new collaboration dependencies (`yjs`, `y-indexeddb`, `@hocuspocus/server` + database extension, `@hocuspocus/provider`; test-only `fake-indexeddb`).
- Local Postgres available and migrations applied (`pnpm run db:migrate`) — includes the generated migration adding `scenes.ydoc`.
- An authenticated account with membership in a workspace containing a project with a main scene (use two browser profiles or one normal + one incognito window for dual sessions).
- Environment variables for the collab server configured (port, shared token secret, database URL) per `server/collab/` bootstrap.

## Start the stack

```bash
# 1. App (existing)
pnpm run dev

# 2. Collaboration server (new standalone process)
pnpm run dev:collab        # tsx server/collab/index.ts
```

(Docker alternative: the compose topology gains a `collab` service alongside `app`, `postgres`, `redis`.)

## Automated checks

Run the focused collaboration suites first (logic layers are test-first per constitution):

```bash
pnpm exec vitest run \
  src/services/collab/sceneDocMapping.test.ts \
  src/services/collab/roomTokenService.test.ts \
  src/services/collab/collabProviderFactory.test.ts \
  src/components/workbench/hooks/useCollabSession.test.ts \
  src/store/slices/workbenchCollaborationSlice.test.ts \
  server/collab/auth.test.ts \
  server/collab/persistence.test.ts
```

Then the full quality gates:

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm test -- --run
```

Expected outcomes (mapped to success criteria):

- Convergence suite: N in-memory documents over a fake provider bus, concurrent edits from all clients → every completed edit present in every final state, all states identical (SC-001, SC-002).
- Offline suite (fake-indexeddb): edits during simulated disconnect + peer edits while offline → full merge on reconnect, zero lost edits, including a close-and-reopen case (SC-004).
- Undo-origin suite: undoing local actions leaves all remote changes intact (SC-005).
- Auth suite: valid token admitted; expired/tampered/out-of-scope/membership-lost tokens rejected (SC-006).
- Mapping/persistence suites: lazy import preserves 100% of seeded nodes/connections (SC-007); saves write data + version + ydoc.

## Manual browser validation

### SC-001 / SC-002 — concurrent editing, no lost work

1. Open the same project's workbench in two sessions (A and B).
2. Overlap edits: A moves a node while B adds a node; then both edit different nodes simultaneously; finally both touch the same node (move vs resize).
3. Verify: every completed edit appears in both sessions without reload; after settling, both sessions show an identical scene.

### SC-003 / US2 — presence and cursors

1. With A in the scene, join B. Verify A sees B listed within ~2 seconds.
2. Move B's pointer across the canvas (including while panned/zoomed); verify A sees a labeled cursor tracking the same world position.
3. Close B; verify its presence entry and cursor disappear from A.

### SC-004 / US3 — offline editing and merge

1. In session B, open DevTools → Network → Offline (or kill the collab server) while connected.
2. Make several edits in B (verify they stay visible locally); make several edits in A.
3. Restore connectivity. Verify both sessions converge with all edits from both sides present; no conflict dialog, no lost work.
4. Repeat with a browser close: offline edits in B, close B's browser, reopen and reconnect — earlier offline edits must merge (SC-004 second clause).

### SC-006 / US4 — access control

1. As a non-member of the project's workspace, attempt to open the project scene or connect to the collab endpoint directly with a forged/absent token.
2. Verify: no view, no edit, WS authentication rejected; `POST .../collab-token` returns 403 for the non-member.

### SC-007 / US5 — existing scene adoption

1. Pick an existing project scene (pre-feature data). Open it in two sessions; verify all saved nodes/connections are present before any edit.
2. Edit collaboratively, reload both sessions; verify the current converged state loads (not a stale snapshot).
3. Open a never-collaborated scene single-user and save; verify behavior identical to pre-feature (FR-012).

### Edge cases worth exercising manually

- Disconnect mid-drag in B; release after reconnect — gesture must not be lost.
- Long offline period with heavy A-side changes; B reconnects — full reconciliation, no corruption.
- Two users deleting the same node they both created moments apart — one deterministic result, no dangling connections visible.
- Two users triggering AI generation on the same node concurrently — scene stays consistent, node ends with one completed output.
