# Regulatory acquisition, backfills and Trigger.dev workflows

Proposed implementation contract, September 14, 2026. Parent: [implementation](implementation.md).
Uses the [data contract](../../../../packages/legislation-core/docs/regulations/data-contract.md) and [federal reuse decision](federal-collector-baseline.md).

## Implemented passage preparation worker

`src/trigger/tasks/regulatory-passage-preparation.ts` defines an explicit-dispatch task for one published edition or
publication observation. Its strict payload is `{scope: {kind: "edition" | "publication", id}, model, limit?}`.
`model` must explicitly select `openai/text-embedding-3-small` or `voyageai/voyage-4`; it chooses the offline tokenizer,
not an embedding provider request. `limit` defaults to 10 versions and is capped at 25. No caller offsets, text or
regeneration switches are accepted.

The queue allows two workers, each with a pool of at most two canonical connections and a ten-minute task ceiling.
The existing canonical preparation service enforces the 120-second renewable lease, fencing and immutable per-version
checkpoints. Retries allow four attempts with 125–180-second delays, so a killed worker's lease can expire. Only a
successful pending batch that processed at least one version submits a successor. Submission uses the parent run ID
as its idempotency key; the successor reloads remaining work from canonical checkpoints. A completed replay stops
without dispatch. Pools close before submission; invalid counts, no progress, lost leases and database failures do
not start successors. URLs and the actual database name are checked before preparation to reject the isolated search
store.

This implements one worker, not the full orchestration graph. It is not deployed or scheduled. Controller admission,
measured aggregate connection budgets, lost/cancelled task recovery, deployment packaging smoke and load testing remain
open. Preparation does not acknowledge a search copy, select a model route or enqueue embeddings.

## Implemented passage copy worker

`regulatory-passage-copy` accepts only `{preparationId, afterOrdinal?, limit?}`. It defaults to ordinal -1 and ten
versions, with a maximum of 25. The service requires a completed, unleased preparation, verifies its item count and
current source rights, and checks that a supplied cursor belongs to that preparation. It reads one extra item to
identify continuation. Each immutable generation is copied with the existing transactional copier, including source
ownership, current rights and exact-content replay validation. Planning connections are released before copying.

The batch stops admitting new copies after 45 seconds; one already-started copy can use the copier's existing
60-second deadline. Only successfully committed items advance the returned cursor. A failed batch returns no new
checkpoint; replay from its original cursor safely verifies already copied generations. The Trigger wrapper uses a
180-second task limit, two-worker queue and two connections per source/target pool. Production configuration requires
separate PostgreSQL hosts. Both pools close before an idempotent successor is submitted.

`exhausted` means the selected traversal reached the end, not that the whole copy is ready to serve. Arbitrarily skipping
to a valid later cursor cannot bypass whole-copy validation. The worker never acknowledges an outbox or changes search
capabilities; `acknowledgeLegalPassageCopy` remains a separate gate. No schedules, deployed worker smoke, controller
admission or cancellation-recovery dispatcher are provided by this slice.

## Scope and default backfill order

`inspect:regulatory-canonical --manifest <frozen.json> --replay <complete-replay.json> --report <new-report.json>`
checks the retained local eCFR database selected by `REGULATORY_TEST_DATABASE_URL`. It requires the exact complete
replay scope and current parser hash, uses a read-only PostgreSQL connection, and takes one repeatable-read snapshot
per title. It revalidates the stored raw file, generation/manifest identities, rights, edition dates and head precedence,
then compares every normalized record against staged payloads and canonical identities, text, tables and memberships.
Record queries are bounded to 100 records and 8 MiB, with the existing one-large-record exception up to the parser's
64 MiB record limit. Queries have a 60-second timeout and each title a ten-minute comparison admission deadline.
Only mismatch keys and categories are reported, capped at twenty samples per title; legal text is not logged.

