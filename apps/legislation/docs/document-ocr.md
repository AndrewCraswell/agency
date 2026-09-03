# Document OCR implementation and operations

## Purpose and status

This document is the canonical contract for detecting, processing, embedding,
and operating OCR-backed legislative documents. OCR is a derived-processing
step for a retained source artifact. It does not create a second document or a
second source record.

The recurring workflow is deployed, and the approved historical backfill and
page-range repair completed on 2026-09-03. OCR text, sections, embeddings, and
page-specific citation metadata are complete for the approved cohort.

## Verified pre-delivery production baseline

The following snapshot was measured on 2026-09-03 and is the baseline for this
work:

| Measure | Count |
| --- | ---: |
| Bill documents | 4,360,171 |
| Processing status `processed` | 4,079,439 |
| Processing status `unsupported` | 280,080 |
| Processing status `failed` | 652 |
| OCR status `processed` | 3 |
| Explicit `ocr-required` backlog | 0 |
| Sections produced by the three OCR documents | 9,199 |
| Current embeddings for those OCR sections | 0 |

This snapshot does **not** imply that 4.36 million documents require OCR. Most
processed documents already yielded usable native text. The unsupported and
failed cohorts must be classified by evidence before any OCR population or
cost estimate is claimed.

The existing `ocr-document-worker` uses Azure Document Intelligence's
`prebuilt-read` model, accepts at most 100 document or material IDs, runs one
provider request at a time, and shares a queue capped at twelve concurrent
workers. Those limits remain the starting safety boundary unless a measured
canary justifies a change.

### 2026-09-03 delivery evidence

- Commit `d5f25a5` deployed as Trigger version `20260903.1` and Railway
  deployment `43030469-b94d-49e2-b95e-f6d696b03305`.
- Production health and readiness returned HTTP 200; an unauthenticated
  document-detail request returned the required HTTP 401.
- Three content-hash-deduplicated embedding repair runs completed for the
  existing OCR documents: `run_06g6d6onva56gu3eee03m74q01`,
  `run_06g6d6ookqpcurdlh17rfrv701`, and
  `run_06g6d6op79tu0s81e75fo0k301`.
- Reconciliation found 9,199 OCR-derived sections, 9,199 matching embedding
  rows, and zero missing embeddings. The repair did not invoke Azure OCR.

At the time, this proved the deployed OCR-to-embedding repair path but did not
authorize a historical OCR sweep. The subsequently approved and completed
cohort is recorded below.

### 2026-09-03 historical backfill evidence

- Commit `8d1a6f0` deployed as Trigger version `20260903.2` and Railway
  deployment `beb4920f-470a-423d-8fef-0e5a87062fa4`.
- The exact retained-PDF cohort contained 319 documents and 1,485 pages.
- Thirteen bounded OCR runs processed all 319 documents with zero terminal
  failures.
- Reconciliation found 1,233 nonempty sections, 1,233 current embeddings, and
  zero stale embedding input hashes.
- The expected OCR charge is $2.2275. One four-page request timed out once and
  was retried, so the upper estimate is $2.2335 if Azure billed both attempts.
- The full execution evidence is recorded in
  [ocr-backfill-cost-report.md](ocr-backfill-cost-report.md).

## Required outcome

Every newly discovered or changed document must reach one durable outcome:

1. Retain the exact source artifact and compute its content hash.
2. Attempt ordinary local extraction.
3. Record `not-required` only when usable text and sections were persisted.
4. Detect and enqueue OCR when the artifact contains image-only or otherwise
   unreadable pages that the Read model supports.
5. Persist OCR text and sections atomically on the existing record.
6. Generate missing or stale embeddings from the persisted section text.
7. Expose the document as semantically searchable only after every eligible
   section has a current embedding.

The recurring synchronization path, targeted reprocessing, and approved
historical backfills must all invoke this same workflow. A successful source
sync alone is not completion of derived document processing.

## State contract

`processing_status` describes source download and text production.
`ocr_status` describes the OCR decision and provider execution. Null is allowed
only while the OCR decision has not yet been made for an actively processing
record.

