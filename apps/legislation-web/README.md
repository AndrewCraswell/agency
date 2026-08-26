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

After NX-03A is deployed, set `LEGISLATION_WEB_SMOKE_NX_03A` to `1`. This cumulative profile runs NX-02A, NX-02B, and
NX-02C before checking all 14 people and organization routes. It embeds no production civic IDs. Configure only audited
values from the target deployment through `LEGISLATION_WEB_SMOKE_PERSON_ID`, `LEGISLATION_WEB_SMOKE_TERM_ID`,
`LEGISLATION_WEB_SMOKE_ORGANIZATION_ID`, and `LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID`. The term must belong to the person,
and the current production membership fixture is an audited deliberately missing ID.

The profile always checks the people and organization collections. Fixture-bound detail and relationship routes report
`fixture_not_configured` when their required environment value is absent. Only organization-membership detail may report
`fixture_missing`, and only for a canonical `404 not_found`; a configured `404` from any other NX-03A route fails the
smoke. Person detail, person-term detail, the organization collection, and organization detail may instead report an
exact canonical `422 unprocessable` as `canonical_data_incomplete` while audited production rows lack required canonical
facts. No other NX-03A route accepts `422`. Every successful route must return its exact Page or Resource envelope,
preserve the correlation ID, use `cache-control: private, no-store`, and satisfy an ETag conditional `304`. Empty Pages
remain successful canonical responses. The nested static `terms` and `memberships` paths are exercised with URI-encoded
IDs, and trailing slashes on the two collection roots must return a canonical no-redirect `404`. Fixture IDs and error
messages never appear in the JSON report or stable failure labels.

```powershell
$env:LEGISLATION_WEB_SMOKE_NX_03A = "1"
$env:LEGISLATION_WEB_SMOKE_PERSON_ID = "person:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_TERM_ID = "term:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_ORGANIZATION_ID = "organization:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_MEMBERSHIP_ID = "membership:audited-production-fixture"
pnpm --filter legislation-web smoke:foundation
```

After NX-03B is deployed, set `LEGISLATION_WEB_SMOKE_NX_03B` to `1`. This cumulative profile runs NX-02A, NX-02B,
NX-02C, and NX-03A first, then checks the 14 meeting, calendar, and representative-lookup operations. It embeds no
production civic IDs, addresses, or coordinates. Configure audited target values through
`LEGISLATION_WEB_SMOKE_MEETING_DETAIL_ID`, `LEGISLATION_WEB_SMOKE_AGENDA_MEETING_ID`,
`LEGISLATION_WEB_SMOKE_AGENDA_ITEM_ID`, `LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_MEETING_ID`,
`LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_ID`, `LEGISLATION_WEB_SMOKE_OUTCOME_MEETING_ID`,
`LEGISLATION_WEB_SMOKE_OUTCOME_ID`, `LEGISLATION_WEB_SMOKE_PARTICIPANT_LIST_MEETING_ID`,
`LEGISLATION_WEB_SMOKE_PARTICIPANT_DETAIL_MEETING_ID`, `LEGISLATION_WEB_SMOKE_PARTICIPANT_ID`, and
`LEGISLATION_WEB_SMOKE_CALENDAR_ID`. Each child ID must belong to its designated parent, which can differ between route
groups because canonical visibility differs in production. Configure `LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LATITUDE` and
`LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LONGITUDE` together only after auditing the representative provider result in the
target deployment, plus `LEGISLATION_WEB_SMOKE_REPRESENTATIVE_EXPECTED_OUTCOME` as either `200` or
`dependency_unavailable`. The smoke sends exactly one coordinates request and never emits its values.

Routes whose needed fixture values are absent report explicit `fixture_not_configured` skips; once configured, every
NX-03B route must return its production-audited outcome. Only raw meeting detail, agenda-item detail, outcome detail,
calendar detail, and calendar meetings may return canonical `404 not_found`. Every other configured route must return
its canonical `200` Page or Resource response; no `422` exception is allowed. Successful `GET`s must preserve the
correlation ID, return `cache-control: private, no-store`, include an ETag, and pass an ETag conditional `304` check.
The representative request must either return its exact `200` lookup Resource envelope with a non-empty lookup ID, or
its exact audited `503 dependency_unavailable` response with `retryable: true` and `Retry-After: 30`. The smoke also
checks canonical no-redirect `404` behavior for trailing slashes on the meeting, calendar, and representative-lookup
roots. Fixture IDs, coordinates, and response messages are not written to the report or stable failure labels.

