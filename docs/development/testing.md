# Testing

OpenViz uses Vitest and React Testing Library.

```bash
pnpm run test       # Watch mode
pnpm run test:ci    # Headless CI run with coverage
pnpm run test:ui    # Vitest UI
```

Logic in services, hooks, stores, and utilities should be developed with strict red-green TDD. Components should have behavior tests for their acceptance criteria. Use end-to-end tests for cross-page, browser, and multi-client behavior.

Before opening a pull request, run:

```bash
pnpm run lint
pnpm run test:ci
pnpm run build
```

Coverage output is generated in `coverage/` and should not be committed.
