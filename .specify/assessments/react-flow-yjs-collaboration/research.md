# Idea Research: React Flow Yjs Collaboration

- **Slug**: react-flow-yjs-collaboration
- **Created**: 2026-04-21T00:00:00Z
- **Evidence confidence (overall)**: medium

## Users & Demand

- The requester explicitly asked for real-time collaboration in the React Flow Workbench and named an existing React Flow collaborative example as the target behavior. This is direct stated demand, but there is no usage metric, support-ticket history, interview evidence, or identified customer segment in the intake. — [source: pasted idea in `.specify/assessments/react-flow-yjs-collaboration/intake.md`] (confidence: medium, cited)
- No observed multi-user usage, concurrent-edit frequency, or collaboration-related support data is present in the repository materials reviewed. — [source: repository review] (confidence: high, cited)
- The likely affected users are Workbench users who need to edit the same graph concurrently, but the specific personas and workflows remain unknown. — [source: intake.md] (confidence: low, assumption)

## Prior Art

- Yjs provides shared `Y.Array`, `Y.Map`, and other shared types, observers, transactions, document update events, state-vector synchronization, and a built-in `Y.UndoManager`. — [source: https://github.com/yjs/yjs] (confidence: high, cited)
- Yjs documents list connection providers including `y-websocket` and `y-webrtc`, persistence providers including `y-indexeddb`, and hosted or extensible alternatives. This confirms that the proposed technology has an established provider ecosystem, while also showing that provider selection is a material product and operations choice. — [source: https://github.com/yjs/yjs] (confidence: high, cited)
- The React Flow repository documents real-time collaboration as a pattern where node and edge state is synchronized through a WebSocket connection and incoming updates are applied to local flow state. — [source: https://github.com/xyflow/xyflow] (confidence: medium, cited)
- The existing OpenViz codebase already has a React Flow dependency (`@xyflow/react`), Zustand state, TanStack Query, Postgres/Drizzle persistence, and Workbench-specific history and autosave code. It does not currently list `yjs`, `y-websocket`, or `y-indexeddb` in `package.json`. — [source: `package.json`, `src/store/`, `src/hooks/useAutoSaveScene.ts`] (confidence: high, cited)
- A prior OpenViz feature specification establishes atomic local gesture history and durable scene persistence but explicitly excludes live multi-user collaboration. It is relevant adjacent groundwork, not an existing collaboration implementation. — [source: `specs/002-atomic-node-undo/spec.md`, especially FR-016] (confidence: high, cited)

## Market & Context

- The current alternative inside OpenViz is local editing with server-persisted scene snapshots; this supports reopening a project but does not provide live concurrent editing. — [source: `specs/002-atomic-node-undo/contracts/scene-persistence.md`] (confidence: high, cited)
- Yjs documentation presents CRDT synchronization as a way to merge distributed document updates without requiring a central source of truth for convergence. This makes it technically relevant to concurrent graph editing, but does not by itself establish product-market demand or suitability for this Workbench's domain model. — [source: https://github.com/yjs/yjs] (confidence: high, cited)
- The cost of doing nothing is currently unquantified: there is no evidence in the reviewed materials about users resorting to screen sharing, serialized handoffs, duplicate projects, or external collaboration tools. — [source: repository review and intake.md] (confidence: high, cited)

## Data & Constraints

- The current application is a React 19 / Next.js application using TypeScript, Zustand, React Flow, TanStack Query, and Postgres through Drizzle. Any collaboration design must fit those existing boundaries and must not introduce untyped state or fetch logic into view components. — [source: `AGENTS.md`, `.specify/memory/constitution.md`, `package.json`] (confidence: high, cited)
- React Flow graph state includes nodes and edges, while collaboration may also involve transient selection, cursor, viewport, and presence state. The intake does not define which of these should be durable shared document state versus ephemeral awareness state. — [source: https://github.com/xyflow/xyflow, intake.md] (confidence: medium, cited)
- Yjs transactions can bundle multiple changes and carry an origin; Yjs UndoManager can selectively track transaction origins and avoid tracking unselected origins. This is relevant to separating local undoable edits from remote updates, but the correct product behavior for OpenViz remains unresolved. — [source: https://github.com/yjs/yjs] (confidence: high, cited)
- The requested React Flow example URL uses the unrecognized host `reactflow.dev` under the assessment URL policy. It was not fetched during this research stage; claims about that page beyond the user's description are therefore not treated as independently verified evidence. — [source: https://reactflow.dev/examples/interaction/collaborative] (confidence: high, cited)
- No scale targets are available for concurrent users per room, graph size, update rate during node dragging, acceptable latency, reconnect duration, or retained document history. — [source: intake.md] (confidence: high, cited)
- Authentication, authorization, tenant isolation, abuse controls, and WebSocket deployment requirements are not defined. These constraints are especially important because collaboration changes the trust boundary from single-user scene persistence to shared live state. — [source: intake.md, `.specify/memory/constitution.md`] (confidence: medium, cited)

## Evidence Against the Idea

- There is no quantitative evidence yet that concurrent editing is a frequent or high-value user problem; the current evidence is one stated request. — [source: intake.md] (confidence: high, cited)
- A Yjs integration would add a real-time transport and lifecycle alongside the existing database persistence path, creating operational complexity that is not represented in the current dependency set. — [source: `package.json`, Yjs provider list at https://github.com/yjs/yjs] (confidence: high, cited)
- Collaboration semantics for node dragging, resizing, deletion, edge changes, selection, and Undo/Redo can create confusing behavior if not explicitly defined. The current atomic-history spec does not resolve remote/local history interaction. — [source: `specs/002-atomic-node-undo/spec.md`, intake.md] (confidence: high, cited)
- Presence, authorization, offline behavior, conflict expectations, and durable storage could expand the scope substantially beyond synchronizing nodes and edges. — [source: intake.md] (confidence: high, cited)

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Which users or customers require collaboration, and what observed workflow or metric demonstrates the need?]
- [NEEDS CLARIFICATION: What is the minimum first-release scope: nodes and edges only, or also selection, viewport, cursors, comments, and presence?]
- [NEEDS CLARIFICATION: How many collaborators and how large a graph must a room support?]
- [NEEDS CLARIFICATION: Which provider/server model is acceptable for deployment and operations?]
- [NEEDS CLARIFICATION: What authentication and project-membership checks must the collaboration transport enforce?]
- [NEEDS CLARIFICATION: Should live state be persisted as Yjs updates, periodic snapshots, or the existing scene JSON?]
- [NEEDS CLARIFICATION: What should local Undo/Redo undo when remote changes have arrived?]
- [NEEDS CLARIFICATION: Is offline editing required, and what reconnect guarantees are expected?]
- [NEEDS CLARIFICATION: What measurable latency, convergence, reliability, and data-loss targets define success?]
- [NEEDS CLARIFICATION: What is the migration/initialization behavior for existing OpenViz scenes?]

## Sources

- https://github.com/yjs/yjs (host: github.com, policy: allowlisted)
- https://github.com/xyflow/xyflow (host: github.com, policy: allowlisted)
- https://reactflow.dev/examples/interaction/collaborative (host: reactflow.dev, policy: auto-refused: host not on safe list)
- `package.json` (repository source)
- `AGENTS.md` (repository source)
- `.specify/memory/constitution.md` (repository source)
- `.specify/assessments/react-flow-yjs-collaboration/intake.md` (assessment source)
- `specs/002-atomic-node-undo/spec.md` (repository source)
- `specs/002-atomic-node-undo/contracts/scene-persistence.md` (repository source)
