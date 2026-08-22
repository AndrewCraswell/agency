# LegiScan Push model and webhooks

LegiScan Push is a paid remote-replication feed, not a conventional catalog of independently subscribable event names.
LegiScan detects changes in the subscribed jurisdictions and POSTs one API-shaped object at a time to the subscriber's
public endpoint. The subscriber acknowledges processing and can request missing child objects in the same response.

The manual documents delivery intervals from 15 minutes to 4 hours. The service overview describes four-hour delivery as
standard and 15-minute delivery as optional. Exact scope, cadence, retries, timeout, ordering, and retention are commercial
subscription details and are not specified in the public manual.

## All incoming payload types

The official endpoint dispatches solely by the presence of one of these root keys:

| Root key | Payload schema | When/why it is delivered | Typical dependency |
| --- | --- | --- | --- |
| `bill` | [Bill](wire-schema.md#bill) | Master bill create/update. Includes Push-only `last_push` and `reasons`. | May reveal missing people, texts, amendments, supplements, or roll calls. |
| `text` | [Text](wire-schema.md#text) | Full bill-text document body. | Identified by `bill.texts[].doc_id`. |
| `amendment` | [Amendment](wire-schema.md#amendment) | Full amendment document body. | Identified by `bill.amendments[].amendment_id`. |
| `supplement` | [Supplement](wire-schema.md#supplement) | Full supporting-document body. | Identified by `bill.supplements[].supplement_id`. |
| `roll_call` | [Roll call](wire-schema.md#roll-call) | Vote summary plus individual member votes. | Identified by `bill.votes[].roll_call_id`; can reveal missing people. |
| `person` | [Person](wire-schema.md#person) | Legislator/sponsor identity record. | Identified by sponsor or individual-vote `people_id`. |
| `session` | [Session](wire-schema.md#session) | Session state/metadata change. | Provides session lifecycle flags and names. |

There are no separately documented `history`, `committee`, `calendar`, `subject`, `sponsor`, or SAST webhooks. Those
changes arrive by retransmission of the full `bill` payload, with `reasons` explaining what changed. Likewise, a reason
such as `Vote` is a trigger on the bill payload; the detailed `roll_call` is a separate payload that can be requested when
missing.

## Request transport

The official client supports two inbound encodings:

### Raw JSON

- HTTP request body is the JSON payload.
- Any `Content-Type` other than exactly `application/x-www-form-urlencoded` is treated as raw by the reference client.
- Production endpoints should explicitly require an appropriate JSON media type rather than copying that permissive
  behavior.

### Form-encoded, called “cooked” by LegiScan

- `Content-Type: application/x-www-form-urlencoded`.
- One configured form field contains the entire JSON string.
- The field name is configured in the LegiScan control panel and must match the endpoint's `push_form_var` setting.

### Authentication

- The reference endpoint supports `Authorization: Token <api_auth_token>` using the token from the LegiScan control
  panel.
- In the reference implementation, validation occurs only when the request includes an Authorization header. If the
  header is absent, the token check is skipped even when a token is configured.
- Our implementation should require the header when authentication is configured, compare secrets in constant time,
  require TLS, avoid logging the token, and reject unexpected methods/media types.
- No public documentation was found for signatures, timestamps, source IP ranges, replay protection, or key rotation.
  Confirm these with LegiScan before production design.

## Incoming envelope

Unlike Pull, the incoming Push is the API-shaped object itself and does not require a top-level `status`. Exactly one of
the seven recognized roots should be present.

```json
{
  "bill": {
    "bill_id": 1167968,
    "last_push": "2025-03-17 12:34:56",
    "reasons": {
      "2": "StatusChange",
      "23": "Vote"
    }
  }
}
```

The example above illustrates the shape inferred from the official processor: it iterates `reasons` as
`reason_id => reason`. The public manual lists the fields and values but does not publish a complete Push request example.
Capture and fixture a real subscription payload before freezing exact timestamp formatting or whether reason keys are
serialized as strings.

## Acknowledgements

The endpoint is the responding side and must return JSON.

Successful processing:

```json
{ "status": "OK" }
```

Failed processing:

```json
{
  "status": "ERROR",
  "alert": {
    "message": "descriptive error message"
  }
}
```

`OK` and `ERROR` are case-sensitive. The reference client sets `Content-Type: application/json`. The public materials do
not define required HTTP status codes, acknowledgement deadlines, retry schedules, duplicate semantics, or dead-letter
behavior. Do not infer those from the PHP sample; obtain them contractually and design the consumer to be idempotent.

## Missing-child request protocol

After accepting a bill or roll call, the endpoint may ask LegiScan to send dependent records that are absent locally:

```json
{
  "status": "OK",
  "missing": {
    "sponsors": [4718],
    "texts": [1868195],
    "amendments": [72535],
    "supplements": [94182],
    "votes": [806862]
  }
}
```

The official processor emits these plural keys:

| `missing` key | ID values | Resulting payload root |
| --- | --- | --- |
| `sponsors` | `people_id[]` | `person` |
| `texts` | `doc_id[]` | `text` |
| `amendments` | `amendment_id[]` | `amendment` |
| `supplements` | `supplement_id[]` | `supplement` |
| `votes` | `roll_call_id[]` | `roll_call` |
| `bills` | `bill_id[]` | `bill`; used by other client workflows, not normally produced from processing a bill Push. |

When processing `roll_call`, the client can request missing vote participants under `sponsors`. The public manual says the
endpoint can request missing bill text or vote information; the official client demonstrates the larger key set above.

The public documentation does not define limits on IDs per acknowledgement, whether unknown keys are ignored, or delivery
ordering of requested children. Request only IDs actually referenced by the accepted parent and deduplicate locally.

## Bill Push reasons

`bill.reasons` explains why the full bill payload was pushed. More than one reason can be present.

| ID | Flag | Trigger meaning |
| --- | --- | --- |
| 1 | `Newbill` | New legislation. The reference client spells this `NewBill`; matching should be case-tolerant or ID-based. |
| 2 | `StatusChange` | `status` changed. |
| 3 | `Chamber` | Bill moved chambers. |
| 4 | `Complete` | Bill completed legislative action. **Deprecated; do not use.** |
| 5 | `Title` | Title changed. |
| 6 | `Description` | Description changed. |
| 7 | `CommRefer` | Referred or re-referred to committee. |
| 8 | `CommReport` | Reported from committee. |
| 9 | `SponsorAdd` | Sponsor added. |
| 10 | `SponsorRemove` | Sponsor removed. |
| 11 | `SponsorChange` | Existing sponsor position/type changed. |
| 12 | `HistoryAdd` | History step added. |
| 13 | `HistoryRemove` | History step removed. |
| 14 | `HistoryRevised` | Prior history step revised. |
| 15 | `HistoryMajor` | History change included major steps. |
| 16 | `HistoryMinor` | History change included minor steps. |
| 17 | `SubjectAdd` | Subject added. |
| 18 | `SubjectRemove` | Subject removed. |
| 19 | `SAST` | Same-as/similar-to relationship added. |
| 20 | `Text` | New bill-text document. |
| 21 | `Amendment` | New amendment document. |
| 22 | `Supplement` | New supplemental document. |
| 23 | `Vote` | New vote record. |
| 24 | `Calendar` | Calendar event added or updated. |
| 25 | `Progress` | Progress array updated. |

The downloadable client additionally seeds `26=VoteUpdate`, `27=TextUpdate`, and `99=ICBM`, but API Manual v1.91 does
not publish them. Treat them as undocumented compatibility values, preserve them in raw ingestion, and ask LegiScan before
using them as supported triggers.

## Processing semantics for a gap analysis

- A Push bill is a current full snapshot, not a field-level patch. Replace/reconcile child collections so removals and
  revisions are not missed.
- Use global LegiScan IDs as source identifiers and hashes for change detection. Do not derive identity from bill number,
  names, titles, or URLs.
- Store the raw payload and receipt metadata before transformation so schema drift and replay can be diagnosed.
- Make every handler idempotent by root type plus object ID plus content/change hash where available.
- Expect parent/child arrival out of order and support unresolved foreign references.
- Do not assume Push ordering across bills or child types; no ordering guarantee is publicly documented.
- Preserve unknown fields and enum IDs to avoid data loss during upstream additions.
- Convert `0000-00-00` to an explicit unknown date while retaining the raw source value if exact provenance matters.
- Alert on unknown root types, reason IDs, enum IDs, and contract-shape changes without dropping the original payload.

## Questions requiring vendor confirmation

The public documentation does not answer these production-critical points:

1. Exact retry/backoff policy, retryable HTTP statuses, maximum attempts, and dead-letter/replay controls.
2. Delivery ordering, duplication, concurrency, batch size, and maximum payload/document size.
3. Acknowledgement timeout and whether processing must finish synchronously.
4. Exact `last_push` format/timezone and whether it is delivery time or last acknowledged time.
5. Current authentication options beyond `Authorization: Token`, including signatures and IP allowlists.
6. Whether Push reason IDs 26, 27, and 99 are currently emitted.
7. Whether `missing.bills` is accepted by the Push server and all supported `missing` limits.
8. Subscription filters by state, session, bill, or data type and how scope changes are backfilled.
9. Initial snapshot/bootstrap procedure, historical coverage, and replay window.
10. Schema-change/versioning notice policy and support for test/sandbox deliveries.
