# Agent Development Guidelines - OpenViz 🎨

This repository contains **OpenViz**, a React-based design application powered by Konva.js and AI (ComfyUI).

# ARCHITECTURE
- **State**: Use `zustand` for global state, `react-query` for server state.
- **Styling**: Tailwind CSS only. No inline styles.
- **Logic**: All `useEffect` and `fetch` calls belong in `use[Feature].ts` hooks.

## Build & Dev
- **Development**: `pnpm run dev` (Starts Vite server)
- **Build**: `pnpm run build` (Runs `tsc` and `vite build`)
- **Lint**: `pnpm run lint` (ESLint check for TS/TSX)

## Testing
- **Run Tests**: `pnpm test` (Uses Vitest)
- **CI Run**: `pnpm run test:ci` (headless + coverage gate)
- **Test UI**: `pnpm run test:ui` (Vitest UI)
- **Single Test**: `pnpm exec vitest path/to/file.test.ts`

## Spec-Driven Development (Spec Kit)
Governing doc: [.specify/memory/constitution.md](.specify/memory/constitution.md) — supersedes all other practices.
- **New idea** → `/speckit.assess.intake "..." slug=<slug>` → `research` → `define` → `shape` → `decide`. Only a **go** verdict proceeds to spec. Reports: `.specify/assessments/<slug>/`.
- **Feature** → create branch `NNN-slug` via `/speckit.git.feature <name>`, then `/speckit.specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement` → `converge` (repeat until Converged). Specs: `specs/NNN-feature/`.
- **TDD layering**: logic (services/hooks/stores/utils) = strict red-green, test file first; components = behavior tests from spec acceptance criteria before implementation. Coverage floor may never regress.
- Auto-commit after speckit commands is enabled (conventional style) — config: `.specify/extensions/git/git-config.yml`.

## Critical Rules
**Type Safety**: No `any`. No `@ts-ignore`. Run `tsc` to verify.
**File Limits**: Alert me if a file is >300 lines. Refactor by splitting Logic/View/Types.
**Imports**: Use named exports. Absolute imports `@/features/...` preferred over relative `../../`.

## Tech Stack
| Library | Purpose | Usage |
|---------|---------|-------|
| **Radix UI** | Accessible UI primitives | Context menus, dropdowns, dialogs. Handles portalling, collision detection, keyboard nav |
| **Tailwind CSS** | Styling | All styling - no inline styles |
| **Framer Motion** | Animations | UI transitions, layout animations |
| **Zustand** | State management | Global app state |
| **Konva.js** | Canvas rendering | Design canvas implementation |

## Folder Mapping
| Type | Location |
|------|----------|
| Interfaces/Types | `src/types/` or `[ComponentName].types.ts` |
| Business Logic/API | `src/services/` |
| State Logic | `src/store/` |
| Pure UI | `src/components/` |

## Detailed Guidelines

- [Core Principles](./AGENTS/core-principles.md) - Architecture rules
- [Refactoring](./AGENTS/refactoring.md) - When and how to split code
- [Code Style](./AGENTS/code-style.md) - React, TypeScript, styling
- [Canvas](./AGENTS/canvas.md) - Konva.js specific patterns
- [React Flow](./AGENTS/reactflow.md) - Node graph system patterns for workbench
- [Services & API](./AGENTS/services-api.md) - API integration
- [AI Interaction](./AGENTS/ai-interaction.md) - ComfyUI guidelines

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
