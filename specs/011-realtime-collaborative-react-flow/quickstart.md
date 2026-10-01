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
2. Create, move, resize, edit, connect, and delete nodes/edges in both sessions.
3. Confirm both sessions converge to identical keyed nodes and edges.
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
3. Attempt a join with the unauthorized account; verify no document or awareness data is received.
4. Reconnect an authorized session with a fresh token and verify state plus awareness recovery.

## Performance

Run the documented 50-user workload and record:

- document update p95 latency (target <200 ms);
- cursor p95 latency (target <150 ms);
- interaction latency (local edit → visible render) p95 (target <100 ms, SC-007);
- sustained frame rate during concurrent cursor traffic (target ≥30 fps, SC-007);
- cursor updates/sec/user;
- React Flow renders caused by cursor-only updates;
- editor frame time and long tasks while editing offline and online.
