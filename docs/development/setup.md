# Project Setup

OpenViz supports Docker-first development and a manual host setup.

## Docker setup

From the repository root:

```bash
pnpm run dev:docker
```

Or start the stack directly:

```bash
docker compose up --build
```

The Docker workflow starts the application, PostgreSQL, and Redis. It prepares local configuration, waits for the database, applies the schema, and seeds development defaults.

Useful commands:

```bash
pnpm run docker:logs
pnpm run docker:down
```

Use `.env.docker.example` as the starting point for Docker-specific port and service configuration.

## Manual setup

```bash
pnpm install
cp .env.example .env
pnpm run setup
pnpm run dev
```

`pnpm run setup:container` performs setup without starting the development server and is intended for scripted or container environments. `pnpm run init` is an alias for `pnpm run setup`.

## Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL 14+
- Redis for queue and collaboration services
- ComfyUI for local AI generation; mock generation can be used without it

See [environment variables](../operations/environment-variables.md) before configuring external services.
