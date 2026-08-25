# Legislation web application

`legislation-web` is the Next.js application and public API boundary for the Legislative Intelligence product. Its
explicit API Route Handlers live under `app/api` and reuse the domain, repository, and application-service code in
`apps/legislation`. During migration, the shell still consumes the deployed transitional `legislation` HTTP API for its
server-side readiness display; it never opens database connections or uses MCP as a product-data transport.

The initial scaffold landed in commit `03e1c7b` with Next.js `16.2.6`. The approved foundation upgrade is Next.js
`16.3.1`. The scaffold deliberately contains only a route shell and a server-side API readiness boundary; it does not
yet expose a research workflow, browser authentication, or any unpublished endpoint.

## Local use and deployment boundary

From the repository root, install the locked workspace graph and start the route shell with:

```powershell
pnpm install --filter legislation-web --frozen-lockfile
pnpm --filter legislation-web dev
```

`LEGISLATION_API_BASE_URL` is optional for the shell. When it is set, it must be the HTTP or HTTPS origin of the
deployed Legislation API; the value remains server-only and no API credential is exposed to the browser.

The API migration deploys this application as a new parallel Railway service named `legislation-web` after the
foundation passes and again after every endpoint block. The existing `apps/legislation` standalone service remains the
transitional API and rollback target until the migration and cutover gates pass. Browser authentication follows the
endpoint migration, then distributed rate limiting, with MCP moved last; the API base URL remains server-only during the
transition.

Start with the [frontend architecture and dependency record](docs/architecture.md).
