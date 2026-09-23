# Local Development

## Docker-first setup

The recommended path is:

```bash
docker compose up --build
```

This starts the application, PostgreSQL, and Redis and runs the setup flow. Use `pnpm run docker:logs` to inspect services and `pnpm run docker:down` to stop them.

## Host setup

```bash
pnpm install
cp .env.example .env
pnpm run setup
pnpm run dev
```

The setup command validates configuration, prepares the database, and seeds local defaults. See [environment variables](../operations/environment-variables.md) for configuration guidance.

## ComfyUI

ComfyUI is optional for mock generation. For local AI generation, start it on the configured endpoint and install the required checkpoint and ControlNet models in the corresponding ComfyUI model directories.

## Related guides

- [Setup implementation](setup.md)
- [Testing](testing.md)
- [Database migrations](database-migrations.md)
- [Spec-driven development](spec-driven-development.md)
