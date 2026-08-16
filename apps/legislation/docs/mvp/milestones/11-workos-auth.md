# Milestone 11: WorkOS authentication

## Goal

Secure the remote MCP endpoint with WorkOS while carrying future tenant context through the application.

## Tasks

### WorkOS configuration

- [ ] **M11.1** Create or select separate WorkOS configuration for development, staging, and production.
- [ ] **M11.2** Configure allowed redirect URIs and the remote MCP resource or audience.
- [ ] **M11.3** Define the required OAuth scopes and keep them minimal for the public corpus.
- [ ] **M11.4** Store WorkOS secrets in Key Vault and load them through the runtime configuration boundary.
- [ ] **M11.5** Document credential rotation without application code changes.

### Token validation

- [ ] **M11.6** Implement bearer-token extraction only on protected routes.
- [ ] **M11.7** Validate issuer, audience, signature, expiry, and required claims.
- [ ] **M11.8** Cache verification keys safely with bounded refresh behavior.
- [ ] **M11.9** Distinguish missing, malformed, expired, and invalid tokens without leaking sensitive detail.
- [ ] **M11.10** Define behavior when WorkOS verification infrastructure is temporarily unavailable.

### Identity context

- [ ] **M11.11** Map WorkOS `user.id` to the application request context.
- [ ] **M11.12** Map WorkOS organization identity when present without requiring it for every valid request.
- [ ] **M11.13** Carry user and organization IDs through MCP handlers and query-service context.
- [ ] **M11.14** Add identity and organization fields to logs and traces using documented privacy rules.
- [ ] **M11.15** Avoid maintaining passwords or a redundant local user directory.
- [ ] **M11.16** Reserve an authorization-policy boundary for future private tenant data without implementing that data now.

### Security verification

- [ ] **M11.17** Verify health and readiness endpoint exposure matches the deployment policy.
- [ ] **M11.18** Verify anonymous MCP requests fail.
- [ ] **M11.19** Verify expired, wrong-audience, wrong-issuer, and tampered tokens fail.
- [ ] **M11.20** Verify an authenticated user can discover and call every authorized tool.
- [ ] **M11.21** Verify organization identity reaches logs and Langfuse traces when present.
- [ ] **M11.22** Verify no token, secret, or sensitive claim value is emitted to logs or client errors.
- [ ] **M11.23** Document client setup and common authentication failure recovery.

## Exit criteria

- Anonymous and invalid requests cannot access the corpus.
- Valid WorkOS users can call the MCP tools.
- User and optional organization identity are available throughout the request without a second identity system.

