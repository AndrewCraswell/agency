# API and session authentication

The service uses WorkOS's staging AuthKit environment for user-session and OAuth bearer tokens. The API accepts either
a WorkOS AuthKit user-session JWT or an M2M access token. M2M tokens are verified against `WORKOS_ISSUER` and
`WORKOS_JWKS_URL`; user sessions are independently verified against `WORKOS_SESSION_ISSUER` and
`WORKOS_SESSION_JWKS_URL`. User sessions must have the configured `client_id`, no `aud`, a nonempty session ID, and a
maximum 30-day lifetime. M2M tokens must also have the configured audience.
M owns [MCP resource authentication and client setup](../../../legislation-mcp/docs/operations/authentication.md).
W health/readiness remain public. W development may use
`AUTH_MODE=disabled` only on a loopback or otherwise isolated endpoint.

The W Next.js runtime authenticates supported and catch-all `/api/**` requests before endpoint code runs. A valid
token contributes only its verified user ID and optional organization ID to request context. Missing, malformed,
expired, incorrectly signed, wrong-issuer, or wrong-audience tokens receive the same canonical `401` error envelope and
`WWW-Authenticate: Bearer realm="legislation", error="invalid_token"` challenge. The production release gate requires
`AUTH_MODE=workos`; production startup rejects missing idempotency or webhook-secret encryption keys.

W and M compose C's shared verification primitives with their own settings. Public issuer/JWKS verification requires
no client secret; the bounded cache handles signing-key rotation. M owns resource registration and its independently
acquired outbound API credential. W never accepts M's resource audience as an API credential.

User and optional organization IDs flow through request context and trace metadata. Tokens, claims other than the two
stable IDs, queries over 2,000 characters, credentials, and full legislative text are not retained in traces.

## Public chat origin validation

Production `/chat` requests require an `Origin` matching the configured HTTPS `LEGISLATION_PUBLIC_API_BASE_URL`
and a `Host` matching that URL's authority. When no Host header is present, the request URL supplies the host.
Railway terminates TLS before Next.js, so the internal request URL's origin is not the browser's public origin.
Forwarded headers do not establish trust. Missing or foreign browser origins and mismatched hosts are rejected.

## Existing operational smoke credential

Historical setup recorded `WORKOS_SMOKE_CLIENT_ID` and `WORKOS_SMOKE_CLIENT_SECRET` on Railway's `legislation-web`
service. Verify their current provisioning and audience before use; this audit did not inspect service variables.
Operators with service-variable access can exchange those credentials at the configured WorkOS issuer's
`/oauth2/token` endpoint using `grant_type=client_credentials`, then pass the short-lived access token in memory to
API smoke requests. Never print credentials or commit them. This machine-authenticated check is separate from
the AuthKit browser-session canary; the absence of a local `LEGISLATION_SMOKE_TOKEN` does not block machine API checks.

## WorkOS MCP-resource OAuth canary

The [canonical M procedure](../../../legislation-mcp/docs/operations/authentication.md#workos-mcp-resource-oauth-canary)
owns registration, retained deployment/rejection evidence, operator consent and stop conditions. Positive consent is
still pending; outbound API credentials and anonymous/wrong-token rejection do not prove it.

<a id="workos-mcp-resource-oauth-canary--authenticated-api-smoke-with-the-provisioned-api-session"></a>

### Authenticated API smoke with the provisioned API session

The retained remote smoke credential is an externally provisioned, API-scoped AuthKit session. The generic API smoke
command sends it only to `/api` and never opens `/mcp`; keep the MCP browser-consent canary independent.

Run the smoke in the same terminal after the approved 30-day session is provisioned and API authentication is live on
`legislation-web`. `Read-Host -MaskInput` keeps the token out of command history and the harness redacts it from
diagnostics. Replace the two canonical fixture IDs with values approved for the remote smoke.

```powershell
$token = Read-Host 'Paste the provisioned 30-day API AuthKit session' -MaskInput
$env:LEGISLATION_SMOKE_BASE_URL = Read-Host 'Audited current HTTPS web origin'
$env:LEGISLATION_SMOKE_CANONICAL_API_BASE_URL = $env:LEGISLATION_SMOKE_BASE_URL
$env:LEGISLATION_SMOKE_PROFILE = 'scoped-bills'
$env:LEGISLATION_SMOKE_REQUIRE_AUTH = 'true'
$env:LEGISLATION_SMOKE_JURISDICTION_ID = 'jurisdiction:approved-fixture'
$env:LEGISLATION_SMOKE_SESSION_ID = 'session:approved-fixture'
$env:LEGISLATION_SMOKE_TOKEN = $token
pnpm --filter legislation-web smoke:api
Remove-Item Env:LEGISLATION_SMOKE_TOKEN
Remove-Variable token
```

Expected evidence is a passing scoped-bills report with no token in the report or diagnostics, plus the independent
MCP browser-consent canary. A `401` from `/api` means the provisioned API session or deployment configuration is wrong.
Do not substitute an M2M token for the smoke credential, even though M2M remains supported by runtime auth.

