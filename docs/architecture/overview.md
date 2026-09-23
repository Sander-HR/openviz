# Architecture Overview

OpenViz is a Next.js and TypeScript application organized around three product surfaces:

- **Dashboard:** project discovery and management.
- **Studio:** Konva/React-Konva canvas editing and AI render preparation.
- **Workbench:** React Flow node graphs for multi-step creative workflows.

## Application boundaries

```text
Dashboard / Studio / Workbench
              ↓
      Zustand client state
              ↓
     Services and API routes
       ↓       ↓        ↓
 PostgreSQL  Redis    ComfyUI
```

## Technology choices

| Area | Technology |
|---|---|
| Application | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Client state | Zustand |
| Server state | TanStack Query |
| Canvas | Konva.js and React-Konva |
| Graph editor | React Flow |
| Persistence | Drizzle ORM and PostgreSQL |
| Jobs | Redis and BullMQ |
| AI generation | ComfyUI |

## Code organization

- `src/components/` contains presentational UI.
- `src/hooks/` contains feature hooks and side effects.
- `src/services/` contains API and business logic.
- `src/store/` contains Zustand state.
- `src/types/` contains shared domain types.
- `src/app/` contains Next.js routes and pages.

Detailed engineering rules are maintained in [`AGENTS/`](../../AGENTS/) and the governing process is defined in [the constitution](../../.specify/memory/constitution.md).
