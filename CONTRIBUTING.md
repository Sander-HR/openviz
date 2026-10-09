# Contributing to OpenViz

Thank you for contributing. Please keep changes focused, typed, tested, and documented.

## Before you start

1. Read the [README](README.md) and [local development guide](docs/development/local-development.md).
2. Check existing issues and specifications under [`specs/`](specs/).
3. For a new feature, create or update a numbered specification before implementation.

## Development workflow

```bash
pnpm install
pnpm run lint
pnpm run test:ci
pnpm run build
```

Follow the rules in [`AGENTS.md`](AGENTS.md), including the Zustand/TanStack Query architecture, Tailwind-only styling, and TypeScript safety requirements.

## Pull requests

- Explain the user-visible change and implementation approach.
- Link the relevant issue or specification.
- Include tests for changed behavior.
- Call out migrations, environment variables, or breaking changes.
- Keep generated output and secrets out of commits.
