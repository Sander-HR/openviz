# OpenViz 🎨

OpenViz is an AI-powered design application for turning sketches and reference images into photorealistic renders. It combines a Studio canvas, a node-based Workbench, and project management in one workflow.

![OpenViz Interface](public/images/interface.png)

## Features

- **Studio:** drawing tools, layers, transforms, guides, and AI rendering through ComfyUI.
- **Workbench:** node-based visual workflows for images, renders, animation, and video.
- **Dashboard:** project browsing, search, sorting, authentication, and persistent project state.
- **Rendering:** style presets, reference images, influence controls, and batch generation.

See the [product requirements](docs/product/product-requirements.md) for the detailed MVP scope and the [roadmap](docs/product/roadmap.md) for current direction.

## Quick start

### Prerequisites

- Docker Desktop or Docker Engine with Compose (recommended)
- Node.js 18+ and pnpm for host development
- PostgreSQL 14+, Redis, and ComfyUI for the full manual setup

### Docker (recommended)

```bash
git clone https://github.com/IngeniaWorks/openviz.git
cd openviz
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Docker provisions the application, PostgreSQL, Redis, local configuration, schema, and seed data.

Useful commands:

```bash
pnpm run dev:docker
pnpm run docker:logs
pnpm run docker:down
```

### Manual setup

```bash
git clone https://github.com/IngeniaWorks/openviz.git
cd openviz
pnpm install
cp .env.example .env
pnpm run setup
pnpm run dev
```

Review [local development](docs/development/local-development.md) and [environment variables](docs/operations/environment-variables.md) before configuring services. ComfyUI is optional when using mock generation; the full model setup is documented in the local development guide.

## Development commands

```bash
pnpm run dev              # Start Next.js in development
pnpm run build            # Build for production
pnpm run lint             # Run ESLint
pnpm run test             # Run Vitest in watch mode
pnpm run test:ci          # Run CI tests with coverage
pnpm run test:ui          # Open Vitest UI
pnpm run db:push          # Push the current Drizzle schema
pnpm run db:generate      # Generate a migration
pnpm run db:migrate       # Apply migrations
```

## Architecture

OpenViz uses Next.js and TypeScript for the application, Zustand for client state, React Flow for Workbench graphs, Konva for Studio drawing, Drizzle ORM with PostgreSQL for persistence, Redis/BullMQ for jobs, and ComfyUI for AI generation.

Read the [architecture overview](docs/architecture/overview.md) for boundaries and the [development documentation](docs/development/) for implementation conventions.

## Repository map

```text
src/          Application source
public/       Static assets
specs/        Active, numbered feature specifications
docs/         Product, architecture, development, and operations documentation
AGENTS/       Detailed coding-agent rules
.specify/     Spec Kit process configuration
```

## Project status

Completed areas include Studio, Workbench, dashboard, authentication, ComfyUI integration, batch generation, and undo/redo. Collaboration, animation, video generation, workflow presets, and import/export remain active or planned work. See the [roadmap](docs/product/roadmap.md).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security issues should be reported according to [SECURITY.md](SECURITY.md).

## License

OpenViz is released under the [MIT License](LICENSE).

## Acknowledgments

OpenViz builds on ComfyUI, Konva.js, React Flow, and the many open-source projects that make the application possible.
