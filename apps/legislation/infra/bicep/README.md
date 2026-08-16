# Azure deployment

Each environment uses its own resource group, virtual network, managed identities, database server, storage account, Key
Vault, registry, and Container Apps environment. PostgreSQL has no public endpoint: its delegated subnet and private DNS
zone are reachable by the VNet-integrated Container Apps environment. Use `legislation-dev`, `legislation-stg`, and
`legislation-prd` resource groups in `westus2`; select another region only after confirming Container Apps and
PostgreSQL Flexible Server availability.

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

Deploy by replacing `what-if` with `create`. Secure parameters come from the deployment environment and are never stored
in parameter files. Set the WorkOS issuer, audience, and JWKS URL as non-secret deployment parameters. The application
and n8n use discrete Key Vault secret references; n8n uses the documented PostgreSQL host, database, user, password, and
TLS settings rather than an unsupported connection-string variable. After deployment, run migrations as a one-off
ingestion job, verify `/health` and `/ready`, write and delete a test blob, query
`select extversion from pg_extension where extname = 'vector'`, and confirm structured logs in the Log Analytics
workspace. Roll back application code by redeploying the preceding immutable image digest; database migrations use
forward fixes.
