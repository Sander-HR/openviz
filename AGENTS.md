# Agent Development Guidelines - OpenViz 🎨

This repository contains **OpenViz**, a React-based design application powered by Konva.js and AI (ComfyUI).

# ARCHITECTURE
- **State**: Use `zustand` for global state, `react-query` for server state.
- **Styling**: Tailwind CSS only. No inline styles.
- **Logic**: All `useEffect` and `fetch` calls belong in `use[Feature].ts` hooks.

## Build & Dev
- **Development**: `npm run dev` (Starts Vite server)
- **Build**: `npm run build` (Runs `tsc` and `vite build`)
- **Lint**: `npm run lint` (ESLint check for TS/TSX)

## Testing
- **Run Tests**: `npm test` (Uses Vitest)
- **Test UI**: `npm run test:ui` (Vitest UI)
- **Single Test**: `npx vitest path/to/file.test.ts`

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