The existing `importNormalizedRegulatoryUnit` dispatch path now performs this verification before registering a new
eCFR generation. A verified published edition returns its existing generation/edition IDs without taking a lease,
creating another parser generation in the database or enqueueing derived work, even if the parser hash or enclosing
inventory changed. Acquisition semantics and source output must still match exactly. Invalid published data, ambiguous
generations and active writers block reuse rather than trigger replacement imports. Missing or unpublished units keep
the existing import/resume path. Internal `reuseOnly: true` forbids that fallback and can execute on a read-only pool.
The existing `import:regulatory-backfill` CLI exposes `--reuse-only` with a database-enforced read-only connection;
this mode does not require `--apply` and fails if an input cannot be reused. `--limit` still bounds its selected prefix.

This implements local eCFR reuse at the existing importer entry point. It does not deploy the full Trigger controller,
activate schedules, acknowledge a search copy or certify a production destination. Snapshot evidence must be regenerated
at dispatch, and annual CFR/FR retain their separate publication and reconciliation requirements.

`pnpm --filter legislation-ingestion tool regulations/replay-regulatory-parser --manifest <frozen.json> --locations <locations.json>
--output <new-normalized-root> --report <new-report.json> [--after-unit <key>] [--limit 5]` replays up to five titles
sequentially against freshly audited retained inputs. It reuses the existing bounded parser and generation locks.
The manifest is replay-verified; cursors must belong to it. Completed current generations are fully validated on retry.
The parser code hash is pinned across the batch and rechecked around each parse. Incomplete or conflicting inputs
stop progress at the last completed unit; every invocation writes an exclusive report. Replaying that invocation after
a crash safely revalidates committed output. No acquisition, publication or embedding tasks are dispatched.

Every retained baseline is revalidated and compared with the new summary, including exact shard hashes/bytes, counts,
source dates, warnings, element inventories and hierarchy represented in the shards. Only parser code hash, runtime
version and elapsed time are excluded from parity. Changed serialization or shard boundaries conservatively require
review too. Any difference produces `review_required` and a nonzero CLI exit, without changing canonical records.
The terminal cursor means traversal exhaustion only; all batch reports and their dispositions must be reconciled
before claiming complete parity. Canonical verification remains a separate gate even if every record is identical.

`pnpm --filter legislation-ingestion tool regulations/audit-regulatory-reuse --manifest <frozen.json> --locations <locations.json> --output <report.json>`
audits retained raw XML and normalized output before dispatch. The locations file is an explicit array of
`{ "rawDirectory": "...", "normalizedDirectory": "..." }` pairs; relative paths resolve from the command's working
directory. The CLI hashes the current Python parser itself and writes a new report exclusively. It does not download,
execute the parser, connect to a database, repair artifacts or dispatch tasks.

The audit replays the frozen inventory, checks receipt identity, file size and streamed SHA-256, then validates every
normalized shard and record with the existing parser validator. Only the enclosing inventory hash may differ in an
otherwise identical retained acquisition unit. Competing valid raw hashes or current-parser normalized shard sets remain invalid
and require review; an intact alternate copy can be selected while damaged copies remain visible. A missing current
parser generation requires parsing; a missing shard inside an existing generation is damage. One metadata pass, capped
at 10,000 entries across the explicit roots, also discovers and validates older parser generations separately. Their
intact records cannot count as current-parser output; unreadable or invalid unassigned summaries remain inventory issues.
A verified raw file means
its retained bytes agree with the receipt, not that the publisher's text or canonical projection is correct.

The report distinguishes `acquire`, `parse`, `review_raw`, `review_normalized` and `inspect_canonical` actions.
`canonicalStatus` remains `not_checked` and `completeCanonicalAudit` remains false. This is the local file portion of
ING-02; canonical editions/observations, exact memberships/content, intended deployment and dispatch integration remain
separate work. Reports are point-in-time evidence and cannot authorize later reuse without revalidation. Exit status 1
means an invalid unit was found; missing inputs are represented in the plan rather than treated as audit failures.

The existing `tools/regulations/plan-regulatory-backfill.ts` now accepts optional `--delivery-output <path>` alongside `--output`.
It emits a read-only partition plan from replay-verified source evidence: current eCFR titles, FR date windows split by
month and the cutoff's 90-day baseline, and annual CFR year/title groups with listed volume numbers. Each partition
records corpus, federal jurisdiction, wave, explicit inclusion/reserved exclusion, expected acquisition units and
required evidence. Annual printed revision dates remain unresolved until parsing; they are not inferred from year labels.
An FR window with no listed XML remains `needs_independent_inventory`, with unknown document count, never known empty.