```powershell
$env:LEGISLATION_WEB_SMOKE_NX_03B = "1"
$env:LEGISLATION_WEB_SMOKE_MEETING_DETAIL_ID = "meeting:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_AGENDA_MEETING_ID = "meeting:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_AGENDA_ITEM_ID = "agenda-item:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_MEETING_ID = "meeting:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_EVENT_DOCUMENT_ID = "event-document:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_OUTCOME_MEETING_ID = "meeting:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_OUTCOME_ID = "outcome:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_PARTICIPANT_LIST_MEETING_ID = "meeting:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_PARTICIPANT_DETAIL_MEETING_ID = "meeting:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_PARTICIPANT_ID = "participant:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_CALENDAR_ID = "calendar:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LATITUDE = "38.5816"
$env:LEGISLATION_WEB_SMOKE_REPRESENTATIVE_LONGITUDE = "-121.4944"
$env:LEGISLATION_WEB_SMOKE_REPRESENTATIVE_EXPECTED_OUTCOME = "dependency_unavailable"
pnpm --filter legislation-web smoke:foundation
```

After NX-04 is deployed, set `LEGISLATION_WEB_SMOKE_NX_04` to `1`. This cumulative profile runs NX-02A, NX-02B, NX-02C,
NX-03A, and NX-03B before issuing exactly seven audited POST requests: bill, amendment, passage, supporting-material,
and universal search; document comparison; and a research answer. It embeds no production query, record ID, document ID,
or research question. All request inputs and each expected result are configured through the environment. Missing inputs
create named `fixture_not_configured` skips and make no request.

Set one query and one expected result for each search route. The profile fixes the audited request modes to lexical
(bills, supporting materials, and universal), semantic (amendments), and hybrid (passages). The lexical searches expect
`200`; the semantic amendment search is audited as `200` or `dependency_unavailable`; the hybrid passage search is
audited as `200`, `dependency_unavailable`, or `unprocessable` when canonical OCR projection fails closed. A successful
SearchPage must preserve the correlation ID, return `cache-control: private, no-store`, and report the exact documented
lexical, embedding, and reranking metadata. A dependency result must be canonical `503 dependency_unavailable`,
`retryable: true`, and `Retry-After: 30`; an OCR-data result must be canonical `422 unprocessable`, `retryable: false`.

Document comparison needs one bill and two distinct sibling document IDs, plus an expected `200` or `unprocessable`; its
request fixes `granularity: word` and `limit: 1`, and the response validates exact Resource metadata and all returned
operation bounds. Research needs an explicit bill scope, question, and expected `200` or `dependency_unavailable`; its
lexical retrieval request fixes one evidence item. A successful answer must be an exact Resource with cited claims and
valid lexical retrieval metadata. Fixture values, query text, model errors, document IDs, and research prompts are never
written to the JSON report or stable diagnostics.

```powershell
$env:LEGISLATION_WEB_SMOKE_NX_04 = "1"
$env:LEGISLATION_WEB_SMOKE_SEARCH_BILLS_QUERY = "audited production query"
$env:LEGISLATION_WEB_SMOKE_SEARCH_BILLS_EXPECTED_OUTCOME = "200"
$env:LEGISLATION_WEB_SMOKE_SEARCH_AMENDMENTS_QUERY = "audited production query"
$env:LEGISLATION_WEB_SMOKE_SEARCH_AMENDMENTS_EXPECTED_OUTCOME = "dependency_unavailable"
$env:LEGISLATION_WEB_SMOKE_SEARCH_PASSAGES_QUERY = "audited production query"
$env:LEGISLATION_WEB_SMOKE_SEARCH_PASSAGES_EXPECTED_OUTCOME = "unprocessable"
$env:LEGISLATION_WEB_SMOKE_SEARCH_SUPPORTING_MATERIALS_QUERY = "audited production query"
$env:LEGISLATION_WEB_SMOKE_SEARCH_SUPPORTING_MATERIALS_EXPECTED_OUTCOME = "200"
$env:LEGISLATION_WEB_SMOKE_SEARCH_ALL_QUERY = "audited production query"
$env:LEGISLATION_WEB_SMOKE_SEARCH_ALL_EXPECTED_OUTCOME = "200"
$env:LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_BILL_ID = "bill:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_LEFT_DOCUMENT_ID = "document:audited-left-fixture"
$env:LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_RIGHT_DOCUMENT_ID = "document:audited-right-fixture"
$env:LEGISLATION_WEB_SMOKE_DOCUMENT_DIFF_EXPECTED_OUTCOME = "unprocessable"
$env:LEGISLATION_WEB_SMOKE_RESEARCH_BILL_ID = "bill:audited-production-fixture"
$env:LEGISLATION_WEB_SMOKE_RESEARCH_QUESTION = "audited production research question"
$env:LEGISLATION_WEB_SMOKE_RESEARCH_EXPECTED_OUTCOME = "dependency_unavailable"
pnpm --filter legislation-web smoke:foundation
```

Start with the [frontend architecture and dependency record](docs/architecture.md).
