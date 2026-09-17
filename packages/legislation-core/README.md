# Legislation Core

Shared legislation contracts and primitives consumed by W, I and M. C imports no application, including in tests. Use
explicit package subpaths for canonical models/identifiers, legal reader/rights, typed HTTP client, research
definitions, Node auth/context, database/schema/migrations, embeddings/tokenizers and telemetry sanitization.
Application environment loading, runtime initialization, query orchestration and source adapters stay app-owned.

The package exports TypeScript source, not emitted JavaScript. Internal dependencies shared with NodeNext consumers and
Turbopack should use the existing `@repo/legislation-core/...` export paths as well. Relative `.js` specifiers can
type-check against `.ts` files but fail in Turbopack because no corresponding JavaScript file exists.

Start with the [documentation index](docs/README.md).

## Commands

- `pnpm --filter @repo/legislation-core test`: shared units.
- `pnpm --filter @repo/legislation-core test:database`: guarded schema/database integration.
- `pnpm --filter @repo/legislation-core check:types`: shared type checks.
- `pnpm --filter @repo/legislation-core db:up`: dedicated local PostgreSQL/pgvector.
- `pnpm --filter @repo/legislation-core db:wait`: local readiness.
- `pnpm --filter @repo/legislation-core db:generate`: schema migration generation.

Migration assets live once in C and release explicitly through `pnpm --filter legislation-web db:migrate`, using the
direct administration connection. No W/I/M startup applies migrations. See
[database setup](docs/operations/development.md). W is `apps/legislation-web`. Its database scripts delegate to C; C
reads the invoking process environment rather than loading the former application's `.env` file.

Keep browser-safe schemas distinct from Node auth/context/database exports. A subpath alone does not remove database or
tokenizer dependencies from an installed artifact; M owns its built-image isolation proof. Preserve tokenizer assets,
checksums and licenses beside their implementations. [Testing](docs/operations/testing.md) links the coordinated gate.