| OCR state | Meaning | Permitted next states |
| --- | --- | --- |
| `pending` | OCR is required and the retained artifact is ready for dispatch. | `processing`, `unsupported` |
| `processing` | One owner holds the durable OCR claim. | `processed`, `failed`, `pending`, `unsupported` |
| `processed` | OCR text and metadata were persisted successfully. | `pending` only after the source content hash changes |
| `not-required` | Ordinary extraction produced usable text and sections. | `pending` only after the source content hash changes |
| `failed` | A retryable provider or infrastructure failure exhausted the bounded attempt policy. | `pending` after an explicit repair or retry decision |
| `unsupported` | The artifact cannot be handled safely by either extractor under the current contract. | `pending` after a supported implementation or explicit reclassification |

Additional invariants:

- `ocr_status = 'processed'` requires a nonempty provider, completion time,
  positive page count, persisted text, and at least one persisted section.
- `ocr_status = 'not-required'` requires persisted usable native text and at
  least one section.
- `processing_error_category = 'ocr-required'` requires `ocr_status` to be
  `pending` or `processing`; it must be cleared after a terminal OCR result.
- Provider metadata must be null unless OCR actually ran.
- A missing retained artifact returns the row to ordinary acquisition instead
  of repeatedly calling the OCR provider.
- A retryable download, provider, or persistence failure below the configured
  attempt limit returns `processing_status` to `pending` with a future
  `next_attempt_at`. Only an exhausted retryable failure becomes `failed`; a
  deterministic unsupported input becomes `unsupported`. The recurring
  pending-document controller therefore recovers eligible transient failures
  without reopening exhausted or deterministic outcomes.
- An older attempt must never overwrite results for a newer content hash.

## OCR detection

Detection happens locally after the source artifact is retained and before an
Azure request is submitted. It must classify at least these cases:

| Evidence | Decision |
| --- | --- |
| Local extraction produces usable text and valid sections | `not-required` |
| PDF has pages but no usable text | `pending` with `ocr-required` |
| PDF has both usable-text pages and image-only pages | `pending`; process the retained document as one immutable content-hash unit |
| Supported image artifact | `pending` with `ocr-required` |
| Corrupt or encrypted artifact | `unsupported` with a precise category; do not send it to Azure repeatedly |
| Missing or inaccessible artifact | Return to acquisition or the appropriate download failure; do not classify it as OCR failure |
| Provider-compatible document exceeds the local extractor's safe limits | `pending`; the OCR coordinator applies the configured paid-work limits before submission |

The detector must save its reason, observed media type, byte size, page count,
native character count, and number of pages with usable text. Detection should
use deterministic thresholds covered by fixtures. A MIME header or filename
extension alone is insufficient evidence.

Selective page OCR and native/OCR page merging are deliberately out of scope
for this first implementation. Whole-document processing keeps persistence,
section replacement, retries, and content-hash idempotency understandable. We
should add page-range optimization only after measured production volume shows
that its savings justify the additional merge logic.

Before reclassifying historical `unsupported` or `failed` records, produce a
stratified audit by error category, source, media type, and age. Do not treat
all 280,732 unresolved records as OCR candidates.

## Orchestration and ownership

The recurring post-sync coordinator owns the complete derived-processing chain:

1. Receive a successful source-sync outcome.
2. Dispatch the pending-document shard controller immediately after a successful
   GovInfo sync or OpenStates bills sync. It processes at most 100 documents per
   child run and carries the exact federal or state jurisdiction, pending
   status, and reserved shard lane across durable continuations. One
   synchronization occurrence is capped at 1,000 continuations, or 100,000
   documents. OpenStates schedules remain separately opt-in.
3. Submit the resulting OCR-required IDs to `ocr-document-worker` in batches of
   at most 100.
4. Wait for or reconcile terminal OCR outcomes without holding a database
   connection during provider waits.
5. Dispatch document-section embeddings for every document whose sections were
   inserted or replaced, including OCR-processed documents.
6. Reconcile the expected section hashes with the embedding records before
   declaring the document searchable.

Supporting-material processing uses the same worker with `materialIds` and the
same identity and budget rules. Its controller remains responsible for deferred
material retries. Bill-document and supporting-material ownership must not
allow a polling sweep to compete with an active targeted worker.

The database is the durable recovery record. An interrupted Trigger run may be
retried or reconciled, but no permanent broad OCR polling schedule should be
needed. Any eligible `pending` row without an active or scheduled owner beyond
the alert threshold is an orchestration defect.

## Idempotency and stale-write protection

The logical work key is:

`document kind + canonical ID + source content hash + processing operation`

Use that key for Trigger idempotency and retain it with operational evidence.
The following rules are mandatory:

- Repeated delivery of the same content hash reuses the existing completed
  result or safely resumes incomplete work.
