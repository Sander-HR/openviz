# Code Style & Conventions

## React & Components
- **Functional Components**: Use arrow functions (`const Comp: React.FC = () => ...`)
- **Exports**: Named exports only (no default exports)
- **Styling**: Tailwind CSS is the standard. Use `clsx` and `tailwind-merge` for dynamic classes
- **Animations**: Use `framer-motion` for UI transitions

## State Management
- **Zustand**: Primary state store is in `src/store/`
- **Persistence**: State is persisted to IndexedDB via `idb-keyval`
- **Logic**: Prefer keeping complex state logic inside store actions rather than components

## TypeScript & Types
- **Naming**: Use `PascalCase` for types/interfaces, `camelCase` for variables/functions
- **Strictness**: Avoid `any`. Use `Record`, `Pick`, and `Omit`. Define interfaces for all API responses and store states
