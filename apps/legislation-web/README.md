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

## Deployed smoke profiles

The foundation smoke requires the deployed application origin and checks `/health`, `/ready`, the placeholder page, and
unsupported-route behavior. It makes no authenticated requests.

```powershell
$env:LEGISLATION_WEB_SMOKE_BASE_URL = "https://example.up.railway.app"
pnpm --filter legislation-web smoke:foundation
```

After the NX-02A jurisdictions and sessions release, set `LEGISLATION_WEB_SMOKE_NX_02A` to `1` to cumulatively check its
eleven public routes against `jurisdiction:ak` and `session:ak:30`. The profile validates response status, JSON content
type, correlation propagation, and the documented Page or Resource envelope. A canonical `404 not_found` for one of
those fixtures is reported as `fixture_missing`; an unstructured or otherwise invalid 404 fails the smoke. It also
checks that an unknown API path and a trailing-slash API path return canonical `404 not_found` responses without a
redirect.

```powershell
$env:LEGISLATION_WEB_SMOKE_NX_02A = "1"
pnpm --filter legislation-web smoke:foundation
```

After NX-02B is deployed, set `LEGISLATION_WEB_SMOKE_NX_02B` to `1`. This cumulative profile also runs NX-02A, then
checks all 18 bills, amendments, and votes routes. It uses no embedded record identifiers. Configure only the fixture
IDs available in the target deployment; every route that needs an omitted ID is reported as an explicit
`fixture_not_configured` skip. A configured fixture that returns a canonical `404 not_found` is reported as
`fixture_missing`; malformed errors, Pages, Resources, or Batch responses fail the smoke.

`LEGISLATION_WEB_SMOKE_BILL_ID` covers the bill detail, seven bill child collections, and both bill batch routes.
`LEGISLATION_WEB_SMOKE_AMENDMENT_ID` covers amendment detail and its batch route. `LEGISLATION_WEB_SMOKE_VOTE_ID` covers
vote detail, positions, and its batch route. Values are trimmed, never emitted in the report, URI-encoded before
requesting, and reject control characters or values longer than 256 characters. The profile verifies correlation-ID
propagation, JSON envelopes, documented request methods, `cache-control: private, no-store`, and ETag conditional `304`
responses for every NX-02B `GET` that returns a canonical `200`. Routes skipped because their fixture is not configured
or is missing do not perform the cache and ETag check; configure a known deployed fixture before treating that
endpoint's cache behavior as verified. It also verifies canonical no-redirect trailing-slash `404` responses for the
three collection roots.

```powershell
$env:LEGISLATION_WEB_SMOKE_NX_02B = "1"
$env:LEGISLATION_WEB_SMOKE_BILL_ID = "bill:approved-fixture"
$env:LEGISLATION_WEB_SMOKE_AMENDMENT_ID = "amendment:approved-fixture"
$env:LEGISLATION_WEB_SMOKE_VOTE_ID = "vote:approved-fixture"
pnpm --filter legislation-web smoke:foundation
```

After NX-02C is deployed, set `LEGISLATION_WEB_SMOKE_NX_02C` to `1`. This cumulative profile runs NX-02A and NX-02B,
then checks all nine document, supporting-material, change-feed, and resource-batch routes. It keeps fixture IDs out of
the report and URI-encodes them before use. Configure `LEGISLATION_WEB_SMOKE_DOCUMENT_ID`,
`LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID`, `LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID`, and
`LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID` only when each value is available in the deployed target.
Fixture-bound routes without their required values report `fixture_not_configured`; canonical `404 not_found` responses
for configured fixtures report `fixture_missing`; malformed responses fail the smoke.

The profile checks the exact Page and Resource envelopes, correlation-ID propagation,
`cache-control: private, no-store`, and ETag conditional `304` behavior for every NX-02C `GET` that returns `200`. Its
one `POST /api/resources/batch` request includes document and supporting-material fixtures plus a deliberately missing
document item. The supporting-material item must succeed and the missing item must return `not_found`; the configured
document may either succeed or return the exact `dependency_unavailable`, retryable per-item mapping used when canonical
document projection is incomplete. The supporting-material collection probe uses the indexed `jurisdiction:us` and
`committee-report` scope. The document detail, document-section collection, and global change-feed probes may report an
exact canonical `422 unprocessable` as a `canonical_data_incomplete` skip when document processing metadata or
change-event source provenance is incomplete. Document-section detail remains a required successful Resource response.
Response messages and record identities are never emitted, and any malformed `422` or batch item fails the smoke.

```powershell
$env:LEGISLATION_WEB_SMOKE_NX_02C = "1"
$env:LEGISLATION_WEB_SMOKE_DOCUMENT_ID = "document:approved-fixture"
$env:LEGISLATION_WEB_SMOKE_DOCUMENT_SECTION_ID = "document-section:approved-fixture"
$env:LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_ID = "supporting-material:approved-fixture"
$env:LEGISLATION_WEB_SMOKE_SUPPORTING_MATERIAL_SECTION_ID = "supporting-material-section:approved-fixture"
pnpm --filter legislation-web smoke:foundation
```

Start with the [frontend architecture and dependency record](docs/architecture.md).
