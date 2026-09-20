# Legislation environments and deployments

## Purpose

This page defines the target CI/CD and environment contract for the legislation workspaces in this monorepo. It covers:

- `legislation-web` (W), the Next.js product and HTTP API.
- `legislation-mcp` (M), the standalone authenticated MCP service.
- The primary PostgreSQL/pgvector database.
- The separate ParadeDB passage-search database.
- GitHub Actions, Railway deployments, preview environments, schema migrations and web CDN behavior.

Shopify deployment is outside this contract. Legislation ingestion remains deployed through Trigger.dev and is verified
by the shared CI gate, but it is not converted into a Railway service by this design.

This is the target operating model. The current Railway project has only a `production` environment, its application
services are not connected to GitHub, web CDN caching is disabled and deployments are manual. Do not treat the target
workflow below as active until its acceptance checklist has passed.

## Decisions

- Railway remains the host for W, M and both production database services.
- Railway has persistent `staging` and `production` environments.
- Each environment has a primary PostgreSQL/pgvector database and a ParadeDB passage-search database.
- Staging is refreshed from production on a schedule and contains production-equivalent public legislative data.
- Private and environment-specific application data is removed or replaced after every refresh.
- Ordinary PR previews share the staging databases.
- A schema-changing PR takes an exclusive staging-schema lease and applies its migrations to staging before its preview
  becomes ready.
- Only one schema-changing PR can use staging at a time. Other schema-changing PRs wait.
- GitHub Actions owns verification and release orchestration. Railway owns builds, runtime health checks, environments,
  networking and service lifecycle.
- Production deployment requires successful CI, staging deployment, staging acceptance and an explicit production
  approval.
- Database migrations never run from ordinary application startup.
- W is the only application deployment allowed to initiate schema migrations. M never connects to a database.

## Environment topology

### Production

| Resource | Responsibility |
| --- | --- |
| `legislation-web` | Browser product, public HTTP API, sessions, webhooks and query runtime |
| `legislation-mcp` | Authenticated MCP transport that calls the production W API over HTTPS |
| `pgvector` | Canonical relational data and vector-backed data |
| `legislation-passage-search` | ParadeDB-backed ranked passage retrieval |
| PgBouncer | Runtime connection pooling where required |

Production receives only reviewed commits from `main`. Production credentials are never inherited by staging or preview
environments.

### Staging

Staging contains the same service topology with environment-specific names, domains, credentials and telemetry:

| Resource | Responsibility |
| --- | --- |
| `legislation-web` | Persistent staging product and API |
| `legislation-mcp` | Persistent staging MCP resource |
| `pgvector` | Writable production-derived staging clone |
| `legislation-passage-search` | Writable production-derived staging search clone |
| PgBouncer | Staging runtime connection pooling where required |
| `staging-refresh` | Scheduled refresh, sanitization and validation job |

Creating the Railway environment copies service configuration, not database contents. The staging databases must be
provisioned with their own volumes and populated by the refresh workflow.

### Pull-request previews

Railway PR environments provide temporary application deployments and generated domains. Focused PR environments deploy
only services affected by the changed paths and their declared dependencies.

- W or W-owned shared changes deploy a preview W service.
- M changes deploy a preview M service.
- C changes deploy every affected legislation service.
- An M preview calls the matching preview W API when one exists; otherwise it calls the persistent staging W API.
- Preview W instances use staging database credentials.
- Preview environments are removed when their PR closes.
- PRs from untrusted forks do not receive deployment credentials or staging access.

Preview URLs are test surfaces, not production evidence. They use staging WorkOS resources, staging telemetry
environments and non-production outbound integrations.

## Monorepo change routing

Every Railway application service connects to `AndrewCraswell/agency` independently. Its config file and watch paths
determine whether a commit creates a deployment.

| Changed path | Required deployment |
| --- | --- |
| `apps/legislation-web/**` | W |
| `apps/legislation-mcp/**` | M |
| `packages/legislation-core/**` | W and M; I remains on its separate Trigger.dev release path |
| `packages/legislation-diffing/**` | W and any other declared runtime consumer |
| Shared TypeScript or runtime configuration | Every consuming service |
| Root dependency or workspace manifests | Every affected Node service |
| Database migration or schema files | Staging migration workflow, then production migration workflow |
| `apps/legislation-ingestion/**` | I verification and explicit Trigger.dev deployment |
| Shopify-only paths | No legislation deployment |

