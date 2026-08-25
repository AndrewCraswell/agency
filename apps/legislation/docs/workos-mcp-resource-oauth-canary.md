# WorkOS MCP-resource OAuth canary

## Purpose

This procedure proves that WorkOS can issue an MCP-resource access token and that the deployed legislation service
accepts it without weakening audience isolation. It is deliberately separate from the generic API smoke and uses an
independent MCP credential flow.

No step copies an access token into the repository, Railway variables, a shell history entry, or an agent transcript.
The user completes consent in their own browser. The operator retains only sanitized smoke output and correlation IDs.

## Current status

The canary is deliberately blocked. The current `legislation-web` deployment is
`cc047806-27f7-4110-a6e0-7f27f4b4e517` from commit `27fa397`, but it does not yet expose a live Next.js MCP route.
Do not configure or test a Resource Indicator against the deleted `legislation-api` service. That service is historical
evidence only and is neither current nor a rollback target.

Resume this procedure only after the Next.js MCP route is deployed and its exact public `/mcp` URL is known. MCP remains
last in the HTTP migration sequence, after API route migration, WorkOS authentication, and distributed rate limiting.

## Prerequisites

After the live Next.js MCP route exists, deploy the route-aware audience configuration and verify the deployment is
healthy:

- `WORKOS_API_AUDIENCE` is the WorkOS environment client ID used by M2M/API access tokens.
- `WORKOS_MCP_AUDIENCE` is the exact public Next.js MCP endpoint. Do not use a deleted-service URL or an audience
  fallback for this setting.
- The service publishes `/.well-known/oauth-protected-resource/mcp` with that exact resource value and the WorkOS
  issuer.
- In WorkOS Dashboard, add the exact MCP endpoint as a Connect Resource Indicator. Enable Client ID Metadata Document
  under Connect configuration. Enable Dynamic Client Registration only for clients that do not support Client ID
  Metadata Document. A default Resource Indicator is optional, but needed for a client that omits `resource`.

WorkOS documents that a configured Resource Indicator causes an OAuth request carrying that `resource` value to receive
an access token whose `aud` claim equals the resource. It also documents that manually created M2M applications do not
use the default Resource Indicator. See [WorkOS MCP authentication](https://workos.com/docs/authkit/mcp) and the
[device authorization endpoint](https://workos.com/docs/reference/workos-connect/cli-auth/authorize-device).

## Browser-consent MCP canary

1. Confirm the Current status gate is cleared, then in an MCP client the operator controls add the public Next.js `/mcp`
   endpoint. Do not paste an access token into the client.
2. Start a read-only session. The client should receive the server's `401` challenge, discover protected-resource
   metadata, and send the user to WorkOS in the browser.
3. The user signs in and explicitly consents in that browser. Do not automate, screen-scrape, or approve this step.
4. Invoke one read-only tool, preferably `search_bills` with a lexical query or `get_bill` for a known fixture. Record
   the response status and correlation ID only.
5. Disconnect the test client and revoke its authorization in WorkOS if this client is not an intended long-lived MCP
   client.

Success proves the MCP route accepts only a valid token whose audience is the MCP resource. A client receiving an
environment-client-ID token instead means the Resource Indicator or its `resource` parameter is misconfigured; do not
relax the MCP verifier to accept that token.

## Authenticated API smoke with the provisioned API session

The retained remote smoke credential is an externally provisioned, API-scoped AuthKit session. The generic API smoke
command sends it only to `/api` and never opens `/mcp`; keep the MCP browser-consent canary independent.

Run the smoke in the same terminal after the approved 30-day session is provisioned and API authentication is live on
`legislation-web`. `Read-Host -MaskInput` keeps the token out of command history and the harness redacts it from
diagnostics. Replace the two canonical fixture IDs with values approved for the remote smoke.

```powershell
$token = Read-Host 'Paste the provisioned 30-day API AuthKit session' -MaskInput
$env:LEGISLATION_SMOKE_BASE_URL = 'https://legislation-web-production-b024.up.railway.app'
$env:LEGISLATION_SMOKE_CANONICAL_API_BASE_URL = $env:LEGISLATION_SMOKE_BASE_URL
$env:LEGISLATION_SMOKE_PROFILE = 'scoped-bills'
$env:LEGISLATION_SMOKE_REQUIRE_AUTH = 'true'
$env:LEGISLATION_SMOKE_JURISDICTION_ID = 'jurisdiction:approved-fixture'
$env:LEGISLATION_SMOKE_SESSION_ID = 'session:approved-fixture'
$env:LEGISLATION_SMOKE_TOKEN = $token
pnpm --filter legislation smoke:api
Remove-Item Env:LEGISLATION_SMOKE_TOKEN
Remove-Variable token
```

Expected evidence is a passing scoped-bills report with no token in the report or diagnostics, plus the independent
MCP browser-consent canary. A `401` from `/api` means the provisioned API session or deployment configuration is wrong.
Do not substitute an M2M token for the smoke credential, even though M2M remains supported by runtime auth.

## Stop conditions

- Stop if WorkOS does not display a user consent screen, if the Resource Indicator differs by scheme, hostname, path,
  slash, query, or fragment, or if the returned audience is not the exact MCP endpoint.
- Stop if the operator would need to reveal a token, WorkOS API key, client secret, or browser session to an agent.
- Stop if the only available path is creating a lasting OAuth or M2M client for the canary. Escalate that product and
  identity-lifecycle decision instead.
