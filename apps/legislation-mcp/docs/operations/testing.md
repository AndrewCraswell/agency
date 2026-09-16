# MCP tests

`pnpm --filter legislation-mcp test` runs Node/Vitest and SDK-client tests with fixture upstream HTTP and deterministic
signing keys. `pnpm --filter legislation-mcp test:coverage` covers the same ownership boundary. No database, Next build,
source parser, live WorkOS secrets or provider requests belong to M's unit profile.

Verify resource/API audience isolation, dedicated outbound token selection, identity mismatch denial, host/origin,
body/deadline/output limits, cancellation, paging, correlation and SDK shutdown. Distinct upstream and resource origins
must succeed without accepting request-controlled destinations or redirects.

## Built acceptance

`pnpm --filter legislation-mcp test:acceptance` runs local types, builds both SSR entries, then runs
`scripts/built-acceptance.test.mjs` with Node's test runner. After an existing build, run
`node --test scripts/built-acceptance.test.mjs` from the MCP directory without rebuilding.

The harness copies only `dist` to a temporary directory outside the workspace. It starts the actual `main.mjs` and
checks nonblank health, readiness and discovery JSON plus anonymous 401 responses. A separate child imports the built
`application.mjs` factories used by production for the authenticated SDK round trip. Generated local RSA keys validate
real signed tokens, including rejection of an API-audience token at the MCP resource.

Only the acceptance child receives injected keys and a fetch mapping from fixed public HTTPS origins to separate
loopback HTTP issuer/API fixtures. The production entry has no test environment switch and retains HTTPS validation.
The fixtures record the token exchange and bill request: the API receives its independently minted token, not the MCP
bearer, caller cookies/API keys or the issuer's client secret. Probes, tool discovery and rejected callers make no
outbound calls. The harness also checks clean shared-host shutdown.

Both children block non-loopback fetches, imports outside the copied artifact, Node SQLite and native addon loading.
The artifact audit rejects non-JavaScript assets and database/native dependencies in source maps. No database, live
WorkOS service, TLS bypass, new library or sibling application is needed.

The [README](../../README.md) owns standalone build/start and smoke commands. Root-coordinated M-to-W acceptance,
browser consent, revocation, deployed legal text and container image isolation remain separate release gates; the
built fixture test does not establish those results. M has no database profile.

See [root legislation verification](../../../legislation-web/docs/operations/testing.md#full-verification).