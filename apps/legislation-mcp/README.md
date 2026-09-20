# Legislation MCP

Standalone, stateless, authenticated MCP resource. Queries use the web API over HTTPS. This process does not host the
API, access databases, load Next.js, run ingestion, or require model/provider credentials.

## Configuration

Required environment variables:

| Variable                       | Value                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| `AUTH_MODE`                    | `workos`                                                             |
| `WORKOS_ISSUER`                | Credential-free HTTPS issuer URL                                     |
| `WORKOS_JWKS_URL`              | Credential-free HTTPS JWKS URL                                       |
| `WORKOS_MCP_AUDIENCE`          | Public HTTPS resource URL ending in `/mcp`                           |
| `MCP_API_BASE_URL`             | Fixed HTTPS API origin, independently configured from the MCP origin |
| `WORKOS_API_AUDIENCE`          | API audience, distinct from the MCP resource                         |
| `WORKOS_API_M2M_CLIENT_ID`     | Dedicated outbound API client                                        |
| `WORKOS_API_M2M_CLIENT_SECRET` | Dedicated outbound API credential                                    |

Optional: `PORT` (3000), `MCP_API_TIMEOUT_MS` (25000, at most 30000), `LEGISLATION_LEGAL_API_ORGANIZATIONS`
(comma-separated organization IDs; empty disables protected legal tools). Invalid configuration fails startup without
logging values. Supply secrets through the runtime environment, never build args.

Incoming tokens authorize only the MCP audience. The caller token is never forwarded. Legal calls additionally verify
the independently acquired API token's audience, user and organization against the incoming identity. A shared service
credential is not delegated user access. Provisioning multi-user delegated credentials remains a separate design
decision.

## Run

MCP failure reporting uses `SENTRY_DSN`, `SENTRY_ENVIRONMENT` and the Railway Git commit as its release identity,
falling back to `SENTRY_RELEASE` outside Railway; see [diagnostic telemetry](docs/operations/telemetry.md) for coverage,
redaction and acceptance requirements.

From the repository root, with workspace dependencies installed and the runtime environment configured:

```sh
pnpm --filter legislation-mcp build
pnpm --filter legislation-mcp start
pnpm --filter legislation-mcp check:types
pnpm --filter legislation-mcp test
pnpm --filter legislation-mcp test:acceptance
```

For local source development use `pnpm --filter legislation-mcp dev` with environment already set. Vite 8's installed
SSR bundler consumes core's source TypeScript exports and bundles runtime dependencies. No new bundler library is added.
It emits `main.mjs` and an importable `application.mjs` with the same application/server factories used by production.
This avoids native Node type stripping's inability to resolve source `.js` imports to `.ts`. The runtime image copies
only the output directory; it does not install the core package's database/tokenizer dependency closure. Artifact
isolation must pass built acceptance, including unexpected external imports and native assets.

The Docker build copies only MCP, core and shared lint/type configuration plus root package metadata. The coordinating
lockfile must include this workspace. Private registry authentication, if required by the build environment, must be
provided through its existing secure build mechanism; this Dockerfile does not embed a registry token.

```sh
docker build -f apps/legislation-mcp/Dockerfile -t legislation-mcp:local .
```

Terminate TLS at the existing ingress and preserve the configured public Host header. Forwarded headers do not override
Host/Origin checks. No browser CORS is enabled. Plain HTTP is used only between ingress and the Node listener; public
resource and upstream API configuration remain HTTPS-only.

## HTTP Contract

- `POST /mcp`: authenticated stateless transport; GET streams, DELETE sessions and other methods return 405.
- `GET /.well-known/oauth-protected-resource/mcp`: canonical discovery for the resource.
- `GET /.well-known/oauth-protected-resource`: supported root discovery for clients that begin at the authority.
- `GET /health`: process liveness, no upstream calls.
- `GET /ready`: valid startup configuration and open SDK transport lifecycle, no database or token-minting probe.

Responses are no-store and carry a bounded correlation ID. Bodies are limited to 1 MiB and a ten-second read deadline;
tool calls have a thirty-second deadline. API calls reject redirects and inherit request cancellation. SIGINT/SIGTERM
stop readiness, cancel outbound work, close SDK state and the listener, and force termination after ten seconds if
needed.

The installed SDK Node adapter buffers bodies before Fetch conversion. The host deliberately uses its parsed-body bypass
and gives the authenticated application the original Node stream, so application limits run before buffering. Do not
replace this with direct raw-handler mounting.

## Smoke And Ownership

`pnpm --filter legislation-mcp smoke:deployment` requires `LEGISLATION_MCP_SMOKE_BASE_URL`,
`LEGISLATION_MCP_SMOKE_TOKEN`, `LEGISLATION_SMOKE_BILL_ID`, and the expected full commit in
`LEGISLATION_DEPLOYMENT_COMMIT_SHA` or `GITHUB_SHA`. It checks the reported deployment identity, discovery, anonymous
rejection and authenticated tool round trips. It never uses a web API token. Web's smoke is separate and uses its
explicit API origin and API token.

Core owns research definitions, paging and canonical wire validation; MCP owns SDK wrapping and the outbound adapter.
Tests use local signing keys and fixture HTTP, never sibling apps. Built acceptance runs the production entry and the
shared application entry in isolated child processes, checking distinct-origin upstream calls and credential separation.
Real MCP-to-web acceptance, browser consent, revocation, container image audit, and live rollout remain coordinating
release gates. See [testing](docs/operations/testing.md) for the exact local acceptance boundary.

## Documentation

The [MCP index](docs/README.md) links tool contracts, regulatory tasks, authentication and test ownership.
[Web](../legislation-web/docs/README.md) owns product/API queries, [ingestion](../legislation-ingestion/docs/README.md)
owns source/worker evidence, and [core](../../packages/legislation-core/docs/README.md) owns shared contracts. Web links
resolve to `apps/legislation-web`; no additional deployment acceptance is claimed here. See
[local environment setup](../legislation-web/docs/operations/development.md#local-environment-after-the-move) before
relocating configuration from the former combined workspace; M must not inherit its database or model credentials.