The service watch paths in each `railway.json` are the deployment source of truth. GitHub path detection is an
optimization and must not contradict those paths. A shared-package change must trigger every runtime that imports it.

## CI and release orchestration

### Pull requests

The pull-request flow is:

1. GitHub runs the required verification workflow.
2. The workflow calculates affected deployable services and whether migration files changed.
3. Railway waits for the required GitHub checks before starting a preview.
4. Ordinary PRs deploy affected services against the shared staging databases.
5. A migration PR acquires the staging-schema lease, refreshes staging from production, applies the PR migrations and
   then deploys the owning preview.
6. Browser and API acceptance run against the preview URL.
7. M acceptance runs against its preview URL and the selected preview or staging W API.
8. The PR reports deployment, migration and smoke-test status independently.

The existing root `pnpm verify` remains the required code-quality gate. Package publication is a separate concern and
must not accidentally grant or block production deployment unless it is intentionally made a release prerequisite.
The repository `.npmrc` intentionally routes developer installs through the Azure Artifacts proxy because the public
npm registry is unavailable on the work VPN. The proxy contains no repository-only packages. GitHub-hosted workflows
therefore install the pinned pnpm version with npm's explicit public-registry command-line option, then set pnpm's
higher-precedence `PNPM_CONFIG_REGISTRY` environment override for repository installs. Package publication also sets
`NPM_CONFIG_REGISTRY` to the public registry. GitHub does not receive Azure registry credentials, and the committed
developer configuration remains unchanged. Railway Docker builds use the public registry explicitly or omit the
repository `.npmrc` from their build context.
GitHub also caps Vitest at two workers so interaction-heavy browser tests do not compete for the hosted runner's limited
CPU; local development retains the repository default.

### Merge to `main`

The deployment workflow runs only after the required CI workflow succeeds for the exact commit:

1. Determine whether W, M or database artifacts changed.
2. If needed, migrate staging to the schema on `main`.
3. Deploy affected staging services.
4. Wait for `/ready`.
5. Run staging API, browser and MCP smoke tests.
6. Enter the protected GitHub `production` environment approval gate.
7. Create a pre-migration production backup.
8. Run production migrations once.
9. Deploy W and wait for `/ready`.
10. Deploy M after W is ready and run its authenticated smoke tests.
11. Verify production health, canonical URLs, telemetry and the deployed commit.
12. Refresh staging from the now-current production databases and release any merged PR lease.

Deployments use explicit Railway project, environment and service identifiers. They never depend on whichever Railway
context happens to be linked on a runner.

### Failure behavior

- Failed CI creates no deployment.
- Failed staging migration leaves the current staging release in place and blocks production.
- Failed staging acceptance blocks production.
- Failed production migration prevents the new W release from starting.
- Failed W readiness prevents M deployment.
- Failed M deployment does not roll back a healthy W deployment automatically; operators assess whether the API contract
  requires a coordinated rollback.
- A deployment is successful only after Railway reports `SUCCESS` and the relevant smoke tests pass.

## Database environments

### Database pairs

The two stores form one versioned dataset:

| Production | Staging |
| --- | --- |
| `pgvector` | `pgvector-staging` |
| `legislation-passage-search` | `legislation-passage-search-staging` |

A refresh records a common source timestamp or corpus watermark. Staging is not ready until both stores correspond to
that watermark and pass validation.

### Scheduled staging refresh

Railway volume backups cannot be restored across environments, so a dedicated Railway cron service performs a
PostgreSQL-level copy. The service runs in staging, reads production through a TLS endpoint using a restricted account,
writes to staging over Railway private networking and exits when complete.

The initial implementation may use an in-place refresh with an explicit staging maintenance window:

1. Acquire the refresh lock and verify that no migration PR owns staging.
2. Mark staging unready.
3. Take a recoverable staging backup.
4. Terminate staging connections.
5. Recreate and copy the primary database.
6. Recreate and copy the passage-search database.
7. Remove or transform private and environment-specific data.
8. Reapply migrations from `main`.
9. Validate extensions, migration state, record counts, search indexes and the shared corpus watermark.
10. Restart or reconnect staging services.
11. Run W and M smoke tests.
12. Mark staging ready and release the refresh lock.

The copy implementation should stream directly between PostgreSQL servers and support parallel table and index work.
It must not require a complete dump to fit on an ephemeral runner disk. The first production-sized rehearsal determines
the safe schedule, resource limits and timeout. Railway cron schedules use UTC and skip a scheduled invocation while the
previous invocation is still running.

