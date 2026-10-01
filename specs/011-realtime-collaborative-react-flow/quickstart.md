# Real-Time Collaboration Validation Guide

## Prerequisites

- Dependencies installed with `pnpm install`.
- Collaboration server environment configured.
- `pnpm run dev` and `pnpm run dev:collab` available.
- Two authorized test accounts and one unauthorized account.

## Automated checks

```bash
pnpm run lint
pnpm exec tsc --noEmit
pnpm run test:ci
pnpm run build
```

Focused collaboration checks:

```bash
pnpm exec vitest src/services/collab
pnpm exec vitest src/components/workbench/hooks/useCollabSession.test.ts
pnpm exec vitest src/store/slices/workbenchCollaborationSlice.test.ts
```

## Convergence and history

1. Open the same project in sessions A and B.
2. Create, move, resize, edit, connect, and delete nodes/edges in both sessions; rename the shared scene from one session.
3. Confirm both sessions converge to identical keyed nodes/connections and show the same scene name.
4. In A, move a node; in B, move the same node afterward; undo in A.
5. Confirm B’s newer move remains and both sessions converge.
6. Redo in A and verify the defined current-document behavior without undoing an unrelated B operation.
7. In A and B, rename the same node concurrently; confirm both sessions converge to the last-update-wins value (later Yjs update order) with no conflict metadata in the document.

## Offline recovery

1. Disconnect session A from the collaboration server.
2. Make graph edits and Undo/Redo operations in A.
3. Refresh A while disconnected when IndexedDB is available.
4. Reconnect A and confirm the symmetric state-vector merge: A’s offline edits and B’s concurrent edits are both present (neither side discarded).
5. Confirm no historical cursor positions are replayed.

## Awareness and authorization

1. Move the pointer and pan/zoom in A; verify B sees the correct world-space cursor.
2. Disconnect A cleanly; verify its presence and cursor are removed immediately. Simulate an abnormal drop (no clean close) and verify removal after the 30-second timeout.
3. Attempt a join with the unauthorized account; verify no document or awareness data is received and the editor shows the same generic access-unavailable message as other rejected joins.
4. Reconnect an authorized session with a fresh token and verify state plus awareness recovery.

## Performance

Run the same workload for all latency and frame-rate targets: 50 collaborators each publish 30–40 cursor updates/sec, while one editor submits one graph operation/sec. Run for at least 60 seconds after warm-up and record the tested browser, hardware, and network profile.

```bash
node scripts/perf/collab-bench.mjs --clients 50 --cursor-hz 33 --edit-hz 1 --duration-seconds 60
```

Measure document synchronization from a local document transaction to its remote document observer, cursor latency from local awareness publication to the remote cursor overlay update, and interaction latency from a local command to its first visible React Flow projection. Use one benchmark clock (or calibrated clocks when peers run on separate hosts).

Record and compare:

- document synchronization p95 (<200 ms, SC-003);
- cursor p95 latency (<150 ms, SC-004);
- interaction latency (local edit → visible render) p95 (<100 ms, SC-007);
- sustained frame rate (≥30 fps, SC-007);
- actual cursor updates/sec/user and React Flow renders caused by cursor-only updates;
- editor frame time and long tasks while editing online and offline.
