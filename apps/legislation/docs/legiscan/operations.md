# LegiScan operations and delivery modes

## Delivery modes

| Mode | Mechanics | Coverage | Update model |
| --- | --- | --- | --- |
| Pull | HTTPS query-string API returning JSON, except raw dataset downloads. | Full operation set below. | Client polls and compares hashes. Public service limit is documented as 30,000 queries/month. |
| Bulk | Per-session ZIP snapshots obtained from the datasets site or `getDataset*`. | Individual JSON payload files for bills, roll calls, and people; CSV is also available. | Weekly snapshots, normally Sunday. |
| Push | LegiScan POSTs JSON payloads to a subscriber-owned endpoint. | Bills plus requested/dependent text, amendment, supplement, roll call, person, and session payloads. | Paid service, every 15 minutes to 4 hours depending on subscription. |

Pull calls use `https://api.legiscan.com/?key=APIKEY&op=OPERATION&PARAMS`. API keys, operation names, state
abbreviations, and bill numbers are case-insensitive. Normal JSON responses use `Content-Type: application/json`.

## Common response envelope

| Path | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `status` | string | Always for Pull responses | Exact value `OK` or `ERROR`. |
| `alert` | object | Optional on error | Error detail container. |
| `alert.message` | string | Optional on error | Human-readable system or validation message. |
| Operation-specific root | object, array, or map | On success | One root described below. |

Push requests do not use the Pull status envelope. The subscriber returns the acknowledgement envelope documented in
[Push model and webhooks](push.md).

## Operation catalog

| Operation | Inputs | Success root | Documented minimum refresh | Purpose |
| --- | --- | --- | --- | --- |
| `getSessionList` | `state?` | `sessions[]` | Daily | Sessions for one state or all states. |
| `getMasterList` | `id` or `state` | `masterlist` | 1 hour | Summary record for every bill in a session. |
| `getMasterListRaw` | `id` or `state` | `masterlist` | 1 hour | Minimal `bill_id`/number/hash list for change detection. |
| `getBill` | `id` | `bill` | 3 hours | Complete bill metadata and child-object indexes. |
| `getBillText` | `id` | `text` | Static | One base64-encoded bill text. |
| `getAmendment` | `id` | `amendment` | Static | One base64-encoded amendment. |
| `getSupplement` | `id` | `supplement` | Static | One base64-encoded supporting document. |
| `getRollCall` | `id` | `roll_call` | Static | Roll-call summary and individual votes. |
| `getPerson` | `id` | `person` | Weekly | Legislator/sponsor identity and external IDs. |
| `getSearch` | Search parameters | `searchresult` | 1 hour | Paginated full-detail search, 50 results/page. |
| `getSearchRaw` | Search parameters | `searchresult` | 1 hour | Automation-oriented search, up to 2,000 results/page. |
| `getDatasetList` | `state?`, `year?` | `datasetlist[]` | Weekly | Available dataset snapshots and access keys. |
| `getDataset` | `id`, `access_key`, `format?` | `dataset` | Weekly | Base64-encoded ZIP archive. |
| `getDatasetRaw` | `id`, `access_key`, `format?` | Raw ZIP | Weekly | Binary ZIP stream, no JSON envelope. |
| `getSessionPeople` | `id` | `sessionpeople` | Weekly | People with sponsor or vote activity in a session. |
| `getSponsoredList` | `id` | `sponsoredbills` | Daily | Sessions and bills sponsored by one person. |
| `getMonitorList` | `record?` | `monitorlist` | 1 hour | GAITS tracked bills with summary metadata. |
| `getMonitorListRaw` | `record?` | `monitorlist` | 1 hour | Minimal GAITS tracked-bill change list. |
| `setMonitor` | `list`, `action`, `stance?` | `return` | Live | Add/remove monitored bills or set stance. |

Refresh values are cache/data-change guidance, not a requirement to call that often. Faster requests can spend quota and
still receive unchanged cached data.

## Operation-specific parameters and result shapes

### `getSessionList`

