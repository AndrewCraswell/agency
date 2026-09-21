# MCP authentication and consent

M is a standalone protected resource, using WorkOS staging AuthKit issuer/JWKS verification. Interactive clients must
use the exact configured MCP resource audience. Staging may additionally allow one dedicated Connect M2M smoke client:
its API-audience token is accepted only when the verified subject exactly matches `WORKOS_MCP_M2M_CLIENT_ID`. The
outbound W client is explicitly forbidden from filling that role. Health/readiness and discovery are public; `/mcp` is
protected. [Runtime configuration](../../README.md) owns exact variables, host/origin checks, limits, independent HTTPS
origins and the dedicated outbound API credential. The caller's token is never forwarded or exchanged.
C supplies Node auth/context primitives; W owns [API and session policy](../../../legislation-web/docs/operations/authentication.md).

Register the exact resource URL and approved client redirect URIs in the staging application identified by
`WORKOS_CLIENT_ID`. Enable Client ID Metadata Document support; enable Dynamic Client Registration only for clients
that require it. A default Resource Indicator is needed only for clients omitting `resource`. Public issuer/audience/JWKS
verification needs no client secret. OAuth client credentials belong to clients, not the resource image; M's separate
outbound API credential has its own purpose. WorkOS key rotation is handled by the bounded JWKS cache.

Clients use the configured HTTPS `/mcp` URL and discover `/.well-known/oauth-protected-resource/mcp`. Missing, expired,
malformed, wrong-audience/issuer or incorrectly signed tokens receive the same 401 challenge. Refresh the token and check
the exact resource URL; do not expose diagnostic token details. Only verified user and optional organization IDs enter
request context. Tokens, other claims, credentials, queries over 2,000 characters and full legislative text are not traces.

## WorkOS MCP-resource OAuth canary

This independently proves resource-audience consent and tool access, not API smoke. The user completes consent in their
own browser. Never place tokens in the repository, service variables, shell history or agent transcript; retain only
sanitized status and correlation IDs.

### Retained deployment evidence

The positive consent canary completed on 2026-09-20 against
`https://legislation-mcp-production.up.railway.app/mcp`. VS Code completed WorkOS authorization and an authenticated
`list_jurisdictions` call returned live records through W. Health, readiness and protected-resource metadata returned
200 and advertised the exact standalone `/mcp` resource. No bearer token was printed, persisted or installed as a
service variable.

The former combined Azure Container App `leg-dev-mcp` and its app-specific identity and alerts were deleted after the
Railway MCP and ingestion-owned document relay passed production acceptance. The retired Azure endpoint is not a
rollback target. Azure Blob Storage, Document Intelligence and the OpenStates jobs have separate lifecycles.

Confirm the actual M service, public URL and WorkOS registration before cutover. Preserve the existing resource URL
when possible; a change requires coordinated metadata, registration and client updates, not fallback audiences or
authenticated redirects. Dedicated outbound credentials do not establish incoming MCP-resource consent or delegated
multi-user legal access. Protected legal calls fail closed unless outbound user and organization match the caller.

### Prerequisites

- Configure `WORKOS_API_AUDIENCE` for W API access and `WORKOS_MCP_AUDIENCE` for the exact public M endpoint.
- Publish canonical scoped metadata containing that resource value and WorkOS issuer.
- Register the exact Connect Resource Indicator and appropriate client metadata/registration support in WorkOS.
- Confirm healthy standalone M and W deployments at their independently configured HTTPS origins.

WorkOS resource tokens use the resource URL as `aud`. Connect M2M client-credentials tokens instead use the environment
API audience, so protected staging automation requires both that audience and the exact dedicated client subject. This
does not add a general fallback audience and does not change interactive consent. References:
[MCP authentication](https://workos.com/docs/authkit/mcp),
[device authorization](https://workos.com/docs/reference/workos-connect/cli-auth/authorize-device).

### Browser-consent procedure

1. Add the confirmed public M `/mcp` endpoint to an operator-controlled MCP client, without pasting a token.
2. Start a read-only session; verify the 401 challenge, protected-resource discovery and WorkOS browser redirect.
3. The user signs in and explicitly consents. Do not automate, scrape or approve consent.
4. Invoke `search_bills` with a lexical query or `get_bill` with an approved fixture; retain status and correlation ID only.
5. Disconnect and revoke authorization unless this is an intended long-lived client.

Interactive success requires the exact MCP-resource audience. Automated staging smoke requires the separately
configured M2M client subject and never accepts the outbound W client. M's authenticated smoke and W's provisioned
API-session smoke remain independent.

### Stop conditions

- No user consent screen, a resource mismatch in scheme/host/path/slash/query/fragment, or a wrong returned audience.
- Any need to reveal tokens, WorkOS API keys, client secrets or browser sessions to an agent.
- Any need to reuse the outbound W M2M client or accept an unlisted M2M subject.

Retain only sanitized deployment status, tool name and correlation evidence from future canaries.

## Railway deployment routing

M's Railway service watches `apps/legislation-mcp/**`, runtime dependencies under `packages/legislation-core/**`,
shared TypeScript configuration, the required vendored AI package and root package-manager metadata. Changes limited to
unrelated applications must be skipped. Validate both sides of this rule in Railway deployment history after changing
the watch list: an M-owned change must deploy M, while an unrelated application-only change must produce `SKIPPED`.
