# Supporting-material processing

Committee reports, hearing and meeting documents, fiscal notes, analyses,
testimony, and other supporting materials use the same durable acquisition and
extraction model as official bill documents. Each source record remains
independently queryable while its retained artifact, extracted text, and
searchable sections stay linked to the original bill, amendment, event, report,
vote, organization, or person.

## Processing contract

- `materials:process` selects pending rows first, then due retryable failures
  below the configured attempt limit. Deferred retries retain
  `next_attempt_at`; terminal outcomes are not silently reset.
- Historical work uses 24 deterministic material-ID shards. Selection,
  deferred-work checks, interrupted recovery, and ingestion leases all use the
  same shard identity, so the shards are disjoint.
- Each Trigger corpus child processes one bounded batch of at most 25 rows.
  The child has a 60-minute renewable ingestion lease and a two-connection
  database pool so extraction cannot starve its lease heartbeat.
- Each Congress.gov hostname has four globally shared download slots and a
  durable 300 ms interval between request starts. Shards share these limits;
  adding workers does not multiply publisher traffic.
- Downloads use streamed size enforcement and are stored under
  content-addressed Blob paths. PDF extraction is serialized inside each
  worker to bound memory expansion. PDFs above 750 pages are handed to managed
  OCR instead of monopolizing a worker during local page-by-page extraction.
- Reprocessing preserves material identity, source URL, canonical links, Blob
  provenance, and source-byte hash. Sections are replaced atomically and
  unchanged content is skipped by hash.
- Evidence-based unsupported formats and missing artifacts become terminal
  `unsupported` outcomes. Retryable acquisition or extraction failures retain
  their attempt count and exponential backoff.
- If Trigger retries a child after the process ends before releasing its
  ingestion lease, the retry may recover only a running database attempt with
  its exact Trigger run ID. It releases that lease and requeues only claims in
  the same shard made after the interrupted attempt started. A different
  workflow owner still follows the ordinary lease handoff.
- A material shard also treats every eligible `ocr-required` row in its own ID
  partition as unfinished work. Each continuation supplements newly detected
  OCR IDs with up to 100 older unowned IDs from that same shard. This makes the
  normal material workflow self-healing without restoring a polling sweep.

## OCR handoff

Image-only PDFs and supported image formats are retained and assigned the typed
`ocr-required` category. The material worker sends those exact IDs to
`ocr-document-worker` in batches of at most 100 and waits for the OCR children
to reach a durable outcome.

OCR updates the original material and its sections in place. A missing Blob
artifact returns only that material to ordinary processing for re-download. The
material shard then rechecks its own work before reporting a complete
checkpoint, so OCR cannot create late, unowned pending work.

The permanent OCR queue permits twelve concurrent workers. There is no
historical OCR polling task; any future unowned `ocr-required` accumulation is
an operational defect.

## Workflow gates and recurring work

The historical material root may start while unrelated state documents are
still draining, but it remains gated on federal bill documents and federal bill
OCR. Supporting materials are sourced from Congress.gov and do not depend on
Florida or Pennsylvania publisher queues.

After the historical root finishes, each successful hourly Congress wave
starts the canonical federal document lane. It also starts one bounded material
controller when no historical material root is active. Durable ingestion leases
serialize overlapping schedule attempts.

Material completion requires all of the following:

1. zero pending materials;
2. zero processing materials;
3. zero due or deferred retryable failures below the attempt limit;
4. zero eligible, deferred, processing, interrupted, or unowned
   `ocr-required` materials; and
5. a separate review of exhausted failures and evidence-based unsupported
   outcomes.

This gate passed, and the cost-controlled embedding rollout was explicitly
approved on 2026-08-22. New or changed material sections are now responsible
for their own incremental embedding refresh after durable text persistence.

## Operational settings

The accepted production policy is:

- 24 material shards;
- one bounded batch per corpus child;
- two database connections per material worker;
- a 60-minute material ingestion lease;
- four in-flight requests per Congress.gov hostname; and
- a 300 ms host-wide request-start interval.

PDF extraction is serialized per worker. A PDF above 750 pages is sent to
Azure Document Intelligence rather than keeping a local extraction child alive
for most of its lease. The accepted 60-minute canary sustained roughly 10,700
terminal materials per hour, completed the former long-PDF cases through OCR,
recorded no HTTP 429 or failed ingestion run, and stayed below the 80-session
database alert.

The diagnosis, controlled cutovers, same-run retry recovery, and production
evidence are retained in the
[ingestion remediation catalog](../operations/ingestion-remediation-catalog.md#post-download-processing-failures)
under DRV-010 through DRV-026.

## Search and retrieval

W owns [material search and document delivery](../../../legislation-web/docs/engineering/api/legislative-records.md)
and [retrieval dispatch](../../../legislation-web/docs/engineering/api/search-and-diffs.md).
C owns [canonical material records](../../../../packages/legislation-core/docs/engineering/data-model.md) and
[embedding/storage contracts](../../../../packages/legislation-core/docs/engineering/embeddings.md).
M owns [tool registration](../../../legislation-mcp/docs/engineering/tool-contracts.md).
