# Authentication and MCP client setup

The service uses WorkOS's staging AuthKit environment for user-session and OAuth bearer tokens. The API accepts either
a WorkOS AuthKit user-session JWT or an M2M access token. M2M tokens are verified against `WORKOS_ISSUER` and
`WORKOS_JWKS_URL`; user sessions are independently verified against `WORKOS_SESSION_ISSUER` and
`WORKOS_SESSION_JWKS_URL`. User sessions must have the configured `client_id`, no `aud`, a nonempty session ID, and a
maximum 30-day lifetime. M2M tokens must also have the configured audience.
The protected MCP resource accepts only the configured M2M resource audience. Health and readiness remain public;
`/mcp` is protected. Development may use
`AUTH_MODE=disabled` only on a loopback or otherwise isolated endpoint.

The unified Next.js runtime authenticates supported and catch-all `/api/**` requests before endpoint code runs. A valid
token contributes only its verified user ID and optional organization ID to request context. Missing, malformed,
expired, incorrectly signed, wrong-issuer, or wrong-audience tokens receive the same canonical `401` error envelope and
`WWW-Authenticate: Bearer realm="legislation", error="invalid_token"` challenge. The production release gate requires
`AUTH_MODE=workos`; production startup rejects missing idempotency or webhook-secret encryption keys.

Use the WorkOS staging application identified by `WORKOS_CLIENT_ID`. Register the exact remote MCP resource URL and only
approved redirect URIs for the target clients. Enable Client ID Metadata Document support; enable Dynamic Client
Registration only for clients that require it. Register the exact MCP Resource Indicator; a default is needed only for
a client that omits `resource`. The resource
server validates bearer tokens from public
issuer, audience, and JWKS URLs, so it does not require a WorkOS client secret. Rotate signing keys in WorkOS; the bounded
JWKS cache refreshes them without an application code change. Any OAuth client credential belongs to the client and must
not be placed in this service image or configuration.

An MCP client should use the HTTPS `/mcp` URL. The service exposes OAuth protected-resource metadata at
`/.well-known/oauth-protected-resource/mcp`. AuthKit binds the access token to that URL through its `aud` claim. A 401
response means the token is missing, expired, malformed, wrong-audience, wrong-issuer, or incorrectly signed. Obtain a
fresh token and confirm the client is using the environment-specific resource URL. Client responses and logs
intentionally do not distinguish token failures in greater detail.

User and optional organization IDs flow through request context and trace metadata. Tokens, claims other than the two
stable IDs, queries over 2,000 characters, credentials, and full legislative text are not retained in traces.

## Public chat origin validation

Production `/chat` requests require an `Origin` matching the configured HTTPS `LEGISLATION_PUBLIC_API_BASE_URL`
and a `Host` matching that URL's authority. When no Host header is present, the request URL supplies the host.
Railway terminates TLS before Next.js, so the internal request URL's origin is not the browser's public origin.
Forwarded headers do not establish trust. Missing or foreign browser origins and mismatched hosts are rejected.

## Existing operational smoke credential

The Railway `legislation-web` service already has `WORKOS_SMOKE_CLIENT_ID` and `WORKOS_SMOKE_CLIENT_SECRET`.
Operators with service-variable access can exchange these existing credentials at the configured WorkOS issuer's
`/oauth2/token` endpoint using `grant_type=client_credentials`, then pass the short-lived access token in memory to
API smoke requests. Never print credentials or commit them. This machine-authenticated check is separate from
the AuthKit browser-session canary; the absence of a local `LEGISLATION_SMOKE_TOKEN` does not block machine API checks.

<a id="workos-mcp-resource-oauth-canary"></a>

<a id="workos-mcp-resource-oauth-canary--workos-mcp-resource-oauth-canary"></a>

## WorkOS MCP-resource OAuth canary

<a id="workos-mcp-resource-oauth-canary--purpose"></a>

### Purpose

This procedure proves that WorkOS can issue an MCP-resource access token and that the deployed legislation service
accepts it without weakening audience isolation. It is deliberately separate from the generic API smoke and uses an
independent MCP credential flow.

No step copies an access token into the repository, Railway variables, a shell history entry, or an agent transcript.
The user completes consent in their own browser. The operator retains only sanitized smoke output and correlation IDs.

<a id="workos-mcp-resource-oauth-canary--current-status"></a>

### Current status

The positive consent canary remains pending. Railway `legislation-web` deployment
`60895192-ae34-42ab-9b96-2142750aa73c` from commit `54852f9` reached `SUCCESS` and exposes
`https://legislation-web-production-b024.up.railway.app/mcp` through Next.js. Health, readiness and protected-resource
metadata returned `200`; anonymous and API-audience-token MCP requests returned `401`. These rejection checks do not
prove the browser-consent flow. `apps/legislation` is the canonical application home. Do not configure or
test a Resource Indicator against the deleted `legislation-api` service. That service is historical evidence only and is
neither current nor a rollback target.

This is retained deployment evidence, not a fresh live check. Confirm the active deployment and configured endpoint before
running the canary. Outbound MCP-to-API access uses its own dedicated
machine credential; it must never substitute for the incoming MCP-resource token. Final runtime cleanup remains gated
on positive deployed MCP acceptance.

<a id="workos-mcp-resource-oauth-canary--prerequisites"></a>

### Prerequisites

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

<a id="workos-mcp-resource-oauth-canary--browser-consent-mcp-canary"></a>

### Browser-consent MCP canary

1. Confirm the route/configuration prerequisites above, then in an MCP client the operator controls add the public Next.js `/mcp`
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

<a id="workos-mcp-resource-oauth-canary--authenticated-api-smoke-with-the-provisioned-api-session"></a>

### Authenticated API smoke with the provisioned API session

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

<a id="workos-mcp-resource-oauth-canary--stop-conditions"></a>

### Stop conditions

- Stop if WorkOS does not display a user consent screen, if the Resource Indicator differs by scheme, hostname, path,
  slash, query, or fragment, or if the returned audience is not the exact MCP endpoint.
- Stop if the operator would need to reveal a token, WorkOS API key, client secret, or browser session to an agent.
- Stop if the only available path is creating a lasting OAuth or M2M client for the canary. Escalate that product and
  identity-lifecycle decision instead.