Replay reconstructs the complete manifest from retained inventories and compares its units/exclusions; rehashing an
omitted unit does not make it valid. Validation also binds inventory hashes to their source, rejects duplicate inventory
requests and verifies size accounting. Planning makes no canonical writes, dispatches no tasks and enables neither
embeddings nor recurring ingestion. This is a plan for the supplied scope, not a frozen nationwide release manifest
or proof that all required renditions exist.

| Wave | Contents | Completion boundary |
| --- | --- | --- |
| Pilot | eCFR titles 1, 21 and 40; one ordinary FR publication day plus selected correction/proposal fixtures | Bounded manifest, not federal coverage |
| Current foundation | Every active eCFR title; latest 90 days of FR rules, proposals and notices; latest available U.S. Code | Current baseline and recent publication history |
| Recent history | FR 2020 through the day before the recent window; annual CFR 2020 through latest available edition | Per-year/per-volume gates |
| Extended history | FR 2000–2019; annual CFR 1996–2019 | Separate bounded year manifests |
| Optional archive expansion | FR 1994–1999 and earlier editions where accessible in other renditions | Explicit format-specific source validation |

These are implementation defaults, not completed downloads or a launch promise. Record absolute start/end dates and
discovery cutoff in each manifest; never let `today` change a resumed backfill. Overlap between waves is safe under
canonical uniqueness. Execution decision, September 14, 2026: finish the approved frozen backfill waves and their
validation gates before ingesting ongoing new data. Keep all recurring source schedules disabled until then. Historical
work sets `historical: true` and does not send customer change notifications by default.

