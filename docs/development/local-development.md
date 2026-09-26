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

The setup command validates configuration, prepares the database, and seeds local defaults. `pnpm run dev` starts PostgreSQL and Redis through Docker, then starts Next.js and the collaboration WebSocket server. See [environment variables](../operations/environment-variables.md) for configuration guidance.

Use `pnpm run stop` to gracefully stop the host development processes and the PostgreSQL/Redis Compose services. It preserves Docker volumes. Use `pnpm run restart` for a foreground stop-and-start cycle with logs attached. Both commands track the OpenViz launcher by PID and do not kill unrelated processes by port or process name. Use `pnpm run docker:down` when you only need to stop the Compose stack.

If Next.js or the collaboration server is already listening on its configured port, the dev launcher checks the listener's working directory before reusing it. A listener from another project is left untouched and OpenViz automatically uses the next available port. Set `OPENVIZ_PORT_CONFLICT=error` to fail instead. You can select alternate ports with `PORT` and `COLLAB_PORT`.

## ComfyUI

ComfyUI is optional for mock generation. For local AI generation, start it on the configured endpoint and install the required checkpoint and ControlNet models in the corresponding ComfyUI model directories.

## Related guides

- [Setup implementation](setup.md)
- [Testing](testing.md)
- [Database migrations](database-migrations.md)
- [Spec-driven development](spec-driven-development.md)
