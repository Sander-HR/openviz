# Database Migrations

Database schema is managed with Drizzle ORM and PostgreSQL.

```bash
pnpm run db:push       # Apply the current schema directly during local development
pnpm run db:generate   # Generate a migration after schema changes
pnpm run db:migrate    # Apply committed migrations
pnpm run db:studio     # Open Drizzle Studio
```

Committed SQL migrations live in `drizzle/`. Review generated SQL before committing it. Never commit credentials or production database configuration.