- A changed content hash starts a new extraction decision and invalidates the
  old section-derived embeddings.
- The OCR claim records its content hash and owner. Completion updates use both
  values in the write predicate.
- OCR replaces text and sections in one transaction. Section embedding rows are
  removed or made stale in the same durable boundary before new sections become
  visible to semantic retrieval.
- Embedding upserts are keyed by section, model, and input contract. Freshness
  is determined by the hash of the exact normalized heading-and-text input.
- Retrying a completed request must not create duplicate documents, sections,
  embeddings, or provider submissions when a completed result is already
  durable.

## OCR-to-embedding contract

OCR and native extraction feed the same normalized section model. The embedding
input must use the persisted OCR section heading and text, not raw provider JSON
or an independently normalized copy.

An OCR document is searchable in lexical mode as soon as its transactionally
persisted text is available. It is eligible for semantic or hybrid retrieval
only when each eligible section has an embedding whose model, input contract,
and input hash match the current route configuration and section content.

The 2026-09-03 baseline of 9,199 OCR sections with zero embeddings was the first
repair cohort. All 9,199 received current embeddings before the historical OCR
backfill began.

## Failure and retry policy

- Retry provider HTTP 408, 429, and 5xx responses with the existing bounded
  short backoff policy and honor `Retry-After` up to the configured cap.
- Do not retry corrupt files, unsupported encryption, invalid media, or a
  completed analysis with deterministically unusable output without an explicit
  repair decision.
- Cap provider attempts per content hash. Exhaustion records `failed`, the last
  bounded error, provider request metadata, and the next operator action.
- Recover an interrupted `processing` claim only after its lease and safety
  window expire. Recovery must match the owner and content hash.
- A missing Blob artifact clears only stale derived state and sends the same
  canonical record back through acquisition.
- Provider success followed by embedding failure does not repeat OCR. It retries
  embedding from the durable OCR sections.

## Page and cost gates

Azure charges Document Intelligence by pages analyzed. PDF pages and image
files are counted as page units, and all pages are analyzed unless a page range
is specified. Billing is calculated monthly by model and page volume. See the
[Read model documentation](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/read?view=doc-intel-4.0.0),
[service limits and billing guidance](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0),
and [Azure Document Intelligence pricing](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/).

Do not hard-code a dollar estimate as an operational limit. Retail prices vary
by region, offer, tier, and effective date. Resolve the deployed resource's
current USD meter through the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
or the Azure pricing calculator when producing an approval report.

Required configuration:

- maximum provider pages per document;
- maximum provider bytes per document;
- per-backfill OCR page ceiling;
- per-backfill document ceiling;
- per-backfill estimated-spend ceiling;
- maximum provider attempts per content hash; and
- an alert threshold for pending OCR work without an owner.

The coordinator reserves estimated pages atomically before dispatch and records
actual analyzed pages afterward. Exhausted budgets leave work durably pending;
they do not convert it to failure. Recurring new-content OCR is not subject to a
daily spend limit. Historical backfill must remain separately approval-gated so
an archive wave cannot silently exceed its reviewed page and spend ceiling or
starve current ingestion.

Every approval estimate must report candidate documents, estimated pages,
unknown-page documents, current unit meters, expected OCR charge, and excluded
compute, storage, transfer, and embedding charges.

## Operational reconciliation

Backfill and repair runs must retain enough structured evidence to reconcile:

- documents detected as `not-required`, OCR-required, failed, or unsupported;
- detection reason and source distribution;
- estimated, reserved, submitted, and completed pages;
- provider request count, latency, throttling, retries, and terminal errors;
- queue age and count of eligible rows without an owner;
- OCR text characters, page count, section count, and empty-section count;
- sections awaiting embeddings, stale embeddings, and current embeddings;
- end-to-end time from source discovery to lexical readiness and semantic
  readiness; and
- the approved historical page and spend ceiling.

Detailed OCR dashboards and daily spend alerts are not a prerequisite for the
first bounded backfill. A run must still stop when it reaches its approved
historical ceiling, and incomplete or inconsistent durable states must remain
queryable for operator reconciliation.

## Production canary

The first deployment is a bounded canary, not a historical sweep. Use explicit,
reviewed fixtures for:

1. one ordinary text PDF that must remain `not-required`;
2. one small image-only PDF;
3. one mixed native-text and scanned PDF;
4. one repeated delivery with the same content hash; and
5. one source record whose content hash changes.

