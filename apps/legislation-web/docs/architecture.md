# Next.js frontend architecture and dependency record

## Decision

TanStack Start was the original frontend choice, but its packages could not be installed reproducibly from the
supported Microsoft Azure Artifacts feed after local registry workarounds were removed. The product application and
public API boundary therefore live in `apps/legislation-web` as a standalone Next.js application. Explicit API Route
Handlers belong under `app/api`. The service in `apps/legislation` remains the owner of canonical data, ingestion,
search, reusable application/domain code, and the transitional standalone API rollback path; MCP remains in that service
until the final HTTP cutover.

This split makes the browser application and API boundary independently testable without allowing the browser to open
database connections or reuse MCP as a product-data transport. The Next.js application deploys as a new parallel Railway
service named `legislation-web`; the existing `legislation-api` service remains the rollback target while route blocks
migrate. It does not create a shared monorepo package: only the legislation product uses this boundary today.

## Initial shape

```text
apps/legislation-web/
├── app/                         Next.js route shell
│   ├── api/                     Explicit `route.ts` files for the public `/api/**` contract
│   ├── health/                  Operational `/health` Route Handler
│   └── ready/                   Operational `/ready` Route Handler
├── src/api/                     Server-only HTTP API boundary
├── docs/                        Application-specific decisions
└── package.json                 Explicit frontend dependency graph
```

`app/page.tsx` is dynamic so it never performs an API readiness request at build time. It reads
`LEGISLATION_API_BASE_URL` server-side and presents only a configured, available, or unavailable foundation state.
The browser receives neither an API token nor database credentials.

`src/api/legislation-api.server.ts` owns the transitional shell's HTTP origin validation, deadline handling, and
validation of the public `GET /ready` response. API Route Handlers under `app/api` own the Next.js request boundary and
reuse the domain/application services in `apps/legislation`. Feature-specific client methods belong behind this boundary
after their API contract reaches **Ready** in `apps/legislation/docs/http-api-implementation-backlog.md`.

Browser authentication is intentionally deferred. The current API requires WorkOS credentials for canonical data;
the frontend must use a user-session design and server-side token exchange. A machine-to-machine API secret must never
be exposed through a `NEXT_PUBLIC_*` environment variable or browser bundle.

## Dependency graph

The scaffold landed in commit `03e1c7b` with these exact runtime versions already resolved in the repository's committed
`pnpm-lock.yaml`:

```text
legislation-web
├── next 16.2.6 (scaffold baseline)
├── react 19.2.7
└── react-dom 19.2.7
```

The user approved upgrading the scaffold to exact `next@16.3.1`; the migration lockfile and package manifest must record
that target with the existing React 19.2.7 pairing. The workspace registry remains the supported Microsoft Azure
Artifacts feed; no hosts-file override or local-registry URL is required for this application.

The Railway Docker build is intentionally credential-free. Like the existing `legislation-api` image, it overlays an
app-local workspace containing only the web application, legislation service, and shared configuration packages, then
performs a frozen install from `https://registry.npmjs.org/`. This deployment-only registry selection does not change
the repository `.npmrc` or developers' Microsoft-feed workflow.

From the repository root, validate the installed dependency graph with:

```powershell
pnpm install --filter legislation-web --frozen-lockfile
pnpm --filter legislation-web verify
```

After the approved upgrade, that install must preserve `next` at `16.3.1` and React/React DOM at `19.2.7`. Do not use a
floating `latest` tag.
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

1. Apply and validate the approved `next@16.3.1` upgrade from the Microsoft feed with the frozen install command above.
2. Verify the route shell locally at desktop and mobile sizes, including an unavailable API origin.
3. Implement explicit API Route Handlers under `app/api` in the migration plan's endpoint blocks, reusing
   `apps/legislation` domain code.
4. Deploy the foundation and every completed route block as the new parallel Railway `legislation-web` service, retaining
   the standalone `legislation-api` service as rollback.
5. Add WorkOS authentication after all 87 API routes pass deployed smoke, then distributed rate limiting; move MCP to
   the HTTP API last.
