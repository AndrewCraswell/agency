# MCP diagnostic telemetry

The standalone MCP entry point initializes the official Sentry Node SDK before importing the application/server.
Set `SENTRY_DSN` on the MCP runtime, with `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` identifying the deployment.
No credential values belong in source control. A missing DSN disables export; successful tests do not establish
production configuration. Startup failures and graceful shutdown flush queued events.

Tool spans carry the operation and request correlation ID. Failure events cover registry validation, tool execution,
handled batch-item errors, response serialization, SDK protocol errors, application request failures and startup.
Events include tool, category, stage, duration when available, sanitized selection inputs, upstream error details,
stack/cause information and SQLSTATE when retained by an upstream cause. HTTP responses keep `x-correlation-id` so
operators can search that value in Sentry. API-level diagnostics must retain their own correlation IDs; MCP cannot
recover SQL details already discarded by the remote API.

Headers, credentials, cookies, source text and response bodies are excluded. Strings and collections are bounded,
cyclic objects are handled, URL credentials are removed, and automatic event request/user payloads are removed.
Do not enable unrestricted request-body logging to investigate retrieval failures.

The unit acceptance test uses the actual SDK with an in-memory transport and asserts correlation, stack, duration,
tool and SQLSTATE retention plus redaction. A development export on 2026-09-17 produced Sentry issue
`LEGISLATION-10`, correlation `0b5328c2-82d9-4bb3-a17d-9a6adfa2dd84`, marked as a controlled acceptance probe.
This confirms local SDK delivery, not a production MCP deployment. Production acceptance must check the deployed
release/source maps and one controlled telemetry request through authenticated MCP transport.

The staging deployment smoke obtains a short-lived bearer through WorkOS `client_credentials`; it never stores or
copies a user bearer. It sends the controlled telemetry request only when all of these guards hold: the exact
canonical staging MCP origin is selected, the telemetry environment is explicitly `staging`, and the commit, Railway
project, environment, service and deployment identifiers are present. A staging-only control header is accepted only
from the exact dedicated M2M subject. The request includes a synthetic redaction sentinel so the smoke can reject any
response that echoes it; runtime telemetry applies the normal redaction policy and retains only the marker, commit and
Railway deployment context. A missing guard, machine credential, fixture, readiness match or expected response blocks
the workflow.

The staging services still require external configuration. Set M's `SENTRY_DSN` and `SENTRY_ENVIRONMENT=staging`;
set W's `NEXT_PUBLIC_SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging`. GitHub's protected `staging`
environment supplies `RAILWAY_TOKEN`, `WORKOS_API_SMOKE_CLIENT_ID`, `WORKOS_API_SMOKE_CLIENT_SECRET`,
`WORKOS_MCP_SMOKE_CLIENT_ID`, `WORKOS_MCP_SMOKE_CLIENT_SECRET`, and `SENTRY_STAGING_AUTH_TOKEN`. Environment variables
supply `WORKOS_API_SMOKE_ISSUER`, `LEGISLATION_SMOKE_BILL_ID`, `SENTRY_ORGANIZATION_SLUG`, and
`SENTRY_MCP_PROJECT_SLUG`. Staging M also sets `WORKOS_MCP_M2M_CLIENT_ID` to the same dedicated incoming client ID.
WorkOS Connect M2M tokens use the environment API audience, so M accepts that audience only for this exact verified
client subject. Never reuse the outbound M-to-W client, production or user credentials, tokens, or DSNs.

Provision the machine client outside this repository in the staging WorkOS environment:

1. Create a dedicated Connect machine-to-machine OAuth client for incoming staging smoke, not the existing outbound
   M-to-W client and not an AuthKit user application.
2. Register `https://legislation-mcp-staging.up.railway.app/mcp` as the exact Resource Indicator for interactive MCP
   clients. Connect M2M tokens retain the environment API audience; M additionally verifies the exact dedicated client
   subject before accepting that audience.
3. Confirm the staging MCP protected-resource metadata advertises the same WorkOS issuer used by that client.
4. Store the issued client ID and secret as the protected GitHub `staging` environment secrets named above, and set
   staging M's `WORKOS_MCP_M2M_CLIENT_ID` to that client ID. Do not store an access token; the workflow requests a
   bounded short-lived token for each run.
5. Rotate the client secret in WorkOS and GitHub together, then rerun the staging workflow.

W's API smoke likewise uses a dedicated staging WorkOS M2M client and obtains a short-lived token from
`WORKOS_API_SMOKE_ISSUER`; no static API bearer is stored. The controlled MCP request carries only the synthetic
`legislation-staging-<run>-<attempt>` marker plus deployment identifiers. MCP tags the event, requests a five-second
Sentry flush, and the workflow polls Sentry's read-only project events API for the exact tag. The Sentry token requires
only event/project read access.

Provision W's smoke client in the same staging WorkOS environment. Associate it with the staging smoke organization,
confirm its client-credentials token `aud` matches W's configured `WORKOS_API_AUDIENCE`, store its credential as
`WORKOS_API_SMOKE_CLIENT_ID` and `WORKOS_API_SMOKE_CLIENT_SECRET`, and set `WORKOS_API_SMOKE_ISSUER` to the
credential-free staging AuthKit issuer. This client is independent of M's outbound M-to-W credential.

To repeat only the external ingestion check after the canary has executed:

```powershell
$env:LEGISLATION_SENTRY_CANARY_MARKER = 'legislation-staging-<run-id>-<attempt>'
$env:SENTRY_ORGANIZATION_SLUG = '<organization-slug>'
$env:SENTRY_MCP_PROJECT_SLUG = '<project-slug>'
$env:SENTRY_STAGING_AUTH_TOKEN = '<read-only-token>'
pnpm --filter legislation-mcp verify:sentry-canary
```