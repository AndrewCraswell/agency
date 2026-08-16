# Authentication and MCP client setup

Production and staging use WorkOS OAuth bearer tokens. The protected resource is the public MCP endpoint, the required
scope is `legislation:read`, and the application validates the RS256 signature, issuer, audience, expiry, subject, and
scope against a bounded remote JWKS cache. Health and readiness remain public; `/mcp` is protected. Development may use
`AUTH_MODE=disabled` only on a loopback or otherwise isolated endpoint.

Create separate WorkOS applications for development, staging, and production. Register the exact remote MCP resource
URL and only approved redirect URIs for the target clients. The resource server validates bearer tokens from public
issuer, audience, and JWKS URLs, so it does not require a WorkOS client secret. Rotate signing keys in WorkOS; the bounded
JWKS cache refreshes them without an application code change. Any OAuth client credential belongs to the client and must
not be placed in this service image or configuration.

An MCP client should use the HTTPS `/mcp` URL and request `legislation:read`. The service exposes OAuth protected-resource
metadata at `/.well-known/oauth-protected-resource/mcp`. A 401 response means the token is missing, expired, malformed,
wrong-audience, wrong-issuer, incorrectly signed, or missing the scope. Obtain a fresh token and confirm the client is
using the environment-specific resource URL. Client responses and logs intentionally do not distinguish token failures
in greater detail.

User and optional organization IDs flow through request context and trace metadata. Tokens, claims other than the two
stable IDs, queries over 2,000 characters, credentials, and full legislative text are not retained in traces.