If the measured in-place maintenance window is unacceptable, the same workflow must restore into replacement database
services and switch a stable PgBouncer endpoint only after validation. That is an operational optimization, not a
different data contract.

### Sanitization

Production-derived staging data must not expose production application state. The refresh preserves public legislative
records while clearing or replacing:

- Users, identities, sessions and organization memberships.
- Conversations, saved research and private annotations unless explicitly retained as synthetic fixtures.
- Subscriptions, notification destinations and webhook delivery state.
- API tokens, integration credentials and provider secrets.
- Operational job state that could resume production work.

Sanitization completes before staging readiness is restored. Staging uses separate WorkOS, model-provider, storage,
telemetry and outbound integration credentials. Outbound notifications and production webhooks remain disabled.

### Staging-schema lease

Ordinary PRs do not alter staging schema. A PR that changes canonical migration files must obtain the exclusive
`staging-schema` lease before it can become preview-ready.

The lease records:

- PR number.
- Head commit SHA.
- Owner.
- Acquisition and expiration times.
- Applied migration identifier.

The lease lives outside the databases being refreshed. The refresh and migration workflows share one non-cancelling
concurrency group so their mutations cannot overlap.

While a migration PR owns staging:

- Scheduled refreshes skip and report the owning PR.
- A second migration PR queues.
- The owner workflow resets staging from production before applying its migration set.
- The owning preview is the authoritative acceptance surface.
- Persistent staging and other previews are not considered valid if their code is incompatible with the leased schema.
- New commits to the owning PR reset staging and reapply the complete migration set before redeployment.

When the PR closes without merging, staging is refreshed from production and the lease is released. When it merges,
production is migrated and deployed first; staging is then refreshed from the updated production state before the lease
is released.

### Migration ownership

Canonical migrations remain in C. W is the release owner and invokes the migration runner with the direct administrative
connection. M and I never migrate during startup.

- PR migration validation uses a disposable database in CI.
- Migration preview applies the PR migrations only after acquiring the staging lease.
- Staging release applies migrations from the exact `main` commit being deployed.
- Production release takes a backup and applies migrations once before starting the new W revision.
- Migration commands have a finite timeout and use a database lock to prevent concurrent execution.
- Destructive migrations require a maintenance window unless the old and new application revisions can safely overlap.
- Database rollback is not inferred from application rollback. Prefer a forward fix or an explicitly verified restore.

Runtime traffic uses pooled credentials. Migration commands use `DATABASE_DIRECT_URL` or the corresponding direct
administrative connection and never route through transaction pooling.

## W deployment and CDN

W builds from the repository root using `apps/legislation-web/Dockerfile` and serves the standalone Next.js output. The
Railway service retains:

- `/health` for process liveness.
- `/ready` for dependency readiness.
- A finite health-check timeout.
- A non-root runtime.
- A production region selected with database latency in mind.

Enable Railway CDN caching for W in staging and production. Use this policy:

- Keep HTML caching on `Auto`.
- Honor origin `s-maxage` and `stale-while-revalidate` directives.
- Cache fingerprinted `/_next/static/*` assets with their immutable origin headers.
- Allow `/_next/image` responses to follow their generated cache headers.
- Bypass `/api/*`, `/chat`, `/health`, `/ready` and authenticated application responses.
- Never force-cache a response carrying `Set-Cookie`, `Cache-Control: private` or `Cache-Control: no-store`.
- Do not purge fingerprinted assets during normal releases.
- Purge affected HTML only for an explicit cache-correction incident.

The pre-CDN route audit establishes the following origin policy:

| Route category | Current origin behavior | CDN policy |
| --- | --- | --- |
| `/_next/static/*` | Next.js fingerprinted assets provide immutable cache headers. | Cache using the origin headers. |
| `/_next/image` | Next.js generates responses and controls their cache lifetime. | Cache only according to the generated headers. |
| `/` | The page is force-dynamic, may reflect runtime chat availability and currently emits `must-revalidate, no-cache`. | Do not force-cache; reconsider explicit shared caching only after the runtime dependency is removed or bounded. |
| `/conversations/*` | The page is force-dynamic and displays private conversation state. | Bypass shared caching. |
| `/records/*` | The route consumes request parameters and query state. | Treat as dynamic until a public, parameter-safe cache contract is implemented and tested. |
| `/dev/*` | Development-only pages are force-dynamic. | Bypass shared caching. |
| `/api/*` | API handlers use authenticated request handling and emit `private, no-store`; malformed-path responses do the same. | Bypass shared caching. |
| `/chat` | Every response path emits `no-store`. | Bypass shared caching. |
| `/health` and `/ready` | Force-dynamic operational responses currently have no explicit `Cache-Control`; readiness depends on live services. | Bypass shared caching by path regardless of origin headers. |
| Responses with `Set-Cookie`, `private`, `no-store` or an unsafe `Vary` header | Personalized or explicitly non-cacheable. | Bypass shared caching regardless of route. |

