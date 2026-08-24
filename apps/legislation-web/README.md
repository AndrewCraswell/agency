# Legislation web application

`legislation-web` is the Next.js application boundary for the Legislative Intelligence product. It consumes the deployed
`legislation` HTTP API rather than database connections or MCP tools.

The initial scaffold deliberately contains only a route shell and a server-side API readiness boundary. It does not yet
expose a research workflow, browser authentication, or any unpublished endpoint.

## Local use and deployment boundary

From the repository root, install the locked workspace graph and start the route shell with:

```powershell
pnpm install --filter legislation-web --frozen-lockfile
pnpm --filter legislation-web dev
```

`LEGISLATION_API_BASE_URL` is optional for the shell. When it is set, it must be the HTTP or HTTPS origin of the
deployed Legislation API; the value remains server-only and no API credential is exposed to the browser.

This application intentionally has no Railway configuration, Dockerfile, or deployment command yet. It is not part of
the API service deployment at `apps/legislation`; configure a separate frontend deployment only when browser
authentication and a production API base URL are ready.

Start with the [frontend architecture and dependency record](docs/architecture.md).