- `state` is an optional two-character jurisdiction abbreviation. Omit it for all available sessions.
- Returns `sessions[]`; see [session](wire-schema.md#session).
- Each example session also carries `dataset_hash`, enabling snapshot-version comparison.

### `getMasterList` and `getMasterListRaw`

- Invocation A: `id=SESSION_ID`.
- Invocation B: `state=STATE` selects the state's current session and is documented with a caution because “current” can
  be ambiguous around session transitions.
- `masterlist` is a JSON object keyed by zero-based numeric strings, not a JSON array in the examples.

Full entry fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `bill_id` | integer | Global bill identifier. |
| `number` | string | Jurisdiction bill number. |
| `change_hash` | string | MD5 change fingerprint for bill status metadata. |
| `url` | string | LegiScan bill URL. |
| `status_date` | date | Date associated with the status. |
| `status` | integer or numeric string | Status/progress code. |
| `last_action_date` | date | Most recent action date. |
| `last_action` | string | Most recent action text. |
| `title` | string | Bill title. |
| `description` | string | Bill description. |

Raw entry fields are `bill_id`, `number`, and `change_hash` only.

### `getBill`

- Required parameter: `id=BILL_ID`.
- Returns `bill`; see the complete [bill schema](wire-schema.md#bill).
- The child indexes supply IDs for `getPerson`, `getBillText`, `getAmendment`, `getSupplement`, and `getRollCall`.

### `getBillText`, `getAmendment`, and `getSupplement`

- Required parameter: the corresponding `doc_id`, `amendment_id`, or `supplement_id` as `id`.
- Returns metadata plus a `doc` string containing the base64-encoded binary/document body.
- The advertised size is the decoded byte count. Base64 transport is approximately 33 percent larger.
- See [text](wire-schema.md#text), [amendment](wire-schema.md#amendment), and
  [supplement](wire-schema.md#supplement).

### `getRollCall`

- Required parameter: `id=ROLL_CALL_ID`.
- Returns `roll_call`; see [roll call](wire-schema.md#roll-call).

### `getPerson`

- Required parameter: `id=PEOPLE_ID`.
- Returns the person's current record, not a historical snapshot. Party, role, or district may therefore differ from the
  person's attributes at the time of an older bill/session.
- See [person](wire-schema.md#person).

### `getSearch`

Invocation A:

- `state`: two-character state or `ALL`.
- `query`: URL-encoded full-text query.
- `year?`: `1` all, `2` current (default), `3` recent, `4` prior, or an exact year greater than 1900.
- `page?`: one-based result page, default 1.

Invocation B replaces `state`/`year` with `id=SESSION_ID`. Each `searchresult` object contains a `summary` object and
numeric-string result keys.

| Path | Type | Meaning |
| --- | --- | --- |
| `summary.page` | string | Display page, for example `1 of 451`. |
| `summary.range` | string | Display result range. |
| `summary.relevancy` | string | Display relevancy range. |
| `summary.count` | integer | Total matches. |
| `summary.page_current` | integer | Current page. |
| `summary.page_total` | integer | Total pages. |
| `*.relevance` | integer | Search relevance score. |
| `*.state` | string | Jurisdiction abbreviation. |
| `*.bill_number` | string | Bill number. |
| `*.bill_id` | integer | Global bill ID. |
| `*.change_hash` | string | Bill change fingerprint. |
| `*.url` | string | LegiScan bill URL. |
| `*.text_url` | string | LegiScan text URL. |
| `*.research_url` | string | LegiScan research URL. |
| `*.last_action_date` | date | Latest action date. |
| `*.last_action` | string | Latest action text. |
| `*.title` | string | Bill title. |

### `getSearchRaw`

Accepts `state`, `query`, `year?`, `id?`, and `page?`; `id` limits the query to one session. The manual also presents a
session-only invocation using `id`, `query`, and `page?`.

The `summary` fields match `getSearch`. The example places minimal result records under `searchresult.results` and each
contains only `relevance`, `bill_id`, and `change_hash`. The example's JSON notation is malformed around numeric keys, so
consumers should confirm whether `results` is delivered as an array or object with a live key before fixing a parser to
one representation.

### `getDatasetList`

- Optional filters: `state`, `year`.
- Returns `datasetlist[]`.

| Field | Type | Meaning |
| --- | --- | --- |
| `state_id` | integer | Internal jurisdiction ID. |
| `session_id` | integer | Internal session ID. |
| `special` | integer | `0`/`1` special-session flag. |
| `year_start` | integer | Session starting year. |
| `year_end` | integer | Session ending year. |
| `session_name` | string | State-specific session name. |
| `session_title` | string | Normalized session title. |
| `dataset_hash` | string | Snapshot version fingerprint, not the ZIP file checksum. |
| `dataset_date` | date | Snapshot date. |
| `dataset_size` | integer | Dataset archive size in bytes. |
| `access_key` | string | Per-dataset retrieval credential required by `getDataset*`. |

### `getDataset` and `getDatasetRaw`

- Required: `id=SESSION_ID`, `access_key=ACCESS_KEY`.
- Optional `format`: `json` (default) or `csv`.
- `getDataset` fields: `state_id`, `session_id`, `session_name`, `dataset_hash`, `dataset_date`, `dataset_size`, `mime`
  (`application/zip`), and `zip` (base64 archive).
- `getDatasetRaw` returns the ZIP bytes directly.

The JSON archive contains individual API-shaped files under bill, people, and vote paths plus `hash.md5` in the official
client's importer. Bill files contain child metadata, but the large text/amendment/supplement documents are not described
as embedded Bulk files; retrieve those through the corresponding Pull operation or Push missing-child flow.

### `getSessionPeople`

Returns `sessionpeople.session` and `sessionpeople.people[]`.

Session fields are `session_id`, `state_id`, `year_start`, `year_end`, `special`, `prefile`, `prior`, `sine_die`,
`session_name`, `name`, and `dataset_hash`. Person elements use the [person schema](wire-schema.md#person); the example
omits `knowwho_pid` even though `getPerson` includes it.

### `getSponsoredList`

Returns:

- `sponsoredbills.sponsor`: [person](wire-schema.md#person).
- `sponsoredbills.sessions[]`: `session_id`, `session_name`.
- `sponsoredbills.bills[]`: `session_id`, `bill_id`, `number`.

### `getMonitorList` and `getMonitorListRaw`

- Optional `record`: `current` (default), `archived`, or an exact year from 2010 onward.
- `monitorlist` is an object keyed by numeric strings.
- Full entries contain `bill_id`, `state`, `number`, `stance`, `change_hash`, `url`, `status_date`, `status`,
  `last_action_date`, `last_action`, `title`, and `description`.
- Raw entries contain `bill_id`, `state`, `number`, `stance`, `change_hash`, and `status`.

### `setMonitor`

| Parameter | Required | Values |
| --- | --- | --- |
| `list` | Yes | One or more comma-separated `bill_id` values. |
| `action` | Yes | `monitor`, `remove`, or `set`. |
| `stance` | No | `watch` (default), `support`, or `oppose`. |

Returns `return`, an object keyed by each submitted bill ID. Each value is a human-readable string beginning with `OK:`
or `ERROR:`. The top-level status only indicates whether the overall request was valid; inspect every per-bill value.