GovInfo documents FR bulk XML from 2000 and annual CFR XML from 1996. Do not copy the inspected scraper's 1994 bulk
assumption. Discover actual files/volumes through source listings; a year with unavailable XML can have other
renditions. Before each wave, freeze an inventory and measure its actual bytes, units and parser workload.
[GovInfo developer hub](https://www.govinfo.gov/developers)

## Adapter implementation and code reuse

Before treating an FR bulk inventory as a complete wave, run `audit:fr-inventory` against a replay-validated
FederalRegister.gov metadata snapshot covering the same frozen dates and cutoff. The implemented local audit replays
both inventories, records each calendar date and distinguishes missing XML, missing metadata, excluded-only content,
and no records observed. Inventory agreement still requires document reconciliation and artifact validation; a day
with no observed records is not a verified holiday. The metadata collector bounds each audit to at most 31 days.
The command writes its report before returning exit 1 for inventory gaps. It makes no network or canonical writes.

The January 3, 2000 smoke found 75 supported publications plus one presidential document in metadata, but no bulk XML
issue in the official monthly listing. Queue missing renditions for separately validated official PDF/text acquisition;
do not silently mark the day complete or move the coverage start date. All 75 official PDFs for that day have now been
acquired, replay-checked and parser-validated across 258 pages. Alternate-rendition text normalization and canonical
publication remain pending; raw PDF coverage does not clear the bulk XML coverage gap. Prefer the implemented
document-specific GovInfo HTML adapter before PDF segmentation: it verifies publisher document identity, date, type,
pages and footer against the frozen metadata. See [alternate text validation](fr-metadata-validation.md#document-specific-govinfo-html).

TypeScript workers own provider HTTP, credentials, host budgets, Azure artifacts, transactions and orchestration.
Reuse/adapt Vaquill parsing logic from pinned commit `2f7aeb85a434a54a351ac44e3c188fec318f78ba`. Federal HTML website
scraping is not the default: prefer official metadata APIs, XML and package downloads. Do not copy browser/proxy state
collectors into this federal feature.

For XML parsing, first extract bounded pure parsers into `python/regulations/` using Python standard-library XML
streaming where sufficient. A TypeScript parser bridge invokes them on downloaded files and receives validated NDJSON
plus a summary manifest. No provider credentials or database writes in parser subprocesses. Package through the already
configured `@trigger.dev/python` extension; the existing Open States extension configuration alone does not include
these files. Add exact scripts, validate deployed runtime/startup, pin dependencies if required, and preserve Apache
notices. Reuse existing document/PDF/OCR services for non-XML material. A new parsing library needs the repository's
normal dependency decision; no new service is implied by this spec.

The bridge must enforce process timeout, streamed stdout/output file limits, safe stderr, nonzero failure propagation,
manifest hash/count agreement, temporary-directory cleanup and maximum XML nesting. Disable external entity/network
resolution; bound decompression and reject path traversal in archives. Never execute source markup or accept arbitrary
user URLs. Validate redirect destinations against each adapter's approved source hosts, including established official
download hosts. Parser output is untrusted until Zod validation and content/hierarchy checks pass.

## Federal Register acquisition

Work units: one month of metadata discovery, one publication day of XML acquisition, then document or bounded-document
batch parsing. One daily XML contains many documents: download it once and retain fragment locators rather than one
download per section. Parsing streams the daily file and writes bounded normalized shards; large documents can have
their own shard. Dates with no issue require inventory evidence, not an assumption about weekends/holidays.

1. Enumerate GovInfo publication/package inventory for the frozen range. Save expected issues and document identities
   where available. Use returned artifact links rather than assuming a constructed path exists.
2. Query FederalRegister.gov document metadata in monthly date/type partitions. Follow pagination to completion and
   record totals/cursors. Split saturated partitions into days, then supported type partitions; never stop at a provider
   result cap while claiming the month complete.
3. Acquire source XML and official PDF/other renditions available in the declared scope. Required text artifact failure
   blocks the document. PDF availability is independently reported: unavailable PDF is not a reason to discard valid
   XML, but missing publisher-listed required PDF blocks an `artifactsComplete` claim.
4. Parse RULE, PRORULE and NOTICE explicitly, preserving tables, preamble, supplementary information, amendatory text,
   footnotes, appendices, page markers and original document number. Other daily-file document types are classified
   outside initial scope, not silently included in rule counts. Vaquill's inspected CLI only permits RULE/PRORULE.
5. Join metadata to text by normalized document number. Retain agency, RIN, docket, CFR references, dates and source
   links. Zero or multiple matches are explicit exceptions. A metadata outage creates pending enrichment; usable source
   text remains available with `metadataComplete: false` and no invented fields.
6. Reconcile the union of publisher inventory, parsed daily documents and metadata records. Publication coverage cannot
   depend exclusively on FederalRegister.gov finding a record. Classify missing text, missing metadata and malformed
   IDs separately. Promotion of an advertised fully enriched slice requires those gaps resolved or excluded in its scope.
7. Detect old-publication changes via GovInfo lastModified windows and periodic inventory/ETag/hash reconciliation.
   Link new correction documents, retain prior renditions, and queue affected projections/embeddings by input hash.

Default recurrence: discover hourly with a 72-hour overlap in source modification time; retry daily recent-window
reconciliation over 30 publication days; rotate full-history modification/inventory reconciliation so every supported
year is checked within seven days. These are Rostra operating targets to validate, not upstream freshness guarantees.
If a source lacks a dependable modification signal, record that limitation and use revalidated artifact inventories.

## eCFR acquisition

Work unit: title + publisher issue date + observed source revision. Discover from the eCFR title inventory, preserving
`latest_issue_date`, `latest_amended_on`, `up_to_date_as_of` and `reserved`. An `import_in_progress` signal defers current
edition promotion and schedules a fresh inventory read; do not label the previous published edition empty or failed.

1. Freeze title inventory and select each nonreserved title's publisher issue date. A missing issue date blocks that
   title; reserved titles remain explicit inventory entries without text work.
2. Download versioned full-title XML. Retain hash and headers; a cached file is reusable only after source revision
   validation. Revalidate known issue URLs periodically for same-date corrections.
3. Stream-parse title/chapter/subchapter/part/subpart/section/appendix/table structure. Count source and emitted nodes.
   Preserve citations with lettered/dotted section numbers and exact anchors, not only integer section keys.
4. Write parser shards to normalized storage, targeting at most 5,000 provisions or 16 MiB uncompressed per shard,
   whichever occurs first. Split only at legal node boundaries; oversized nodes have dedicated shards and chunk later.
   Parsing workers consume the local artifact, so fan-out does not multiply eCFR requests.
5. Normalize in bounded staging transactions, validate every shard and the full title manifest, then publish the edition
   pointer. Missing sections/failed shards cannot result in partial-title replacement. New versions become searchable
   only through the separate derived-generation gate.
6. Use title/version/revision checkpoints, never the inspected code's title-number-only `--resume` skip. Retain historical
   membership and generate provision deltas from two fully validated editions. A disappearing section is not auto-repealed.

Default recurrence: inventory hourly; changed titles enter the freshness queue; daily revalidation of current-title
metadata and rotating artifact verification. Currency-only changes update coverage without re-embedding unchanged text.
Query eCFR point-in-time facilities only for source-supported dates; observed local snapshots do not establish earlier history.

## Annual CFR and U.S. Code

Annual CFR discovery is edition year -> title -> volume/artifact. Acquire and parse by volume; promotion is by the full
title edition after every required volume validates. Preserve each title's revision date, annual-edition provenance and
volume/page locators. Reconcile reserved/missing titles explicitly. Historical versions use the same provisions and
passages as current eCFR where identity is established, but remain distinct editions. Default semantic rollout targets
current eCFR and FR; annual historical text receives lexical indexing first and a separate explicit embedding manifest.

U.S. Code supports statutory context and authority resolution. Reuse official GovInfo download/parser patterns with
discovered edition/release keys; replace hardcoded 2024/2023 targets. Discovery runs daily once enabled. Do not describe
published annual packages as a current USLM release. In Phase 0, choose the latest verified official package scope and
record currency; add House USLM release discovery separately if the latest package is insufficient. A regulation may
ship with unresolved authority citations while the U.S. Code is incomplete; this cannot block independent regulatory text.
Statutes at Large and COMPS remain optional acquisitions with separate manifests, not hidden requirements of every rule.

## Trigger task graph

Proposed IDs/files under `src/trigger/tasks/`; workers call reusable services under `src/ingestion/regulations/`.
Tasks return IDs/counts, never full XML, large record arrays or embeddings.

```mermaid
flowchart TD
  A[Manual manifest or scheduled discovery] --> B[Durable units and dispatch outbox]
  B --> C[Bounded acquire workers]
  C --> D[Immutable Azure artifacts]
  D --> E[Parse shards and stage records]
  E --> F[Validate and publish edition or document]
  F --> G[Canonical transaction and derived outbox]
  G --> H[Lexical projection]
  G --> I[Embedding shards]
  G --> J[Event delivery after subscription gate]
  H --> K[Search readiness and coverage]
  I --> K
```

| Task ID | Bounded unit | Initial queue/concurrency | Maximum active duration |
| --- | --- | --- | --- |
| `regulatory-backfill-controller` | One manifest, one dispatch window | regulatory-control / 1 | 10 minutes |
| `regulatory-discover` | One provider partition or inventory page | regulatory-discovery / 2 | 10 minutes |
| `regulatory-acquire` | One artifact or bounded package | regulatory-acquisition / 4 | 30 minutes |
| `regulatory-parse` | One artifact or normalized shard stage | regulatory-parsing / 4 | 30 minutes |
| `regulatory-publish` | One document revision or complete title edition | regulatory-publication / 2 | 10 minutes |
| `regulatory-embed` | One deterministic passage shard window | regulatory-embedding / 4 | 15 minutes |
| `regulatory-project` | One projection generation/window | regulatory-projection / 2 | 10 minutes |
| `regulatory-reconcile` | One coverage scope/window | regulatory-control / shared 1 | 10 minutes |

These limits are initial measured-rollout settings, not throughput promises or allocations additive to unlimited
existing jobs. Source DB pools are capped at one per worker with short transactions; projection workers additionally
use one target connection each. The table allows at most 19 source and two target connections when all queues run.
Controllers close pools before checkpointed waits. Do not use the main API pool size inside these tasks.

Before activation, calculate available database and Trigger headroom alongside existing bills, OCR, embedding and search
copy tasks. Persist an operator-configured aggregate regulatory admission cap at or below the smaller of measured DB
and Trigger headroom. Queue totals are ceilings; stage admission can be lower. If no safe headroom exists, pause backfill.
Do not change existing production queue limits or introduce a new database image as a side effect of this spec.

## Dispatch, leases and retries

- Strict payload: manifestId, unitId, requestedGeneration, mode (`backfill`, `incremental`, `repair`), expected source
  revision and bounded shard coordinates. Mode is checked against the manifest; callers cannot supply arbitrary URLs,
  credentials, SQL, provider ranges or parser paths. Read configuration and safe source URLs from stored manifests.
- Deterministic unit keys include environment/provider/corpus/jurisdiction/edition-or-window/shard/parser contract.
  Trigger idempotency adds requested generation. Database unique work keys and fencing remain durable even after
  Trigger idempotency expires; choose global scope for cross-parent dispatch and an explicit TTL. Replaying a completed
  unit for a new parser uses a new generation rather than forcing a stale successful run to execute again.
- Claim pending outbox rows in a short transaction, submit `batchTrigger` pages of at most 100, retain task handles,
  then acknowledge accepted dispatches. A crash between submission and acknowledgement safely redispatches through
  idempotency and database claims. The installed SDK is 4.5.10; use its typed API, not copied obsolete SDK examples.
- Keep at most 200 dispatched/running regulatory units per environment at first. The remaining history stays in the
  database, not an enormous Trigger queue. A continuation controller replenishes the window as units finish; queue
  admission failures, expired tasks and cancelled runs return to durable reconciliation.
- Prefer dispatched children plus durable completion counts for large backfills. Use bounded `batchTriggerAndWait`
  only for small child groups and check every result; do not use `Promise.all` around Trigger wait helpers. Parent and
  child queues are separate. Close DB pools and persist progress before checkpointed waits.
- Lease key is unit scope, renewable every 30 seconds with an initial five-minute expiry; long parser work renews via
  the bridge without holding a transaction. Every state transition checks fencing. Check cancellation between shards
  and before publication. Cancellation preserves committed artifacts/checkpoints and leaves source state unchanged.
- HTTP retry: at most three attempts per active unit attempt for transient timeout/5xx, respecting Retry-After; count
  every attempt against provider budgets. Trigger task retry: two attempts for unexpected crashes. This gives a bounded
  maximum of six HTTP attempts for the same request in an ordinary cycle, not nested unbounded retry loops.
- A 429 writes a provider cooldown shared by all callers. Stop allocating that provider, release leases/slots or persist
  a resumable retry, and use a checkpointed wait/continuation. No long `setTimeout` sleeps holding a worker/pool.
- Permanent schema/parse failure enters quarantine with artifact/locator and safe reason. Missing listed artifacts are
  retryable then unresolved gaps, never successful empties. Operator repair takes IDs and reason, reuses the same stages,
  and does not reset whole corpora.

`inspect:regulatory-readiness --manifest <hash>` reconciles one immutable bounded current-source manifest without
dispatching work. It validates the manifest identity and exact unit denominator, counts every canonical unit state and
acquisition/parsing/publication intent, retains failed and cancelled attempt history, and exposes active leases,
uncertain submissions and remote-completion mismatches. A published unit is ready only when all three stage intents are
canonically complete, its artifact/parser/generation/edition references exist, its versioned display/search rights are
active and its lexical outbox row exists without a delayed retry. Quarantined units can be accounted for but cannot make
the manifest ready. This is bounded-manifest evidence; it does not prove that discovery exhausted a frozen source scope
or that a multi-manifest backfill is complete.

The implemented current-eCFR ingress keeps this window replenishment durable and bounded without registering a
schedule. `regulatory-ecfr-discovery` first commits the publisher inventory checkpoint and changed units, closes its
database pool, then submits one `regulatory-discovery-controller` run for a window of at most 25 units. The global
submission key binds the discovery scope and committed cursor, so replay of the same inventory cannot create a second
controller chain. An unchanged discovery submits no controller.

Each acquisition, parsing and publication worker advances canonical state, atomically marks its persisted dispatch as
canonically complete, closes its pool, and then submits another bounded controller run. The continuation key binds the
completed stage and immutable manifest/unit payload. If controller submission is uncertain, task retry reuses that key;
if canonical advancement did not occur, completion fails and no continuation is submitted. Publication continuation
only replenishes source stages. Passage preparation and lexical acknowledgement remain a separate explicit admission
path, and no part of this chain enables recurring discovery or embedding generation.

Official mechanics: [batch triggering](https://trigger.dev/docs/management/tasks/batch-trigger),
[idempotency](https://trigger.dev/docs/idempotency), [queues](https://trigger.dev/docs/queue-concurrency).
Queue concurrency limits active runs, not requests/second. `concurrencyKey` creates per-key queues; it is not a global
provider budget. The application must enforce shared request-start and connection allowances across keys and deployments.

## Throughput controls and scale test

Reuse application provider cooldown and publisher download leases. GovInfo API budgets must be shared with current
BILLSTATUS/committee callers using the same credentials. Treat GovInfo API, bulk host, FederalRegister.gov and eCFR as
distinct policies; respect actual redirects/hosts. Initial policies for sources without published numeric limits:
metadata at one request start/second and two in flight per host; bulk downloads two in flight per host. These are
conservative starting settings, not publisher entitlements. Existing stricter host limits win.

Reserve at least 25 percent of regulatory admission and provider allocations for incremental/repair work while backfill
runs; a saturated backfill pauses allocation as soon as freshness work is pending. Borrowed spare capacity is reclaimed
between bounded units. Update traffic from existing legislation remains included in aggregate source budget accounting.
Priority alone does not reserve capacity, so admission must enforce the reservation.

Normalize/commit at most 500 records or 2 MiB per transaction initially. Embedding batches use at most 64 texts plus
model token/byte limits. Avoid full-title arrays in RAM, OFFSET scans and one Trigger task per tiny section. Persist
large records externally and dispatch references. Reuse immutable artifacts for parser replays without network traffic.

Benchmark acquisition, parsing, DB writes, projections and embeddings separately. Increase one stage at a time:
2 -> 4 -> 8 -> 16 workers, only within measured aggregate headroom. Use a fixed manifest, one-minute warm-up plus
nine-minute measurement at each stage. Record completed/validated searchable provisions per minute, bytes, request
attempts, rate limits, parser RSS, pool wait, commit p95, lexical lag, provider/model cost and backlog age. A promotion
requires at least 10 percent throughput gain, no completeness loss, no growing live lag and no DB/provider saturation.
Choose the previous stage when a higher one fails; do not infer linear speedup from task count.

Suggested starting machines: small workers for discovery/control/publication; medium workers for XML acquisition/parsing
and embeddings. Select actual Trigger presets against measured peak RSS and deployment availability in Phase 0. A large
XML OOM is evidence to stream/split or deliberately resize the bounded task; retrying the identical oversized unit on
the same machine is not a recovery strategy.

## Schedules, health and operator surface

Extend `src/trigger/manifest.ts`, identities, activation policy and the existing schedule reconciler. Schedules remain
disabled until corresponding phase gates pass. Schedule dispatcher adds explicit regulatory scopes; historical
controllers stay manual. UTC schedules include jitter/stagger to avoid all current feeds firing simultaneously.

Planned CLI entry points, to implement under `scripts/`: `plan-regulatory-backfill.ts`, `run-regulatory-backfill.ts`,
`inspect-regulatory-readiness.ts`, `repair-regulatory-units.ts`. Planning/readiness are read-only. Running requires a
saved manifest, exact environment and `--apply`; schedule activation uses existing explicit activation semantics.
Never accept an implicit production target. Resuming an existing import takes the same manifest ID and cutoff.

Every report records requested/eligible/excluded/failed units, unresolved native IDs, bytes, parser revisions, source
currency, discovery watermark, projection generation and embedding route. Completion requires no unresolved required
units, not merely a green controller run. Persist compact metrics in run records; structured logs carry correlation,
manifest/unit/source IDs and counts, not secrets or entire source/user query bodies.
