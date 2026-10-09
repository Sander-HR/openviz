# Refactoring Instructions (The "Split" Logic)

When a file becomes too large or complex, apply these steps:

## 1. Extract Logic to Custom Hooks
- If a component has >2 `useEffect` calls or complex state logic, move it to a local `use[ComponentName].ts` file
- The component should only contain JSX and the hook call

## 2. Decompose Large Components
- Break down large JSX trees into smaller sub-components inside `src/components/`
- Use the "Atomic" approach: if a piece of UI is repeated or takes up >50 lines of JSX, it becomes a node/sub-component

## 3. Externalize Types
- Move all complex TypeScript interfaces from the component file to `src/types/` or a dedicated `.types.ts` file in the component folder

## 4. Service Extraction
- Any `fetch`, `axios`, or third-party SDK initialization must live in `src/services/`
- The component should only call a service method
