# Implementation Plan: Shared Multi-Mode Generation Node

**Branch**: `008-single-shared-magicprompt` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-magicprompt-multimode-node/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Replace the separate Variate, New View, and Extract canvas node types with one shared
generation node. The node stores a base state plus lossless mode configuration for
Variation, New View, and Extract, while retaining one image input and routing enabled
generation through the existing render-service facade. Existing legacy nodes are
normalized into the shared representation when loaded without losing configuration.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript, React 19, strict compiler settings

**Primary Dependencies**: React Flow, Zustand, React Testing Library, Vitest, Tailwind CSS, Radix UI

**Storage**: Existing Zustand workbench state and scene-sync persistence; no new database migration

**Testing**: Vitest, React Testing Library, TypeScript compiler, ESLint, manual workbench smoke test

**Target Platform**: Browser workbench at `/projects/<id>/workbench`

**Project Type**: React web application with a React Flow canvas and backend-agnostic generation services

**Performance Goals**: Mode transitions meet the specification's under-300 ms target without an intermediate blank state; normal canvas interaction remains responsive

**Constraints**: No `any` or `@ts-ignore`; Tailwind-only styling; no direct backend calls from components; one input handle; files under 300 lines; existing scenes and undo/redo remain compatible

**Scale/Scope**: One generation-node state model, three implemented specialized modes, add-node and graph mapping updates, legacy normalization, connection policy, render-service compatibility, and behavior coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **PASS — Type Safety**: Explicit TypeScript types for node state, modes, connections, and service inputs; validate with `tsc --noEmit`.
- **PASS — Test-First Layering**: Logic/store/normalization/connection tests precede implementation; component behavior tests derive from the acceptance scenarios.
- **PASS — State Architecture**: Persisted mode data remains in Zustand/workbench scene state; generation remains behind existing service facades and hooks.
- **PASS — UI Primitives and Styling**: Interactive controls use accessible primitives and Tailwind classes only.
- **PASS — Module Boundaries and File Limits**: Mode logic, types, and view components are split by concern and kept below 300 lines.
- **PASS — Existing Stack**: React Flow remains the canvas graph; no second bundler or persistence system is introduced.
- **PASS — Quality Gates**: ESLint, TypeScript, and Vitest must pass without reducing coverage.

## Project Structure

### Documentation (this feature)

```text
specs/008-magicprompt-multimode-node/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── types/                         # shared generation-node and mode types
├── store/                         # node property updates and undo/redo integration
├── services/workbench/            # connection policy and legacy normalization
├── services/                      # generation-service operation compatibility
├── components/nodes/              # shared node view and focused mode bodies
└── components/workbench/          # add-node menu and React Flow graph mapping
```

**Structure Decision**: Keep the feature in the existing single React application.
Types remain in `src/types/`; state transitions and persistence updates use existing
Zustand workbench actions; pure mode views remain in `src/components/nodes/`; graph and
connection behavior stays in the existing workbench hooks/services. No new application
boundary or database schema is introduced.

## Implementation Phases

### Phase 0 — Research

- Confirm the shared-node state model, one-input connection policy, Zustand history path,
  render-service boundary, accessibility approach, and file split. Findings are recorded
  in [research.md](./research.md).

### Phase 1 — Design and contracts

- Define the shared node, mode configurations, legacy mappings, connection constraints,
  and state transitions in [data-model.md](./data-model.md).
- Define node state, connection, generation, and UI behavior contracts in `contracts/`.
- Define runnable automated and manual validation in [quickstart.md](./quickstart.md).

### Post-design Constitution Check

- **PASS**: The design uses explicit types and test-first seams for all logic layers.
- **PASS**: State remains in existing Zustand workbench slices and service boundaries.
- **PASS**: UI controls remain accessible and Tailwind-only.
- **PASS**: The structure introduces no new application, database, or bundler boundary.
- **PASS**: Planned files are split by concern and must remain below 300 lines.

Implementation tasks are intentionally deferred to `/speckit.tasks`; this plan does not
create `tasks.md`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
