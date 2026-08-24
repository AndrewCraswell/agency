# Next.js frontend architecture and dependency record

## Decision

TanStack Start was the original frontend choice, but its packages could not be installed reproducibly from the
supported Microsoft Azure Artifacts feed after local registry workarounds were removed. The product frontend therefore
lives in `apps/legislation-web` as a standalone Next.js application. The service in `apps/legislation` remains the sole
owner of canonical data, ingestion, search, the HTTP API, and MCP transport.

This split makes the browser application deployable and independently testable without allowing it to open database
connections or reuse MCP as a product-data transport. It does not create a shared monorepo package: only the
legislation product uses this boundary today.

## Initial shape

```text
apps/legislation-web/
├── app/                         Next.js route shell
├── src/api/                     Server-only HTTP API boundary
├── docs/                        Application-specific decisions
└── package.json                 Explicit frontend dependency graph
```

`app/page.tsx` is dynamic so it never performs an API readiness request at build time. It reads
`LEGISLATION_API_BASE_URL` server-side and presents only a configured, available, or unavailable foundation state.
The browser receives neither an API token nor database credentials.

`src/api/legislation-api.server.ts` owns HTTP origin validation, deadline handling, and validation of the public
`GET /ready` response. Feature-specific client methods belong behind this boundary after their API contract reaches
**Ready** in `apps/legislation/docs/http-api-implementation-backlog.md`.

Browser authentication is intentionally deferred. The current API requires WorkOS credentials for canonical data;
the frontend must use a user-session design and server-side token exchange. A machine-to-machine API secret must never
be exposed through a `NEXT_PUBLIC_*` environment variable or browser bundle.

## Dependency graph

The scaffold uses only exact runtime versions already resolved in the repository's committed `pnpm-lock.yaml`:

```text
legislation-web
├── next 16.2.6
├── react 19.2.7
└── react-dom 19.2.7
```

The committed lockfile contains an `apps/legislation-web` importer, the `next@16.2.6` package snapshot, and its React
19.2.7 peer resolution. The workspace registry is the supported Microsoft Azure Artifacts feed; the lockfile contains
no local-registry URLs. No hosts-file override is required for this application.

From the repository root, validate the installed dependency graph with:

```powershell
pnpm install --filter legislation-web --frozen-lockfile
pnpm --filter legislation-web verify
```

That install must preserve `next` at `16.2.6` and React/React DOM at `19.2.7`. Do not use a floating `latest` tag.
Next also regenerates `next-env.d.ts` with a semicolon that conflicts with the workspace formatter. The build script
normalizes that generated declaration after `next build`, leaving a successful build format-clean.

Next 16 invokes the legacy TypeScript JavaScript API while building, so this app pins `typescript@5.9.3` as a local
build-only dependency. Its `check:types` script explicitly invokes the repository's native TypeScript 7 compiler, which
remains the source of type-checking truth for the monorepo. The remaining dev dependencies match versions already used
by workspace applications:

```text
@types/node catalog: (24.13.2)
@types/react ^19.2.0
@types/react-dom ^19.2.0
@vitest/coverage-v8 ^4.1.9
oxlint ^1.72.0
typescript 5.9.3 (Next.js build API only)
vitest ^4.1.9
```

## Environment contract

| Variable | Scope | Purpose |
| --- | --- | --- |
| `LEGISLATION_API_BASE_URL` | Next.js server only | Origin of the deployed Legislation HTTP API, for example the Railway application origin. |

The URL must be an HTTP or HTTPS origin without credentials, a path, query string, or fragment. The readiness call has
a five-second deadline and disables caching.

## Delivery sequence

1. Validate the app importer from the Microsoft feed with the frozen install command above.
2. Verify the route shell locally at desktop and mobile sizes, including an unavailable API origin.
3. Add browser authentication and a server-side token exchange.
4. Implement product routes only for API endpoints marked **Ready** and backed by authenticated remote smoke evidence.
5. Deploy this application separately from the API and retain the API base URL as configuration.
