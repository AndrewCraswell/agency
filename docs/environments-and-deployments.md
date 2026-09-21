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

This is the target operating model. Production and staging W and M are live. Staging has an initialized primary
database, passage-search database and PgBouncer with one deterministic synthetic acceptance fixture. No production
records have been copied and production data refresh remains disabled. Staging W deploys only after the exact `main`
commit passes CI. Staging M has dedicated inbound smoke and outbound W WorkOS credentials. Its authenticated tool smoke
and controlled Sentry canary passed protected acceptance, so automatic deployment is enabled after successful CI.
Railway CDN caching is enabled for W in both environments.

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
| `pgvector` | Writable staging primary database; synthetic-only until production refresh is approved |
| `legislation-passage-search` | Writable staging search database rebuilt from the staging primary |
| PgBouncer | Staging runtime connection pooling where required |

Creating the Railway environment copies service configuration, not database contents. The staging databases must be
provisioned with their own volumes and populated by the refresh workflow.

The cost-controlled staging bootstrap applies both canonical schemas and uses smaller resource limits than production.
One clearly named synthetic bill, document and section exercise the real passage replication and BM25 query paths.
Passage search is enabled against that synthetic corpus. No production records are copied, so broad data-quality and
production-scale refresh acceptance remain deferred until that work is funded.

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
The CI `changes` job compares a pull request with its base commit and a `main` push with its preceding commit. It emits
`web`, `mcp`, `core`, `database` and `ingestion` outputs through
`scripts/legislation-change-detection.mjs`. Its routing contract is covered by representative path tests.

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

The existing root `pnpm verify` remains the required code-quality gate. Package publication is a manually dispatched
workflow, so it cannot grant or block application deployment. If publication intentionally becomes a release
prerequisite later, the deployment workflow must declare that dependency explicitly rather than relying on another
push-triggered check suite.
The repository `.npmrc` intentionally routes developer installs through the Azure Artifacts proxy because the public
npm registry is unavailable on the work VPN. The proxy contains no repository-only packages. GitHub-hosted workflows
therefore install the pinned pnpm version with npm's explicit public-registry command-line option, then set pnpm's
higher-precedence `PNPM_CONFIG_REGISTRY` environment override for repository installs. Package publication also sets
`NPM_CONFIG_REGISTRY` to the public registry. GitHub does not receive Azure registry credentials, and the committed
developer configuration remains unchanged. Railway Docker builds use the public registry explicitly or omit the
repository `.npmrc` from their build context.
GitHub also caps Vitest at two workers so interaction-heavy browser tests do not compete for the hosted runner's limited
CPU; local development retains the repository default.

### Deployment controls

GitHub environments named `staging` and `production` own separate Railway project tokens scoped to their matching
Railway environments. Both accept deployments only from `main`; forked pull requests therefore cannot enter either
environment or read their secrets. Production additionally requires reviewer approval before its jobs start. The
repository is public so these protection rules are available on the current GitHub plan.

Environment mutations and deployments use these repository-wide, non-cancelling concurrency groups:

| Operation | Concurrency group |
| --- | --- |
| Staging database refresh or migration | `legislation-staging-database-mutation` |
| Staging application deployment | `legislation-staging-deployment` |
| Production database migration | `legislation-production-migration` |
| Production application deployment | `legislation-production-deployment` |

The manually dispatched `Legislation deployment lock canary` workflow exercises the same environment names, credentials
and lock names. Dispatching the same operation twice must leave the second run queued until the first releases its lock.
Active work is never cancelled by a newer run. The credential check may be disabled only for a lock-only canary.

### Merge to `main`

The staging deployment workflow runs only after the required CI workflow succeeds for the exact commit. It uses the
protected `staging` GitHub environment and the non-cancelling `legislation-staging-deployment` lock. Database-contract
changes fail closed until the protected staging migration workflow is implemented. Staging M changes are reported but
deploy automatically only when `LEGISLATION_STAGING_MCP_ENABLED=true`. That gate is enabled after protected run
`35599431733` deployed commit `cbfda3ecc4f022d03c82492ee9058f28dbc6f615` and passed readiness, authenticated MCP
tool smoke and exact-tag Sentry canary verification. The live staging M service uses separate dedicated credentials for
incoming smoke and outbound W authentication.

