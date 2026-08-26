# Authentication and MCP client setup

The service uses WorkOS's staging AuthKit environment for user-session and OAuth bearer tokens. The API accepts either
a WorkOS AuthKit user-session JWT or an M2M access token. User sessions are verified only with
`https://api.workos.com` and the JWKS at
`https://api.workos.com/sso/jwks/<WORKOS_CLIENT_ID>`; they must have the configured `client_id`, no `aud`, a nonempty
session ID, and a maximum 30-day lifetime. M2M tokens are verified against the configured issuer, JWKS, and audience.
The protected MCP resource accepts only the configured M2M resource audience. Health and readiness remain public;
`/mcp` is protected. Development may use
`AUTH_MODE=disabled` only on a loopback or otherwise isolated endpoint.

Use the WorkOS staging application identified by `WORKOS_CLIENT_ID`. Register the exact remote MCP resource URL and only
approved redirect URIs for the target clients. Enable Client ID Metadata Document support and Dynamic Client
Registration in WorkOS Connect, and configure the exact MCP endpoint as the default Resource Indicator. The resource
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
