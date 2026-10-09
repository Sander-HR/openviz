# Spec-Driven Development

OpenViz uses numbered feature specifications as the source of truth for committed product work.

## When to create a specification

Create a specification before implementing a new feature that changes user behavior, domain data, persistence, collaboration, or public APIs. Small maintenance fixes can use a normal issue and pull request.

For a new idea, use the assessment workflow in `.specify/assessments/`. A decision to proceed becomes the next numbered directory under `specs/`.

## Feature directory structure

```text
specs/NNN-feature-name/
├── README.md
├── spec.md
├── plan.md
├── tasks.md
├── data-model.md
├── contracts/
├── checklists/
├── research.md
└── quickstart.md
```

- `spec.md` defines the user problem, requirements, scenarios, and acceptance criteria.
- `plan.md` records the implementation approach and boundaries.
- `tasks.md` breaks the work into independently verifiable tasks.
- `data-model.md` and `contracts/` document durable interfaces.
- `checklists/` and `quickstart.md` support verification.

## TDD expectations

Use strict red-green TDD for services, hooks, stores, utilities, and other logic. Write component behavior tests from the specification's acceptance criteria before implementation. Use browser tests for cross-page, accessibility, and multi-client behavior.

## Quality gate

Before marking a feature implemented, run:

```bash
pnpm run lint
pnpm run test:ci
pnpm run build
```

Update the feature README and specification status when the work is complete. Completed specifications remain available as implementation and contract history; superseded drafts should be clearly marked rather than treated as active work.