The complete target release sequence is:

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

The manual `Legislation production deployment` workflow implements steps 6 through 11. An operator supplies a full
`main` commit SHA and selects W, M and migration operations. Before the protected approval gate appears, the workflow
proves that one successful staging run exercised every selected service at that exact SHA. GitHub's `production`
environment requires an authorized reviewer. After approval, a selected migration creates and waits for a named Railway
volume backup, acquires the PostgreSQL schema-migration advisory lock through the direct administrative URL, and applies
canonical migrations with a finite timeout. W deploys and passes readiness, API, browser and CDN checks before M can
deploy and pass discovery, anonymous-rejection and authenticated tool smoke.

Production rollback is also manual and uses the same non-cancelling deployment lock and protected reviewer gate. The
application rollback workflow accepts only an ancestor commit. A W rollback is rejected when it crosses a database
contract change; M may roll back independently. The database recovery workflow requires an explicit backup ID, refuses
to combine a restore with pre-existing Railway staged changes, restores the primary volume, reapplies canonical forward
migrations, and verifies W before M. No workflow runs a down migration. An ordinary forward fix uses the production
deployment workflow with migration enabled.

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

### Protected staging refresh

Railway volume backups cannot be restored across environments, so the manual `Legislation staging database refresh`
workflow performs a PostgreSQL-level copy through protected endpoints. It reads production through the TLS-only,
read-only refresh role, writes to staging with separate target credentials and has no schedule or push trigger. The
workflow and credentials are ready, but it has not been dispatched and no production content has been copied to
staging.

The in-place refresh uses an explicit staging maintenance window:

1. Acquire the refresh lock and verify that no migration PR owns staging.
2. Mark staging unready.
3. Terminate stale staging connections and clear policy-owned target tables.
4. Copy approved primary tables in one exported source snapshot.
5. Clear private and operational data while preserving staging-owned configuration.
6. Seed deterministic synthetic fixtures.
7. Rebuild the passage-search database from the refreshed primary.
8. Validate extensions, migration state, record counts, foreign keys, sanitization and search.
9. Restore staging W and M to their recorded topology.
10. Run W readiness and authenticated M smoke tests.
11. Mark staging ready and release the refresh lock.

The copy implementation streams PostgreSQL binary `COPY` directly between servers. Its tested fallback streams
`pg_dump` into `pg_restore` without writing a complete dump to runner disk. The first explicitly approved,
production-sized rehearsal determines safe resource limits and timeout before any schedule is considered.

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

The protected GitHub `production` environment stores the direct URL as
`LEGISLATION_PRODUCTION_MIGRATION_DATABASE_URL`. It also owns independent API and MCP smoke-client secrets and the
production WorkOS issuer. These credentials are requested only after approval and are never exposed as workflow
outputs.

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
| `/representatives` | Static public HTML emits a shared freshness directive. | Cache in `Auto` mode using the origin header. |
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

Staging M is deployed from the same repository-owned Docker contract as production. Its health, readiness,
protected-resource discovery, anonymous rejection and dedicated outbound WorkOS client-credentials path have passed.
The synthetic staging bill is the approved tool fixture. The user-consent MCP tool canary remains a separate
operator-controlled OAuth step.

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
- Operators may select an older verified ancestor explicitly when incident analysis requires it; the workflow records
  the exact target SHA and rejects W rollback across database-contract changes.
- A W rollback must verify compatibility with the current database schema before traffic is restored.
- M can roll back independently only when its HTTP contract remains compatible with W.
- Take a named production database backup before a risky migration.
- Do not run automatic down migrations during rollback.
- A failed staging refresh restores its previous backup or remains unavailable; it never falls back to production
  credentials.
- After recovery, rerun readiness, API, browser and MCP smoke tests and record the deployed commit.
- Forward recovery applies a new canonical migration. Backup recovery is a separate, typed-confirmation workflow and
  fails if unrelated Railway staged changes are present.

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
