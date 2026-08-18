# Local development

## Requirements

- Node.js 24 or newer.
- pnpm 11.
- Docker Desktop or another Docker Compose-compatible runtime for PostgreSQL integration work.
- The monorepo dependencies installed from the repository root.

## Commands

From the repository root:

```text
pnpm install
pnpm --filter legislation build
pnpm --filter legislation test
pnpm --filter legislation check:types
pnpm --filter legislation lint
pnpm --filter legislation dev
```

The development server listens on `127.0.0.1:3100` by default and exposes:

- `GET /health` for process health.
- `GET /ready` for dependency readiness.

Copy `.env.example` to an untracked environment file when local overrides are required. The initial foundation supports
server, logging, and PostgreSQL settings. Defaults are suitable for the app-contained local infrastructure.

## Local PostgreSQL

The legislation app owns an isolated PostgreSQL 18 and pgvector environment. It binds only to
`127.0.0.1:55432`, uses a named Compose project, and stores its data in an app-specific volume.

From the repository root:

```text
pnpm --filter legislation db:up
pnpm --filter legislation db:wait
pnpm --filter legislation db:migrate
pnpm --filter legislation db:status
```

Run the real-database integration suite in PowerShell:

```powershell
$env:LEGISLATION_TEST_DATABASE_URL = "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
pnpm --filter legislation test
```

The integration suite refuses to perform schema cleanup unless the URL targets the dedicated `legislation_test`
database. It drops only the `legislation` and `legislation_migrations` schemas.

Run the application startup smoke test with `pnpm --filter legislation smoke:local`. It starts the real server against
local PostgreSQL, verifies health and readiness, and shuts the process down.

Stop the container while retaining data with `pnpm --filter legislation db:down`. To delete only the disposable
legislation database volume and recreate it from zero, run:

```text
pnpm --filter legislation db:reset
pnpm --filter legislation db:up
pnpm --filter legislation db:migrate
```

The Compose project and volume names are app-specific, so this reset does not target infrastructure belonging to
other monorepo applications.

## Local artifacts

When `AZURE_STORAGE_ACCOUNT` is unset, immutable source archives, normalized documents, and reports use the filesystem
adapter rooted at `LEGISLATION_SOURCE_DIRECTORY` (default `.data/sources`). Paths are content-addressed and constrained
to that app-owned directory. Set an Azure storage account to select the managed-identity Blob Storage adapter instead.

## Workspace boundary

Database code, infrastructure, ingestion, Trigger.dev tasks, MCP tools, authentication, and observability remain in this app.
Move code to a top-level monorepo package only after another application has a demonstrated need to consume it.
