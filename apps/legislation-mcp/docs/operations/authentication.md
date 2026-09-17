# MCP authentication and consent

M is a standalone protected resource, using WorkOS staging AuthKit issuer/JWKS verification. It accepts only the exact
configured MCP resource audience, never W's API audience or browser-session tokens. Health/readiness and discovery are
public; `/mcp` is protected. [Runtime configuration](../../README.md) owns exact variables, host/origin checks, limits,
independent HTTPS origins and the dedicated outbound API credential. The caller's token is never forwarded or exchanged.
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

The positive consent canary remains pending. Standalone Railway deployment
`08e94031-e73e-4460-9ed2-ee0b91d9f67c` from clean commit `2ab6a85` reached `SUCCESS` at
`https://legislation-mcp-production.up.railway.app`. Health, readiness and protected-resource metadata return 200 and
advertise the exact standalone `/mcp` resource. Anonymous requests and a valid API-audience machine token both return
the expected 401 resource-metadata challenge. A device-authorization request accepted the exact resource indicator,
but its one-time operator consent window expired before token issuance, so no positive tool call or revocation is
claimed. No bearer token was printed, persisted or installed as a service variable.

The historical `legislation-web` deployment `60895192-ae34-42ab-9b96-2142750aa73c` exposed the former combined-app
resource at `https://legislation-web-production-b024.up.railway.app/mcp`. It is stale acceptance evidence after the
monorepo split, not a rollback target. The former `legislation-api` service is deleted.

Confirm the actual M service, public URL and WorkOS registration before cutover. Preserve the existing resource URL
when possible; a change requires coordinated metadata, registration and client updates, not fallback audiences or
authenticated redirects. Dedicated outbound credentials do not establish incoming MCP-resource consent or delegated
multi-user legal access. Protected legal calls fail closed unless outbound user and organization match the caller.

### Prerequisites

- Configure `WORKOS_API_AUDIENCE` for W API access and `WORKOS_MCP_AUDIENCE` for the exact public M endpoint.
- Publish canonical scoped metadata containing that resource value and WorkOS issuer.
- Register the exact Connect Resource Indicator and appropriate client metadata/registration support in WorkOS.
- Confirm healthy standalone M and W deployments at their independently configured HTTPS origins.

WorkOS documents that `resource` selects the token's `aud`; manually created M2M apps do not use the default Resource
Indicator. References: [MCP authentication](https://workos.com/docs/authkit/mcp),
[device authorization](https://workos.com/docs/reference/workos-connect/cli-auth/authorize-device).

### Browser-consent procedure

1. Add the confirmed public M `/mcp` endpoint to an operator-controlled MCP client, without pasting a token.
2. Start a read-only session; verify the 401 challenge, protected-resource discovery and WorkOS browser redirect.
3. The user signs in and explicitly consents. Do not automate, scrape or approve consent.
4. Invoke `search_bills` with a lexical query or `get_bill` with an approved fixture; retain status and correlation ID only.
5. Disconnect and revoke authorization unless this is an intended long-lived client.

Success requires an exact MCP-resource audience, not an environment-client-ID API audience. Never relax verification
to make a misconfigured flow pass. M's authenticated smoke and W's provisioned API-session smoke remain independent.

### Stop conditions

- No user consent screen, a resource mismatch in scheme/host/path/slash/query/fragment, or a wrong returned audience.
- Any need to reveal tokens, WorkOS API keys, client secrets or browser sessions to an agent.
- Any need to create a lasting OAuth/M2M client just for the canary: escalate the identity-lifecycle decision.

No new consent, deployed tool, revocation or infrastructure acceptance was performed for the docs move.