The audit deliberately identifies no HTML route that is safe to force-cache today. Initial CDN activation improves
delivery of immutable framework assets and generated images while dynamic HTML, APIs, chat and operational endpoints
remain origin-served. Any future public HTML caching requires route-specific acceptance coverage before activation.

Acceptance requests a cacheable asset twice and requires the second response to return `x-cache: HIT`. Dynamic and
authenticated probes require `x-cache: DYNAMIC` or no cache entry, according to the route contract. Browser acceptance
continues to cover desktop and mobile navigation, keyboard behavior and accessible names.

## M deployment

M remains a standalone stateless Railway service:

- It has its own domain, WorkOS resource audience and deployment history.
- It receives no database, ingestion or model-provider credentials.
- `MCP_API_BASE_URL` points to W in the same logical environment.
- Its outbound API credential is distinct from incoming MCP credentials.
- `/health`, `/ready` and OAuth protected-resource metadata remain public.
- `/mcp` remains authenticated and `no-store`.

Production M deploys after production W is ready. A preview M calls its corresponding preview W when the PR changed W;
otherwise it calls persistent staging W. Contract changes affecting both services deploy and pass smoke tests together.

## Configuration and secret boundaries

Use separate GitHub deployment environments and Railway environment variables for staging and production.

| Setting class | Staging | Production |
| --- | --- | --- |
| Runtime database URLs | Staging pooled endpoints | Production pooled endpoints |
| Migration database URLs | Staging direct endpoints | Production direct endpoints |
| WorkOS applications and audiences | Staging registrations | Production registrations |
| W public API URL | Staging W origin | Production W origin |
| M API base URL | Staging or preview W origin | Production W origin |
| Sentry environment and release | Staging and preview labels | Production label |
| Provider and webhook credentials | Non-production credentials | Production credentials |

Build arguments never carry runtime secrets. Pull requests from forks receive no protected environment credentials.
Logs, workflow outputs and deployment metadata must not print connection strings, tokens or private record contents.

## Rollback and recovery

- Application rollback selects the immediately preceding verified Railway deployment.
- A W rollback must verify compatibility with the current database schema before traffic is restored.
- M can roll back independently only when its HTTP contract remains compatible with W.
- Take a named production database backup before a risky migration.
- Do not run automatic down migrations during rollback.
- A failed staging refresh restores its previous backup or remains unavailable; it never falls back to production
  credentials.
- After recovery, rerun readiness, API, browser and MCP smoke tests and record the deployed commit.

## Activation checklist

The target workflow is active only after all of the following are true:

- Railway has persistent `staging` and `production` environments.
- W and M are connected to the GitHub repository with reviewed watch paths.
- Required GitHub CI checks pass reliably and Railway waits for them.
- Staging and production have distinct database services, domains and credentials.
- The production-to-staging refresh has completed at production scale.
- Sanitization tests prove private application data is absent from staging.
- The staging-schema lease blocks concurrent migration PRs and scheduled refreshes.
- Staging and production migration failure paths have been rehearsed.
- PR environments deploy and clean up automatically.
- W CDN behavior passes cache-hit and cache-bypass probes.
- W and M health, readiness, authentication and cross-runtime smoke checks pass in both persistent environments.
- Production deployment requires an explicit approval and reports the exact deployed commit.

W and M publish Railway's full `RAILWAY_GIT_COMMIT_SHA` on their public health and readiness responses and use it as
their Sentry release. Deployment smoke tests compare that value with `LEGISLATION_DEPLOYMENT_COMMIT_SHA` or
`GITHUB_SHA` and include the verified commit in their JSON output.

## Platform references

- [Railway monorepo deployments](https://docs.railway.com/deployments/monorepo)
- [Railway environments and PR environments](https://docs.railway.com/environments)
- [Railway GitHub autodeploys and Wait for CI](https://docs.railway.com/deployments/github-autodeploys)
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway cron jobs](https://docs.railway.com/cron-jobs)
- [Railway CDN](https://docs.railway.com/networking/cdn)
- [Railway volume backups](https://docs.railway.com/volumes/backups)
