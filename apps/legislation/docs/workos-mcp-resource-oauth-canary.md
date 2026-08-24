# WorkOS MCP-resource OAuth canary

## Purpose

This procedure proves that WorkOS can issue an MCP-resource access token and that the deployed legislation service
accepts it without weakening audience isolation. It is deliberately separate from the M2M API smoke: a manually
created M2M application receives the environment API audience, not the MCP resource audience.

No step copies an access token into the repository, Railway variables, a shell history entry, or an agent transcript.
The user completes consent in their own browser. The operator retains only sanitized smoke output and correlation IDs.

## Prerequisites

Before the canary, deploy the route-aware audience configuration and verify the deployment is healthy:

- `WORKOS_API_AUDIENCE` is the WorkOS environment client ID used by M2M/API access tokens.
- `WORKOS_MCP_AUDIENCE` is the exact public MCP endpoint, currently
  `https://legislation-api-production-7096.up.railway.app/mcp`. During the transition, the existing
  `WORKOS_AUDIENCE` value is an accepted fallback for this MCP setting.
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

1. In an MCP client the operator controls, add the public `/mcp` endpoint. Do not paste an access token into the client.
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

## Authenticated API smoke with an MCP-resource token

The API intentionally also accepts the MCP-resource audience so a same-origin MCP-to-HTTP adapter can forward the
already verified caller token. Standard MCP clients do not normally expose their access token, and this procedure must
not attempt to extract it from their credential store.

If an explicit API proof with an MCP-resource token is required, the minimal user-owned action is to use an existing
OAuth Connect client with Authorization Code plus PKCE. Its authorization request must include the exact
`resource=https://legislation-api-production-7096.up.railway.app/mcp` parameter. The user finishes login and consent
in the browser, exchanges the returned code locally, and supplies the resulting short-lived token only to the current
PowerShell process. Do not create an M2M application for this purpose. Do not add a redirect URI, OAuth application,
or token handling code solely for a one-time canary without an explicit product decision.

Run the smoke in the same terminal after the token is acquired. `Read-Host -MaskInput` keeps the token out of command
history and the harness redacts it from diagnostics. Replace the two canonical fixture IDs with values approved for the
remote smoke.

```powershell
$token = Read-Host 'Paste the short-lived MCP-resource access token' -MaskInput
$env:LEGISLATION_SMOKE_BASE_URL = 'https://legislation-api-production-7096.up.railway.app'
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
MCP browser-consent canary. A `401` from `/api` after the route-aware deployment means the OAuth request did not obtain
the configured MCP-resource audience or the deployment configuration is wrong. A `401` from `/mcp` for an M2M token is
expected and confirms audience separation.

## Stop conditions

- Stop if WorkOS does not display a user consent screen, if the Resource Indicator differs by scheme, hostname, path,
  slash, query, or fragment, or if the returned audience is not the exact MCP endpoint.
- Stop if the operator would need to reveal a token, WorkOS API key, client secret, or browser session to an agent.
- Stop if the only available path is creating a lasting OAuth or M2M client for the canary. Escalate that product and
  identity-lifecycle decision instead.
