# Azure deployment

Each Azure environment uses its own resource group, virtual network, managed identities, storage account, Key Vault,
registry, and Container Apps environment. Development PostgreSQL runs in the Railway `legislation` project using the
PostgreSQL 18 pgvector image. Use `legislation-dev`, `legislation-stg`, and `legislation-prd` resource groups in
`westus2`; select another region only after confirming Container Apps availability.

Names begin with `leg-<environment>` and every resource carries application, environment, owner, cost-center, and
managed-by tags. Replace the zero production image digests with digests published by the release build, and replace
every `replace.invalid` WorkOS value before running the production what-if. The release checklist treats either
placeholder as a hard failure.

The deploying principal needs Resource Group Contributor, User Access Administrator, and Key Vault Administrator on the
target resource group so it can create resources, scoped role assignments, and initial secrets. It also needs permission
to push the image to the created registry. Runtime identities receive only their individual Key Vault secrets; only the
ingestion identity receives Blob Data Contributor.

Validate and preview:

```powershell
pnpm infra:build
pnpm infra:what-if development
```

Build the application image from its prepared production context. The shared monorepo lockfile includes private
dependencies belonging to other applications, so the registry build must not install the full workspace.

```powershell
pnpm container:prepare
az acr build --registry <registry-name> --image legislation:<tag> --file ../../.container/legislation/Dockerfile ../../.container/legislation
```

Set `DATABASE_URL` to Railway's public connection URL before previewing or deploying. The current development TCP proxy
does not advertise PostgreSQL TLS, so `development.bicepparam` disables n8n database SSL explicitly. This exception is
development-only; staging and production default to TLS and must use a TLS-capable database endpoint. Secure parameters
come from the deployment environment and are never stored in parameter files. Set the WorkOS issuer and JWKS URL as
non-secret deployment parameters. Bicep derives the OAuth audience from the deployed HTTPS MCP endpoint so protected
resource metadata and token validation cannot drift apart. Bicep stores the Railway URL and n8n database password in Key
Vault; n8n receives the documented PostgreSQL host, port, database, user, password, and TLS settings rather than an
unsupported connection-string variable. After deployment, run migrations as a one-off ingestion job, verify `/health`
and `/ready`, write and delete a test blob, query `select extversion from pg_extension where extname = 'vector'`, and
confirm structured logs in the Log Analytics workspace. Roll back application code by redeploying the preceding
immutable image digest; database migrations use forward fixes.

## Operational alerts

The deployment creates metric and log-query alerts for MCP 5xx responses, dependency readiness, failed job executions,
the Congress checkpoint, document failures, embedding backlog age, and MCP replica availability. Supply existing
legislation on-call action groups through `alertActionGroupIds`; an empty array leaves the rules visible and evaluable
but does not send notifications. `operationalAlertsEnabled` is the emergency global switch and defaults to `true`.

`scheduledSyncAlertsEnabled` defaults to `false` because checked-in n8n schedules are inactive during corpus bootstrap.
Set it to `true` in the same reviewed change that activates Congress synchronization. The checkpoint alert intentionally
requires an observed `congress`/`bills` checkpoint, so a new empty environment does not claim a stalled checkpoint.

After deployment, trigger and recover each alert in a disposable or staging target and retain the fired and resolved
records. Validate the combined alert, diagnostic, restore, and revision-recovery record with
`pnpm operations:verify -- <operational-evidence.json>`.
