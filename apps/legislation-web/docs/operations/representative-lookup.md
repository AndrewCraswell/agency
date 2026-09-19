# Development representative lookup

`/dev/representatives` is a development-only diagnostic, not the public representative-lookup API.
Both the page and `POST /api/dev/representatives` require `NODE_ENV=development`.
The existing public `/api/representative-lookups` contract remains unavailable.

## Setup and use

Set `GEOCODIO_API_KEY` and `GEOCODIO_BASE_URL=https://api.geocod.io/v2` in W's ignored `.env`,
alongside its existing `DATABASE_URL`. Restart the Next development server after changing credentials.
Neither Geocodio variable may use the `NEXT_PUBLIC_` prefix.

Open the page and choose **Use my location**. Location is requested only after that action. Browsers
require permission and a secure context (HTTPS or localhost); location can be unavailable in an embedded
browser. Permission denial, timeout and unsupported browsers remain explicit errors.

The page demos fetching representatives from the database. It shows federal and state legislative districts,
database jurisdiction names, and only confirmed database profiles. Names, parties, portraits and official
website links come from those stored profiles; unconfirmed matches are summarized as coverage gaps rather
than displayed as profiles. The page has no provider comparison panels or vendor branding. Location resolution
still uses Geocodio behind the scenes, and the consent text discloses the external location service.
Browser location accuracy does not prove district membership near a boundary. This is not a general
local-official directory.

## Backend contract

The endpoint requires same-origin JSON POST requests and accepts exactly one of:

- `{ "latitude": 38.8894, "longitude": -77.0091 }`
- `{ "address": "1109 N Highland St, Arlington VA" }`

Coordinates are passed in a single-item Geocodio batch POST using `skipGeocoding=true`. Districts
are resolved at the submitted point, not at a nearby reverse-geocoded street address. Address requests
use forward geocoding. Both request `cd,stateleg`; coordinates require two append credits and addresses
require three credits before the daily free allowance. No automatic provider retries occur.

Responses use the standard `data`, `links` and `meta` envelope. Data has `status` (`matched`, `partial`,
`no_match`, `ambiguous`, or `unsupported`), `jurisdictions`, `representatives`, and `warnings`.
Each representative has separate provider facts and an optional `profile`, with `matchStatus` of
`matched`, `not_found`, `ambiguous`, or `missing_identifier`.

Only exact Bioguide/Open States identifiers match provenance-backed, current local people and profiles
in the expected jurisdiction. Names never merge identities. Multiple matching canonical people remain
ambiguous. Missing legislator lists do not establish vacancies. Missing jurisdiction names remain null.
Database failures are errors, not successful provider-only results.

## Privacy and limits

Coordinates and addresses are transient. They are not persisted, included in request URLs, echoed in
responses, or retained in application error causes. The API key stays server-side. Geocodio receives
the submitted location; its retention policy is separate from Rostra's no-storage behavior.
Responses use `private, no-store`. The dev endpoint permits one in-flight lookup and 30 requests per
minute per process; it is not a production/distributed abuse-control mechanism.

Provider responses are bounded to 1 MiB and a ten-second request deadline. A dedicated one-connection
read pool follows the existing snapshot-persistence pattern, with a five-second read-only transaction
deadline compatible with transaction poolers. There are no database writes or new ingestion sources.

Production rollout, saved addresses, historical district resolution, and MCP location tools are not
part of this diagnostic. The [identity roadmap](../engineering/identity-and-representative-roadmap.md)
retains those separate acceptance gates.
