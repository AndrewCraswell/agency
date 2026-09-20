# Agency monorepo

A Turborepo and pnpm monorepo for the agency's applications and shared packages.

## What's inside?

This Turborepo includes the following packages and apps:

### Apps and Packages

- `blog-writer`: Shopify blog-writing application
- [legislation-web](apps/legislation-web/README.md): browser product, public HTTP API and query runtime
- [legislation-ingestion](apps/legislation-ingestion/README.md): source acquisition, workers and indexing
- [legislation-mcp](apps/legislation-mcp/README.md): standalone authenticated MCP-to-HTTP adapter
- [@repo/legislation-core](packages/legislation-core/README.md): shared contracts, database schema and primitives
- `scoring`: fencing scoring application and supporting tools
- `@repo/oxlint-config`: shared [oxlint](https://oxc.rs) configuration
- `@repo/storybook-config`: shared [Storybook](https://storybook.js.org) configuration
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Applications and shared packages primarily use [TypeScript](https://www.typescriptlang.org/); legislation ingestion also
owns Python parser and scraper runtimes.

### Install dependencies

Some workspaces use `@1js` packages from the Office Azure Artifacts feed. Install dependencies normally:

```sh
pnpm install
```

If installation fails because the feed credentials have expired, refresh them and retry:

```sh
pnpm auth
pnpm install
```

For legislation setup, including local credentials after the workspace moves, see the
[runtime guide](apps/legislation-web/docs/operations/development.md). From the repository root,
`pnpm verify:legislation` runs the five-package legislation verification suite, including the diffing package.
`pnpm verify` currently delegates to that same legislation-only gate; it is not a full monorepo check. Database release
commands are owned by web and delegate to core.

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [oxlint](https://oxc.rs) for code linting
- [oxfmt](https://oxc.rs) for code formatting
- [Vitest](https://vitest.dev) for testing
- [Lefthook](https://lefthook.dev) for Git hooks