For each fixture, verify retained artifact identity, state transitions, provider
page accounting, OCR metadata, text and section integrity, page spans, embedding
freshness, API document detail, lexical retrieval, semantic retrieval, hybrid
retrieval, and canonical result mapping. Replaying the canary must produce no
duplicate source rows or sections and no unnecessary second OCR charge.

The canary exit gate is:

- every expected state transition is observed;
- the ordinary text fixture makes no OCR request;
- OCR page counts reconcile with Azure metrics;
- all OCR sections receive current embeddings;
- lexical, semantic, and hybrid results map to the same canonical document;
- no eligible OCR row is left unowned;
- retry and stale-write tests pass; and
- actual spend remains within the approved canary budget.

## Historical inventory and backfill

Historical work begins only after the canary exit gate passes. The first
approved cohort completed on 2026-09-03.

1. Classify unresolved records locally without calling Azure.
2. Produce counts by decision, source, jurisdiction, media type, error category,
   page-count band, and content age.
3. Separate definite OCR candidates from uncertain files requiring a sampled
   review.
4. Reconcile candidates against already processed content hashes so repeat
   source records do not create repeat provider charges.
5. Price the measured page population using the deployed Azure region and
   account offer.
6. Obtain explicit approval for the candidate scope, page ceiling, estimated
   spend, and rollback or stop conditions.
7. Run bounded waves, preserving capacity for current recurring
   synchronization.
8. Reconcile each wave through OCR, embeddings, retrieval, page metrics, and
   cost before launching the next wave.

Do not infer a future historical backfill size from the full document corpus.
Do not relabel all unsupported or failed records as OCR-required. Any future
archive cohort requires its own evidence-based selection and approval.

## Delivery status

1. **Contract and tests — complete:** state invariants, deterministic detection,
   content-hash idempotency, and stale-write rejection are covered.
2. **Recurring source coordinator — complete:** every successful GovInfo sync
   and OpenStates bills sync launches a jurisdiction-scoped pending-document
   drain, followed by targeted OCR and embedding work. OpenStates schedules
   remain separately opt-in. The OpenStates handoff is deployed in Trigger
   version `20260903.3`. Trigger version `20260903.8` extends the automatic
   pending/backoff recovery contract to the California archive and supporting
   material workers.
3. **Embedding repair — complete:** all 9,199 pre-existing OCR sections received
   current embeddings without repeating OCR.
4. **Paid production execution canary — complete:** the first 25-document batch
   completed before the remaining waves were released. The broader fixture
   matrix above remains the regression gate for claiming complete page-specific
   OCR fidelity.
5. **Historical inventory — complete:** the retained-artifact cohort and exact
   page-priced scope were reviewed before mutation.
6. **Approved backfill — complete:** all 319 approved documents completed in 13
   bounded waves with zero terminal failures.
7. **Page-range repair — complete:** Trigger version `20260903.7` re-analyzed
   the retained artifacts and updated only `document_sections.page_start` and
   `page_end`. The canary `run_06g6g9f3mh3f22o3p47ab4lv01` proved a two-page
   document with a blank second page, after which 13 bounded runs repaired the
   remaining cohort. Final reconciliation found 1,233 sections with zero null
   or invalid ranges. Document, section-content, and embedding digests remained
   unchanged. An authenticated production request for the canary document's
   section list returned `200`, echoed correlation ID
   `ocr-page-range-production-smoke`, and projected page range `1-1`.

## Final acceptance criteria

OCR implementation is complete only when all of the following are true:

- Every recurring source sync dispatches derived processing for its inserted or
  changed documents.
- Native-text documents do not incur OCR requests.
- Every OCR-required record has an active, scheduled, deferred, or terminal
  durable owner state.
- The same content hash is processed idempotently and a changed hash cannot be
  overwritten by stale work.
- OCR success persists complete metadata, nonempty text, sections, and usable
  page spans.
- Every eligible OCR section receives a current embedding, including the 9,199
  sections in the baseline repair cohort.
- OCR-backed content passes document-detail, lexical, semantic, and hybrid
  production smoke with canonical mapping.
- Azure page totals reconcile with application metrics and stay within the
  approved recurring or backfill budget.
- A historical inventory and explicit approval exist before any broad archive
  backfill begins.

All criteria are satisfied for the approved backfill. Page-specific citation
claims are enabled for this cohort because every nonempty OCR section now has a
validated, one-based inclusive page range.
