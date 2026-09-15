# Open States rollout requirements and results

## Blocking delivery priority: NC and Alaska end-to-end ingestion

Scope correction, September 15: production and local scraper validation are different databases.
Live read-only production checks confirm completed checkpoints for all 13 retained NC/AK session archives:
AK 30–34; NC 2017, 2017E1, 2017E2, 2017E3, 2019, 2021, 2023, 2025. Do not blindly reload them.
This proves archive checkpoint completion, not historical document/OCR/embedding or entity completeness.
The earlier assertion that historical bill ingestion had not happened was incorrect. A broad production document
inventory hit its 20-second read-only timeout; finer-grained coverage remains to be audited.
Bounded production acceptance for NC 2017E1: all 12 bills have routed bill embeddings; all 32 documents are processed;
all 81 extracted sections have routed section embeddings. No OCR was recorded for those documents. This one-session
result does not establish freshness or API/MCP acceptance for every historical session, but it disproves a blanket
claim that historical content/embeddings were never ingested. Inventory actual gaps before further production backfill.

User decision, 2026-09-15: do not onboard additional states until NC and Alaska
complete content processing and search acceptance. Checked source-import items
below mean record promotion only, not complete ingestion.

| Complete | Requirement | Acceptance evidence |
| --- | --- | --- |
| [ ] | Shared durable orchestration after scraper promotion | Backfill and recurring scrapes invoke the same bounded downstream services; retries and restarts cannot lose a handoff or duplicate work. |
| [ ] | Source artifact download and extraction | NC's 6,192 and Alaska's 15,064 currently pending document records have reconciled processing outcomes; preserve exact bytes, hashes and source provenance. Counts are a starting snapshot, not an OCR estimate. |
| [ ] | OCR when needed | Reuse existing OCR detection, claims, provider and persistence; persist native/OCR sections under the same document identity. Failed or unsupported content stays visible, not counted as success. |
| [ ] | Current embeddings | Reuse canonical product routes and input hashes; generate missing/stale vectors only. Scope workers to approved NC/AK records, including late OCR results. |
| [ ] | Search indexing and synchronization | Reuse PostgreSQL vector indexes and the existing ranked lexical projection; reconcile missing/stale rows and pending retries. Do not rebuild valid global vector indexes for routine additions. |
| [ ] | End-to-end API/MCP acceptance | Source-backed NC/AK fixtures cover native and OCR content, canonical citations, lexical/semantic/hybrid retrieval, changed-content refresh and interrupted-run recovery. Report uncovered source data separately. |

Shared embedding contract (`src/models/embedding-routing.ts`): bills and supporting
materials use `voyageai/voyage-4`, 1,024 dimensions; document sections, document-backed
amendments and structured amendments use `openai/text-embedding-3-small`, 1,536
dimensions. Query embeddings must use the matching route and input contract.
No per-state models, index copies or OCR implementations are planned. State-specific
code is limited to source parsing, selection, validation and host/request limits.

The local scraper CLI currently stops at canonical promotion. Existing Trigger
document dispatch and derived-processing services are reuse targets, not evidence
that this end-to-end connection has already been implemented or activated.

## Source and runtime milestones

### Non-document data follow-through (2026-09-15)

| Complete | Requirement | Latest evidence / remaining work |
| --- | --- | --- |
| [x] | Recheck source revision for held people | Upstream people HEAD remains `677c6d0a566ad9bd62b6324e502af76acc3d22f3`; no corrected-source refresh available. |
| [ ] | People and committee dependency closure | Preserve four Alaska history quarantines and dependent committee holds; NC Senate district 1 and full roster reconciliation remain unresolved. |
| [x] | Implement Alaska journal voter extraction | Shared prepared-source policy now fetches journals and parses complete, uniquely matching roll calls without person-ID guesses. Python parser/policy tests pass; 495 prepared files reverified; rebuilt container startup passes. |
| [x] | Bounded real-source voter acceptance | Actual patched scraper method yielded all 40 HB1 House yes voters from the May 7, 2026 page-2441 journal; no canonical writes. |
| [x] | Additional live journal cases | Parser matched HB1 Senate (19 yes/1 no), HJR4 House passage (28 yes/10 no/2 excused), and HJR4 amendment failure (17 yes/21 no/2 excused): 140 source positions across four roll calls including the House HB1 case. |
| [ ] | Full-session voter ingestion and sponsor/person linkage | New build has not replaced frozen-cycle fingerprints or been activated; broader journal fixtures, source-ID linkage and replay/promotion remain. |
| [ ] | Meetings, agendas, event details and historical coverage | Still open; documents and bill-vector completion do not close these lanes. |

Journal-change verification: four parser tests, seven source-policy tests, and six preparation tests passed
(one Linux-only preparation test skipped on Windows). The rebuilt isolated container passed startup and actual
patched-method HB1 replay. Full `pnpm verify` is not green for this change: the first run lost a temporary coverage
file; the isolated-directory retry passed 3,009 legislation tests but timed out in one unrelated five-second
OpenRouter retrieval test. That test passed separately (all three retrieval tests). No timeout threshold was raised
and no unrelated implementation was changed to hide the failure. Both existing NC/AK content processes remained active.

### Shared downstream canary evidence (2026-09-15)

- [x] 16:28Z check-in: Alaska worker active, 139 successful content batches since 15:53Z and no failed content runs or blocked database sessions. Local Alaska has 9,359/15,064 processed documents, 5,694 pending, 1,333 OCR completions, 46,848 sections and 11 pending routed section vectors at the repeatable-read snapshot. NC remains 6,192 processed with no missing routed vectors. Both vector indexes valid/ready. No duplicate worker or production writes; hosted Trigger status not verified.
- [ ] Unsupported Alaska outcomes now comprise six empty OCR responses and five MSG attachments. All empty-OCR source artifacts are retained, but only the earlier HJR14 map has been visually classified; do not extrapolate that finding to the other five. Four MSG artifacts are retained. Requeued exactly HB78 `2c2f0f99130fd7a5cae7e545`, the one older MSG failure lacking a blob, through the normal pending queue without resetting attempt history. MSG parsing remains unsupported. Rate-limit retry backlog fell from 546 to 495. No executable changes; last full verification passed.

- [x] Bounded exact-document recovery verified after 15:53Z: SB133 docid 3565 passed the shared claim-based extraction/OCR pipeline, OCR completed all ten pages, and all 11 sections received routed embeddings. Retained bill text is 21,514 characters; its opening matches the visually inspected source title and operative subject. No forced reset, index rebuild or production write. This closes the outlined-PDF canary, not every requeued file.
- [x] HB17 docid 13738 now retains its exact Outlook MSG artifact under SHA-256 `8fa638279fffabe0438e0749d8204fea84404ac5c3ba95c0342b029779be08e8`; filesystem hash verified. It remains unsupported for text extraction, correctly, rather than falsely processed. Exact-document replay used existing atomic row claims and the shared database host limiter while the ordinary state worker continued.
- [ ] Remaining format work: MSG parsing needs a reviewed parser dependency or approved conversion runtime; no dependency added and no name/body guessed from binary strings. Remaining outlined-document cohort outcomes, source throttling retries, search/API, entity/event and historical gates stay open. No executable changes in this verification turn; the preceding full verification passed.

- [x] 15:53Z verification closure: full `pnpm verify` passed for unsupported-artifact retention after the unrelated unused-file blocker cleared. Rechecked official NC Senate roster: Jerry Tillett remains listed as appointed September 3 following Bobby Hanig's August 24 resignation; upstream Open States people HEAD is unchanged at `677c6d0a566ad9bd62b6324e502af76acc3d22f3`. This reconfirms the existing source omission, not a new vacancy or permission to fabricate a person.
- [ ] Local Alaska: 8,245 documents processed, 6,816 pending, one processing, two unsupported, 1,136 OCR completions and 461 pending section vectors at 15:53Z. NC remains 6,192 processed with no missing routed vectors. MSG retention replay and SB133 outlined-PDF recovery still pending; code verification does not close these runtime gates. No duplicate workers or production changes.

- [x] 15:45Z MSG investigation: official Alaska HB17 docid 13738 returns HTTP 200 with a 279,040-byte OLE/Outlook file and declared content type `msg`; it is not a mislabeled PDF. Found and fixed a shared retention gap: bill and supporting-material workers now archive bounded downloaded bytes before format classification, preserving unsupported artifacts for later replay. Existing detection still rejects unsupported formats and no text/embeddings are invented. Forty-two focused download/job tests passed.
- [ ] Requeued exactly the local HB17 MSG record that had no blob path; worker replay must verify retention. MSG extraction remains unimplemented. Full verification stopped at the unused-file gate for unrelated concurrent `scripts/audit-regulatory-reuse.ts`; retention-change focused tests passed and the full check logged clean legislation lint. Alaska continues ingestion; NC current-session content and embedding freshness stay verified, but search/API, hosted and historical gates remain open.

- [x] 15:33Z repeatable-read local freshness audit: NC 2025 has all 2,338 bill and 36,187 section vectors matching canonical current input hashes, model contracts and dimensions; zero missing/stale. Alaska 34 has 856 fresh bill vectors; of 40,268 sections, 386 await vectors and zero existing vectors are stale. Reusable bounded read-only command: `pnpm inspect:openstates-embedding-freshness nc` (or `ak`, optional session argument). Returns nonzero for missing/stale vectors or empty scope; does not call providers or write production. Search/API and historical acceptance remain separate.
- [ ] Alaska retry inventory: 546 pending documents retain HTTP 429 download errors (542 at one attempt, four at two); latest recorded attempt 14:35Z, with scheduled retry times already elapsed. They remain eligible for normal bounded replay. Do not increase source concurrency merely to clear this rate-limit backlog.
- [x] Full `pnpm verify` passed after registering the reusable freshness audit command. This passing run also includes the pending-document priority implementation.

- [x] 15:23Z local NC current-session content milestone: all 6,192 documents processed, 12 via OCR; all 2,338 routed bill vectors and 36,187 section vectors present, with no processed documents lacking sections. HB87's final document completed after the worker resumed. This does not close input freshness, lexical/API acceptance, historical coverage or hosted activation.
- [x] Implemented one bounded due-document priority slot in the shared state worker, after carried embedding work, so pending/requeued documents behind the main cursor need not wait a full scan. Preserves the discovery cursor, jurisdiction/session scope, attempt budget, due time and existing job lease. Seven focused tests and legislation type checks passed.
- [ ] Full verification for priority selection is not clean: Next router acceptance collided with another running Next build; OpenRouter retrieval and regulations embedding-smoke each hit a five-second timeout. 2,826 tests passed; no unrelated build was interrupted or timeout threshold changed. Earlier full verification for vector-PDF eligibility passed.
- [x] Visually inspected HJR14 docid 7906: the retained one-page ArcGIS PDF is an unlabeled aerial map, consistent with OCR returning no text. Preserve the source artifact and no-text outcome; do not fabricate textual content or embeddings. Its generic processing-transient category remains misleading, but retryable=false already prevents repeated OCR charges.
- [ ] Alaska at 15:23Z: 7,426 processed, 7,632 pending, four processing and two unsupported; 963 OCR completions and 38 pending routed section vectors. Requeued outlined PDFs are still being revisited; SB133 canary remains pending at this snapshot. MSG extraction, full voter import, people/committee reconciliation, events and broader acceptance remain open.

- [x] 15:04Z failure investigation: visually rendered retained SB133 docid 3565, a ten-page bill PDF with readable outlined glyphs but no extractable text. PDF.js reports vector drawing paths, not raster operators. Fixed the shared OCR eligibility check to include vector graphics on text-poor pages; blank pages remain distinguishable. Real retained-file replay now reports OCR-required for all ten pages; 19 extraction tests passed. This is a generic format fix, not a bill-specific exception.
- [x] Requeued exactly 60 local Alaska unsupported documents with the old no-raster malformed error for ordinary extraction/OCR; retained original bytes and attempt history, did not mark them successful, and did not start an overlapping worker. Pending replay outcomes still require verification. The two other unsupported classes (MSG attachment and OCR no-usable-text) remain unresolved.
- [ ] 15:04Z local counts: NC 6,191/6,192 processed, 12 OCR completions and no missing section vectors; final HB87 document is unattempted and awaiting the next scan. AK 6,834/15,064 processed, 8,225 pending (including requeues), three processing, two unsupported, 857 OCR completions and 537 pending section vectors. Both states retain full bill-vector presence and valid/ready indexes. Existing two-state concurrency continues; no further fan-out before replay validation. Production and broader onboarding gates remain open.
- [x] Full `pnpm verify` passed for the vector-PDF change using isolated coverage output. Existing workers continued successful batches during verification.

- [x] 14:53Z check-in: both local workers active, with 495 NC and 118 AK successful batches since 14:29Z and no failed content runs in that window. No blocked database sessions. The older Alaska embedding backlog cleared: zero sections created on or before the 14:29:12Z snapshot remain without the expected model/dimension vector, including the previously pending HB2 sections. No manual repair or index rebuild was needed.
- [ ] Current local processing: NC 6,180/6,192 documents processed, 12 pending, 11 OCR completions, 36,163 sections and no missing routed section vectors. AK 6,544/15,064 processed, 8,467 pending, one processing, 52 unsupported, 815 OCR completions, 34,760 sections and 166 currently awaiting routed vectors. One OCR-required document is in flight. Both bill-vector sets are present and both indexes valid/ready. Broader freshness/search, hosted orchestration, source coverage and entity/event gates remain open. No production writes or worker duplication; hosted Trigger status not verified. No executable changes; last full verification passed.

- [x] 14:29Z check-in: both local workers active; 279 NC and 100 AK batches succeeded since 14:09Z, with no failed runs in that window or blocked database sessions. No duplicate dispatch, interruption, production writes or global index rebuild. NC: 6,034/6,192 documents processed, 158 pending, 8 OCR completions, 35,480 sections and zero missing routed section vectors. AK: 5,655/15,064 processed, 9,361 pending, 48 unsupported, 695 OCR completions, 30,327 sections and 21 missing routed section vectors. Bill vectors remain complete by existence; vector indexes valid/ready. Counts are a moving snapshot, not source/freshness acceptance.
- [ ] Unsupported Alaska source outcomes at 14:29Z: 46 malformed documents, one unsupported MSG attachment (HB17, docid 13738), and one OCR no-usable-text outcome (HJR14, docid 7906). Preserve these as unresolved coverage, not successful extraction. NC remaining pending records are unattempted, not exhausted retries. Hosted Trigger status was not verified; the active workers are local. Broader people, committees, journal voter ingestion, events, historical coverage and API/MCP gates remain open. No code changes in this check-in; last full verification passed.

- [x] 14:08Z local inventory: NC 5,747/6,192 documents processed, 445 pending, 8 OCR completions and 2,564 missing section vectors. Alaska 4,853/15,064 processed, 10,170 pending, 41 unsupported, 580 OCR completions and 45 missing section vectors. Both states have every routed bill embedding; both existing vector indexes remain valid/ready. No unresolved OCR or processed documents without sections at this snapshot.
- [x] NC's 13:49Z timeout drained active siblings and released all NC leases. Confirmed no NC process or lock before resuming from its durable checkpoint; the resumed worker passed nine batches. Alaska was not interrupted. Added bounded embedding deadline retries covering headers/body while preserving exact inputs and rejecting unrelated cancellation/errors. Thirteen focused tests, focused lint and legislation type checks passed.
- [x] Full `pnpm verify` rerun passed with isolated coverage output, including the new deadline tests. The initial attempt encountered a scoring-circuit simulation failure; no scoring-circuit fix was made in this work. Resumed NC completed 25 successful batches by the next database check.
- [ ] Broader acceptance remains open: these local counts do not establish production historical coverage, fresh search projections, full-session Alaska voter ingestion or people/committee/event closure.

- [x] 13:14Z live check: both existing local workers still active, NC through batch 283 and AK through batch 111. All 2,338 NC and 856 AK bills now have routed bill embeddings (existence, not input-freshness acceptance). Processed documents: NC 5,032/6,192; AK 2,979/15,064. OCR completions: NC 5, AK 359; no unresolved OCR or processed documents without sections at the snapshot. Both vector indexes valid/ready.
- [ ] Remaining local content at 13:14Z: NC 1,160 pending documents and 354 missing section vectors; AK 12,066 pending documents, 19 unsupported outcomes requiring review, and 1,199 missing section vectors. Existing workers continue without duplicate dispatch. Historical completeness, hosted orchestration/recovery, lexical synchronization and API/MCP acceptance remain open; no production activation or hosted Trigger verification in this check-in. No executable changes were made; the last passing code verification remains recorded above.

- [x] 12:57Z live check: both local workers active without overlap; NC batch 207 and AK batch 61 succeeded. NC has 4,147 processed documents and 1,925/2,338 routed bill vectors; Alaska has 2,455 processed documents and 856/856 routed bill vectors. OCR completions: NC 5, AK 289; no unresolved OCR at that snapshot. Existing vector indexes remain valid/ready and no database sessions are blocked.
- [ ] Alaska's 18 unsupported PDFs all report too little usable text and no detected raster pages. They require source-level review before assigning a coverage gap; they are not successful processing outcomes. Section-vector backlogs remain (NC 447; AK 1,134 at the snapshot), and vector existence alone does not establish input freshness or lexical/API acceptance. No workers were duplicated or interrupted, no production activation occurred, and hosted Trigger status was not verified in this check-in. Last code verification remains the passing 12:41Z result.

- [x] 12:34Z follow-up: NC remained active and passed 100 additional batches. Alaska exited again after two batches with unsettled top-level await; the prior PDF deadline is not evidence of complete resolution. Recovered only its two exact dead leases and one abandoned document claim; NC was not interrupted.
- [x] The Alaska SB83 document (`docid=12225`) downloaded and correctly classified as mixed-scan/OCR-required in isolated and repeated concurrent extraction replays. No document-specific exception or fabricated content was added. Fixed a separate verified resource-policy gap: the document worker now shares one PDF extraction limiter across concurrent bill batches, with reserved-slot handoff and failure-release testing. Network acquisition and embeddings retain fan-out.
- [ ] Sustained Alaska restart acceptance remains open. Restarted at two bill pipelines; first eight-bill batch succeeded. At 12:38Z local processed totals were NC 3,030 and AK 1,780, with one unresolved Alaska OCR item. Both existing vector indexes remain valid and ready. Do not declare the intermittent exit root cause resolved from one successful batch.
- [x] 12:41Z acceptance refresh: NC 3,111 processed documents, AK 1,846; zero unresolved OCR items in either state and zero blocked database sessions. Alaska passed seven restart batches. `pnpm verify` passed after the limiter change: 3,005 legislation tests passed, 131 conditional tests skipped, and four receiver tests passed. Historical source checkpoints remain distinct from these local current-session content counts; hosted Trigger activation was not performed or verified in this check-in.

- [x] Recovered the interrupted Alaska local run: verified no content worker remained, released its three exact pre-12:08Z leases, and requeued the two abandoned native document claims within that attempt's time window. No production writes.
- [x] Bounded PDF.js loading and decoding to 120 seconds with a referenced timer and awaited disposal, including failed loading. Budget exhaustion routes retained content to provider extraction rather than silently losing the process. This does not preempt synchronous CPU stalls or establish hosted hard-kill recovery.
- [x] Restart acceptance: an eight-bill Alaska batch succeeded with three successful OCR operations; 21 focused extraction/lifecycle tests passed. NC and Alaska bounded local continuations restarted at two bill pipelines per state. Earlier sustained processes had stopped (NC network timeout; AK unsettled top-level await), so earlier active-run entries are historical, not current liveness evidence.
- [ ] Complete sustained-run acceptance, network-timeout recovery, remaining content, lexical synchronization and API/MCP verification. A successful restart or scan round is not ingestion completion.
- [x] Post-recovery repository verification passed: `pnpm verify`, 3,004 legislation tests passed, 130 conditional tests skipped, plus four webhook-receiver tests. The shared ingestion database was not reset for integration testing. At 12:17Z local processed documents were NC 1,691 and AK 1,756; existing bill/section vector indexes remained valid and ready.

- [x] Reused the retained Azure manifest and existing archive importer for local NC 2017E1 replay: 12/12 bill records imported with no failures. Exact source bytes retained locally; no production writes or invented fuzzy dates.
- [x] Historical local content replay completed for NC 2017E1: 32/32 documents processed, 12 bill embeddings and 81/81 section embeddings. This matches the bounded production coverage counts for that session, without proving query-time search or input freshness across other sessions.
- [x] Content worker and gated Trigger payload now accept an explicit historical session, normalized through the canonical session identifier helper. Default current-session behavior remains unchanged; per-session checkpoints/leases are separate.
- [ ] Sustained current-content continuation is active (up to 1,000 bounded invocations per state, two bill pipelines each), stopping on failed batches. Historical content acceptance is proceeding independently; do not duplicate the active workers.

Historical replay: `node --env-file=.env --import tsx scripts/replay-openstates-session.ts nc 2017E1`.
Historical content: `node --env-file=.env --import tsx scripts/run-openstates-content.ts nc 2 8 2017E1`.
Replay is explicitly local, selects an exact retained manifest entry, retains source bytes and uses the shared checkpointed importer.

- [x] Added within-state bill fan-out (1–4 concurrent bills) under one state lease/checkpoint, with exact-target document leases and shared database-backed publisher throttling. A failed bill stops new admission and active siblings drain before releasing the state lease; regression tests cover that failure boundary.
- [x] NC live eight-bill samples: concurrency 1 took 14.0 seconds, 2 took 8.0 seconds, 4 took 7.0 seconds; all succeeded. Different source documents make this directional evidence, not a controlled speedup or full-backfill ETA. Two concurrent bills is the conservative operating default.
- [x] Alaska eight-bill samples also succeeded: 112.0 seconds at concurrency 1 (two OCR documents), 9.3 at 2 (zero OCR), 8.9 at 4 (two OCR). Workload/provider variance prevents attributing that entire difference to concurrency. Both states continue at two bill pipelines each; four-way samples showed little additional benefit. Database observations showed zero blocked sessions and approximately 5% CPU during one sample.
- [ ] Ten eight-bill continuation batches per state are running with concurrency two; do not overlap another coordinator for either state. No hosted activation occurred.
- [ ] Fan-out verification: 30 focused tests and scoped lint passed. Final `pnpm verify` stopped on concurrent regulations integration-test type errors (missing third arguments at lines 259 and 291), not on the state changes. Full verification must pass again before closure.
- [x] Added `pnpm inspect:openstates-content`: a local-only, repeatable-read, read-only inventory of document outcomes, routed embedding gaps and vector-index validity. It explicitly leaves freshness, lexical/API/MCP, hosted recovery and source-completeness gates unverified.
- [x] Added a bounded persistent carry-forward queue for incomplete per-bill embedding passes. These bills resume on the next batch rather than waiting for an entire state scan; scope/duplicate guards cover every carried ID, and a full queue cannot falsely complete a scan round.
- [ ] Closure work begun: 25 further bounded content invocations per state. Do not overlap a running per-state worker. Source completeness (NC upper-district gap; Alaska held people/committees and vote/event limitations), automatic hosted recovery/handoff and search acceptance remain separate gates.
- [x] Those two 25-invocation continuations completed successfully. At 10:54 UTC: NC 204 processed/5,988 pending documents; Alaska 226 processed/14,837 pending, 25 OCR processed and one unsupported. All processed documents have sections. Existing sections still missing routed embeddings: NC 331, AK 74; bills missing routed embeddings: NC 2,236, AK 746. Existence does not prove input freshness. Both local bill/section HNSW indexes are valid and ready.
- [x] Live carry-forward acceptance: NC HB1092 continued then cleared its pending entry; Alaska HB187 continued over successive batches and cleared. The queue remains bounded and persisted with the scan cursor.
- [x] 10:38 UTC check-in: no local content processes, held database leases or active/queued Trigger runs before continuation. Started ten bounded invocations per state, with separate jurisdiction leases and local-only writes.
- [x] Hosted worker now rejects recorded failed/partial results at its own task boundary, allowing task retries instead of returning a false successful task. Successful batch evidence is preserved; seven focused worker/policy tests passed. This does not close interrupted-attempt recovery or authorize activation.
- [x] Check-in continuation snapshot: NC 108 processed documents, 54 bill vectors and 304 passage vectors; Alaska 140 processed documents, 70 bill vectors and 348 passage vectors, including 15 OCR documents. Pending documents: NC 6,084 and Alaska 14,923; Alaska retains one unsupported outcome. No production writes.
- [x] Latest closure-report/carry-forward verification: focused tests (ten), service/web types and live report/replay checks passed. Final `pnpm verify` passed with 2,999 legislation tests, 124 conditional skips and four receiver tests. The earlier concurrent regulations lint blocker is no longer present.
- [x] Added a shared bounded NC/AK content worker using durable canonical pending/freshness state and leased per-state scan checkpoints. It resumes without requiring a live scraper callback and explicitly reports ingestion/search as incomplete.
- [x] First content-worker batches ran on two bills per state, processed source documents and generated missing embeddings. Separate saved cursors were verified in PostgreSQL.
- [x] Alaska real OCR canary: existing `leg-dev-document-intelligence` processed three pages into 3,470 text characters on the same document; a section embedding then completed.
- [ ] Connect the content worker to automatic scraper/hosted orchestration and finish bounded backlog continuation; this local worker is not production activation.
- [x] Final repository verification for the shared state worker and gated Trigger entry points passed (`pnpm verify`, exit 0), including the previously interrupted route/coverage checks. Focused worker/controller tests: six passed.
- [x] Added bounded `openstates-content-worker` and `openstates-content-controller` tasks, reusing the shared processor. Activation defaults closed via `OPENSTATES_CONTENT_ENABLED_STATES`; no hosted deployment, activation or scraper dispatch is claimed.
- [x] Configured PDF.js's installed image decoders for OCR eligibility. A retained Alaska HB118 JBIG2 PDF now replays as `ocr-required` without the missing-decoder warnings. Focused extraction/worker/controller tests: 24 passed.
- [ ] Hosted interrupted-attempt recovery and automatic producer handoff still require acceptance.
- [x] Parallel local continuation exposed and fixed a global document-lease collision: unpartitioned exact-jurisdiction jobs now use separate jurisdiction leases. A regression test verifies both lease and processor scoping. NC resumed from its unchanged failed-batch cursor.
- [ ] Local ranked-search acceptance requires a separate search database: the canonical test database has `vector` 0.8.6 but no available `pg_search` extension.

A finite local continuation (ten NC/AK pairs, two bills per invocation) completed after canary acceptance:
NC had 44 processed documents, 22 bill vectors and 142 passage vectors; Alaska had 45 processed documents,
22 bill vectors and 95 passage vectors, including two OCR-processed documents. These are local coverage snapshots.
A further ten bounded invocations per state were started concurrently, one process per state, with the approved OCR
endpoint configured. Do not overlap these processes with another content worker for the same state.
Alaska completed that continuation; NC stopped on the shared document-lock collision after two invocations.
After fixing jurisdiction lease scoping, four further invocations per state were started for concurrent acceptance.
Both completed successfully. The post-run local snapshot has NC 68 processed documents, 34 bill vectors and
201 passage vectors; Alaska 100 processed documents, 50 bill vectors and 233 passage vectors, including 12
OCR-processed documents. Pending counts are NC 6,124 and Alaska 14,963. One Alaska document remains explicitly
unsupported (insufficient text and no detected raster image), not counted as processed. Full ingestion remains open.
It resumes from saved state cursors, not from an assumed completed scrape callback.

Local continuation: `node --env-file=.env --import tsx scripts/run-openstates-content.ts <nc|ak>`.
It defaults to eight bills with two concurrent bill pipelines, two document candidates per bill and bounded embedding pages per invocation.
Optional positional arguments are concurrency (1–4) and bill limit (1–10): `scripts/run-openstates-content.ts nc 2 8`.
Configure `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` with the approved existing endpoint for OCR; provider authentication
uses the existing Azure credential chain. Missing OCR configuration stays visible in the saved outcomes.
Scan rounds restart for late OCR/source updates; a completed scan is not a coverage or search-readiness assertion.
At the first verified worker/OCR snapshot, NC had four processed documents and Alaska five; the remaining pending
counts were 6,188 and 15,059 respectively. No production writes occurred.

- [x] Isolate targeted embedding checkpoints by exact target IDs and product set; reject unscoped products and empty targets.
- [x] Completed targeted passes recheck freshness for later source/OCR changes; incomplete passes keep their continuation cursor.
- [x] Native extraction canary through shared document processor: one NC document/one section and one Alaska document/two sections persisted locally.
- [x] Paid embedding canary: two Voyage 4 bill vectors (1,024 dimensions) and three OpenAI Small section vectors (1,536 dimensions).
- [x] Identical embedding replays skipped all five current vectors and inserted none.
- [x] Final repository verification passed: 2,966 legislation tests passed, 124 conditional skips, and four receiver tests passed. Focused derived-processing suite: 20 passed.
- [ ] Durable automatic scraper-to-content handoff, full backlog and lexical/API/MCP acceptance remain open; the OCR canary passed above.

Reproduce locally with `pnpm exec tsx scripts/smoke-openstates-content.ts <nc|ak>` for one pending document.
Use `node --env-file=.env --import tsx scripts/smoke-openstates-content.ts <nc|ak> pending embeddings`
for at most four candidates per product from a processed document's bill/document scope. Only the embedding provider
key is inherited; database and artifact destinations are explicitly local. This smoke command is not the durable coordinator.
The initial inline CJS invocation failed module resolution before text extraction; the normal module command succeeded.
Those attempts used the existing durable retry policy, not a manual content overwrite.

- [x] Alaska live bounded extraction through shared runner: HB1/HB2, eight retained and replayed files; Linux Python tests passed.
- [x] Alaska HB1/HB2 read-only normalization: source-qualified sponsorship observations remain distinct without name matching.
- [x] NC frozen local cycle: 2,338 bills in 235 promoted batches, zero pending and zero unreleased batch holds.
- [x] Alaska frozen discovery and shared promotion wiring: 856 records/87 batches; first ten bills promoted locally.
- [x] Alaska staged concurrent acceptance: two and four workers passed; eight-worker failures drained safely and passed on lower-concurrency retry.
- [x] Alaska frozen-cycle local import: September 15 09:20 UTC confirmed 856/856 records in 87/87 promoted batches; importer exited successfully. Events remain disabled pending independent validation.
- [ ] Alaska downstream processing: the initial snapshot had 15,064 pending documents and no extracted sections or bill embeddings. Processing has advanced as recorded above; finish the backlog and lexical/API/MCP acceptance before readiness.
- [ ] Alaska vote detail: implement/validate journal voter extraction; current pinned scraper emits totals only.
- [x] Committee dependency planning holds complete affected rosters and propagates parent holds deterministically.
- [x] Wire eligible committee plans to atomic, observation-only promotion; Alaska local replay retained stable IDs for
  20 committees and 136 memberships, omitting 13 held committees and 97 assertions.
- [ ] Verify committee API/MCP results and close source completeness gaps before production activation.
- [x] Local Alaska membership HTTP acceptance: 20 organizations and 136 memberships, paginated canonical mapping,
  incomplete-roster warnings for current and historical queries, and 422 guards for all 20 incomplete detail profiles.
- [ ] Complete committee detail acceptance and MCP acceptance; observation-only HTTP success is not full readiness.
- [x] Local MCP SDK/HTTP-adapter checks: 54 canonical person lookups and 20 typed incomplete-organization guards.
- [x] NC shared local replay and acceptance: 506 people, 581 terms, 94 committees, 1,678 memberships; HTTP passed,
  168 MCP person lookups passed, 94 incomplete-detail guards passed. Current upper district 1 remains missing.
- [x] Preserve explicit source homepage links without claiming complete profiles: 73 NC and 18 eligible AK committees
  now retain website URLs locally; invalid/ambiguous links are reported rather than guessed.
- [x] Serialize people/committee imports per checkpoint stream and reject older retrieval observations or conflicting
  revisions at the same observation timestamp before canonical writes. Same-snapshot retries remain permitted.
- [x] Wire verified bounded NC bill archives to the atomic writer, session ownership check and immutable receipt.
- [x] Add the leased batch coordinator and token-checked release; twenty-one focused tests passed, including nine real
  PostgreSQL checks. The coordinator requires an adapter that stops its worker before resolving or rejecting.
- [x] Implement the local pinned-image Docker adapter, shared checked directory reader and shutdown-confirmation guard.
  Network-disabled container smoke retained failure evidence and confirmed removal; no canonical writes.
- [x] Fresh-source leased local canary: H1-H10 extracted, archived, promoted atomically and replayed stably. Initial
  stale-runner image was rejected, then refreshed offline; source-only sponsor/voter references remain unresolved.
- [x] Read durable per-cycle promotion receipts and validate exact pending batches. Local cycle: 1/235 batches and
  10/2,338 bills promoted; 234 batches pending. This is read-only resume inventory, not an activated dispatcher.
- [x] Connect one-batch local resume with post-lease receipt recheck and durable-result verification. Live resume
  advanced to 2/235 batches and 20/2,338 bills; 233 batches remain. Automatic scheduling is not enabled.
- [ ] Finish durable cycle scheduling, full-session execution and remaining acceptance before activation.
- [x] Persist confirmed-release ownership before scraper execution; unconfirmed workers block takeover after expiry.
  Only matching-token release clears the hold. Runtime containers carry a run-ID label for recovery inspection.
- [x] Provide local operator recovery requiring matching host, executor absence, original Docker daemon identity,
  no remaining run-labeled container and token-checked release. Real child-process hold/recovery smoke passed.
- [x] Bind actual Docker execution/shutdown checks to the claimed daemon identity. Local live cycle advanced to
  210/2,338 bills across 21/235 batches, leaving 214 pending; no production activation.
- [x] Add bounded sequential cycle processing that reuses resume, stops on failure, reports each durable result and
  reserves a full ownership window before admitting more work. Local two-batch acceptance committed H51-H70 and
  stopped at the configured limit; H71-H80 are next. Twenty-eight focused tests passed.
- [x] Replace extraction-wide session serialization with batch ownership and short same-inventory admission locking.
  PostgreSQL acceptance covers concurrent promotion, duplicate claims, conflicting inventories and expired shutdown holds.
- [x] Add configurable 1–8 worker waves that drain all admitted work before surfacing a failure; no replacement wave
  starts after a failure. Local recovery locates the exact batch ownership record by run token.
- [x] Live 2/4/8-worker stages passed at approximately 30/49/83 bills per minute. Eight workers selected for sustained
  local processing; differing bill complexity means these are directional measurements, not a controlled speedup claim.
- [ ] Cloud executor/runtime recovery and automatic activation remain unverified; local process checks do not establish
  termination of a hosted Trigger execution.
- [ ] Hosted MCP authentication and successful source-complete committee details remain unverified for this rollout.

People ingestion supports [non-destructive partial imports](openstates-people-quarantine.md). Source defects quarantine
individual people instead of blocking all valid people. Older whole-roster rejection notes are superseded only for
additive people/history imports; directory replacement, runtime activation and completeness gates remain unchanged.

Scope: finish North Carolina while onboarding Alaska with shared logic and state configuration. The user waived the
seven-day expansion delay on September 14; state-specific acceptance still gates activation. A checkbox means the pilot requirement has
passed real-data validation and required persistence/replay checks, not merely that code exists. No automatic national
rollout. California and credentialed jurisdictions enter last, after their current requirements are checked.

## Data requirements

The complete ordered task list is [Jurisdiction onboarding queue](openstates-jurisdiction-onboarding.md).

| Complete | Data type | Pilot acceptance | Historical scope and limitations |
| --- | --- | --- | --- |
| [ ] | People and external identifiers | Current roster, exact OCD person IDs, aliases, deduplication | Import available retired people and identifier history; inventory date coverage first. |
| [ ] | Legislative service and districts | Chamber, district, party, source-supplied terms | Preserve supplied dates; unknown dates remain unknown. |
| [ ] | Committees and subcommittees | Identity, chamber, hierarchy, source links | Inventory prior snapshots; current files do not establish complete history. |
| [ ] | Committee memberships | Every member resolved; separate return tenures; safe departures | Reconstruct only available dated observations; detected dates are not actual appointment dates. |
| [ ] | Bills and resolutions | Current-session extraction and canonical reconciliation | Retained session archives; report available sessions per state. |
| [ ] | Bill actions and status | Ordered actions and source dates | Coverage follows available bill archives. |
| [ ] | Sponsorships | Sponsor relationships resolve to canonical people | Coverage follows available bill archives and identity resolution. |
| [ ] | Votes and individual positions | Roll calls, totals, member votes reconcile | Inventory session coverage and unavailable individual votes. |
| [ ] | Bill versions and documents | Source links, text extraction, OCR when needed, search indexing | Inventory downloadable versions; unavailable source files remain visible gaps. |
| [ ] | Bill relationships | Referrals, related bills, committee links where supplied | Do not infer absent relationships from names alone. |
| [ ] | Meetings and events | Supported event scraper, dates, participants and documents | Measure upstream archive reach; do not promise all past meetings. |
| [ ] | Agenda items | Ordered items and explicit bill relationships | Only source-published agendas; not inferred outcomes. |

## Operational requirements

- [x] Select North Carolina and identify immutable source revisions.
- [x] Compare the retained August 17 nationwide archive manifest against live import checkpoints.
- [x] Complete a validation-only people/committee run with no unresolved relationships.
- [ ] Independently reconcile roster completeness, including the 49-person Senate snapshot.
- [x] Diagnose missing Senate District 1 and reject incomplete or duplicate district coverage.
- [x] Replay the retained pilot offline with file checksums and source-tree completeness checks.
- [x] Inventory all pinned NC retired-person files and report missing service dates without inferring them.
- [x] Check retained historical dates for calendar validity, reversed dates, and strict full-date tenure overlaps.
- [x] Implement immutable archive publication and verify local read-back, idempotency, and corruption rejection.
- [x] Archive the current people/committee pilot in Azure `state-sources` and verify remote read-back and rejection preservation.
- [x] Archive the retired-person history in Azure and reproduce the inventory from checksum-verified remote files.
- [x] Inventory legislative roles from current and retired files together, preserving source paths and unknown dates.
- [x] Run entity transaction integration tests against isolated local PostgreSQL, including historical term protection.
- [ ] Package and validate the upstream bills/events extraction runtime.
- [x] Build the pinned local acceptance image and pass offline startup for both NC lanes.
- [x] Complete real NC event extraction and retain checksummed artifacts in Azure.
- [x] Bound bill attempts to explicit identifiers and complete a real two-bill batch with Azure read-back.
- [x] Validate stable staging identities for bills, roll calls and official NC meeting notices.
- [x] Freeze and archive the live two-chamber bill inventory with bounded batch planning and replay checks.
- [x] Correct NC AM/PM vote parsing and confirm a new live scrape against official published times.
- [x] Verify build inputs before extraction, retain their fingerprint, and accept corrected vote clocks only on approved-build archive replay.
- [x] Verify atomic bill-batch receipts in isolated PostgreSQL: concurrent replay, conflicting evidence, late-write rollback and successful retry.
- [x] Preserve omitted bulk child collections per bill; verify explicit empty replacement independently in a mixed PostgreSQL batch.
- [x] Verify opt-in retention of existing action/vote organization links and exact voter-observation resolutions, without name matching or premature receipts.
- [x] Preserve exact sponsor resolutions and observation bounds; reject ambiguous identity replacement without name matching.
- [x] Validate exact frozen-batch scope and reject a successful subset canary as whole-batch completion.
- [ ] Retain raw artifacts durably and make replay reproducible.
- [ ] Promote atomically with correct tenure reconciliation and checkpoint handling.
- [ ] Verify retries, timeouts, publisher throttling, and non-overlap in Trigger.dev.
- [ ] Validate API/MCP reads and representative ID mapping after import.
- [x] Remove the fixed seven-day expansion delay as requested; retain acceptance and ongoing monitoring per state.
- [ ] Inventory ordinary states and onboard them individually, starting Alaska alongside NC completion.
- [ ] Add credentialed jurisdictions and California's special database runtime last.

## Result history

### 2026-09-14: Alaska onboarding and shared people validation

- [x] Reused the existing people/committee downloader and validator with explicit NC/AK profiles; no duplicated state importer. Alaska uses lower districts 1–40 and upper districts A–T, checked against https://www.akleg.gov/basis/commbr_info.asp.
- [x] Downloaded and validated the pinned Alaska source: 60 people (40 lower, 20 upper), 33 committees, 233 memberships, zero unresolved IDs and zero district coverage issues. This is pinned-snapshot validation, not independent verification of current membership or a production import.
- [x] Retained raw source files, checksums, source tree, report and normalized output at `artifacts/openstates-pilot/1789428291315-cdd9b259-4d7d-464c-8ff0-46c7c05f3c59`.
- [x] Thirteen focused validator/import tests passed, including Alaska lettered districts and rejection of cross-state paths and committees.
- [x] Full `pnpm verify` passed; legislation reported 2,775 passing tests and 103 conditional skips.
- [ ] Alaska archive promotion, historical coverage, bounded bills/events runtime and API/MCP acceptance remain open. NC coordinator wiring also remains open.

### 2026-09-14 23:13 UTC: transactional batch ownership

- [x] Implemented database-clock ownership claims, single-winner concurrent acquisition, bounded expiry, and rejection of renewal of an expired token.
- [x] Added opt-in ownership checks to bulk bill promotion under a row lock and again after receipt insertion. Expiry during writes rolls back canonical data and receipt together.
- [x] Eight isolated PostgreSQL tests passed, including deterministic mid-insert expiry, stale-writer rejection, takeover after expiry, and idempotent claims without deadline extension. Both application type checks passed.
- [x] Full `pnpm verify` passed: legislation reported 286 passing test files and 2,774 passing tests, with 103 conditional tests skipped. The eight ownership/receipt integration tests passed separately against local PostgreSQL.
- [ ] Live coordinator claim/dispatch/promotion wiring, cycle ordering, source concurrency control and production activation remain open. These primitives alone do not serialize live scraper execution.

### 2026-09-14 23:07 UTC: immutable dispatch validation

- [x] Implemented create-only dispatch records binding an attempt ID to a verified frozen inventory and exact batch. Identical publication is idempotent; conflicting reuse is rejected.
- [x] Preparation now requires the matching dispatch and rejects another attempt, another batch, future execution windows and expired attempts. Windows are positive and capped at thirty minutes.
- [x] The 25 focused archive/mapping/planner tests and both application type checks passed.
- [ ] Full `pnpm verify` passed static checks but failed during coverage generation because `coverage/.tmp` was removed during execution. A clean non-overlapping coverage run is still required; database integration tests were skipped in this run.
- [ ] Dispatch records are not locks. Durable exclusive ownership and a final freshness check inside the canonical import transaction remain required; no production scraping or imports were activated.

### 2026-09-14 22:52 UTC: archive-to-batch preparation

- [x] Added read-only preparation linking the frozen inventory and exact batch scope to the checksum-verified archive and separately approved scraper build.
- [x] Preparation records the digest of the same manifest bytes used for validation; it returns `prepared`, never `promoted`, and performs no canonical writes.
- [x] All 25 focused archive, mapping and frozen-inventory tests passed, including wrong-batch, unapproved-build and invalid-time rejection.
- [ ] Coordinator dispatch freshness, lease ownership, transactional promotion and production activation remain open. Preparation alone does not establish freshness or authorize an import.
- [ ] Repository verification remains blocked: this run stopped on lint errors in concurrently edited regulations code, including `fr-metadata.ts`. Those unrelated changes were left untouched.

### September 14, 22:29 UTC check-in

The separate regulations task is active and changing shared schema/migration files. No local Open States scraper
process or active session in the isolated test database was observed; no database write or overlapping worker was
started. The dependency-ready frozen-batch validator was implemented instead. Five planner tests passed. A replay of
the retained S1092 canary against the live frozen inventory correctly rejected it because its batch also requires S1091.
The validator is not yet coordinator integration or proof of extraction freshness for a cycle.

Full `pnpm verify` was attempted and failed on three unlisted `tiny-invariant` imports in the concurrently developed
regulations files (`import-normalized.ts`, `storage.ts`, `storage.integration.test.ts`). Those files were preserved.
Production import, Trigger runtime activation, current roster completeness and seven-day acceptance remain open.
The authenticated Trigger check returned no executing, queued or waiting runs in the accessible environment.
Production PostgreSQL sessions were not verified during this check-in; no production database connection was available
in this process. This is not a claim that all remote database work is idle.

### Current four-item closeout status, September 14

| Item | Status | Remaining acceptance |
| --- | --- | --- |
| Stable mapping | Partial: tested staging adapters; live bills/votes and three meeting notices validated; approved-build clock replay verified | Reconcile canonical relationships and integrate the write path |
| Automated coordination | Partial: immutable live inventory and tested resume planner | Deployed Trigger children, durable promotion receipts, leases, recovery and source throttling acceptance |
| Safe import | Partial: atomic bill/receipt primitive verified in isolated PostgreSQL; no production writes | Wire verified scraper batches with relationship preservation, historical committee promotion and roster gate |
| Production acceptance | Open | Approved runtime activation, authenticated API/MCP reads and seven actual observation days |

New evidence: the live NC `2025` feeds contain 1,246 House and 1,092 Senate bills (2,338 total), partitioned into
235 batches. Raw XML and a frozen plan were uploaded and verified at
`openstates/scraper-plans/nc/2025/nc-discovery-20260914-cycle1/plan.json`. No batches were automatically launched.
Each cycle gets its own identity, so receipts for unchanged bill identifiers from yesterday cannot suppress today's
refresh. Tests reject another cycle's receipts, incomplete promotion, feed conflicts and corrupt replay.

The two-bill retained canary maps to `bill:nc:2025:sjr:1091` and `bill:nc:2025:sb:1092`, with four stable roll calls.
All 336 name-only vote positions remain unresolved and create zero people. No name-only person mapping was added.
The live calendar's official notice numbers 10724, 10725 and 10726 now survive extraction and map to stable event IDs.
The seven-file event run was archived/read back at the scraper revision prefix under
`nc/events/nc-events-notice-canary-20260914/retained.json`; local directory `openstates-nc-myh3fu_0`.

Clock diagnosis: a PowerShell display converted source offsets to the workstation timezone; that was not a scraper
timezone bug. Separate inspection confirmed a genuine AM/PM parser bug (`%H` with `%p`). The official SB 1092 page
lists 6:07 p.m. and 4:53 p.m.; old raw records contained 06:07 and 04:53 Eastern. The corrected `%I` parser produced
18:07 and 16:53 Eastern in a new live scrape. Its seven files were archived/read back under
`nc/bills/nc-vote-clock-canary-20260914/retained.json`; local directory `openstates-nc-fc17e5xj`.
Do not shift old timestamps by a guessed offset. Re-scrape and verify corrected build provenance.

Follow-up provenance acceptance: the runner now reconstructs its source inputs from the pinned archive and exact
source policy before starting the subprocess. It records the verified build-input manifest SHA-256 in the attempt.
Archive replay accepts clocks only when this fingerprint equals a separately supplied deployment-approved fingerprint;
missing fingerprints, other builds, failed attempts and changed raw bytes fail closed. Old evidence remains readable,
but the ordinary raw mapper still withholds its clocks.

A fresh SB 1092 extraction (`openstates-nc-oqh5gzuq`) retained seven files in the local immutable
`artifacts/openstates-runtime/provenance-archive` store, at the revision prefix under
`nc/bills/nc-provenance-canary-20260914/retained.json`. Approved fingerprint:
`11089591d74e926aea1bc98ecb0991bb0fb2c7512d1774e7311a630c44067274`.
Replay produced `2026-08-04T22:07:00.000Z` and `2026-07-28T20:53:00.000Z`, matching the previously checked official
Eastern times. Its 168 name-only positions remain unresolved. This run used the current adapter mounted read-only into
the pinned local acceptance image; it is not evidence of a new published image or production deployment.
The provenance subtask passed 23 focused TypeScript tests, 29 Linux Python tests, focused lint and service type-check.
The subsequent full `pnpm verify` completed successfully (including coverage), superseding the earlier unrelated lint
failure below. Database-dependent tests skipped by their environment are not production acceptance evidence.

The clock-corrected local image built successfully with config digest
`111845cb109225b18cb749360d6b2521dfde5351998092580eb02c967491de45`; offline startup and 28 Python tests passed.
Eight focused TypeScript mapping/planning tests and the service type-check passed. Full `pnpm verify` was attempted
but is not clean: concurrently changed regulations files failed lint (`artifact-backfill.ts` and
`scripts/plan-regulatory-backfill.ts`, nested ternaries). Those files were not changed by this work. Shared bill-write
code also has concurrent edits; no overlapping changes or production deployment were made. This evidence does not
close the four items or start the observation clock.

| Date | Run or change | Result | Production effect |
| --- | --- | --- | --- |
| 2026-09-14 | Source inventory at people revision `677c6d0a566ad9bd62b6324e502af76acc3d22f3` | 169 NC legislature files and 94 committee files discovered; not yet evidence of complete coverage. | None. |
| 2026-09-14 | Validation-only run `1789397722441-6890806d-c02a-4bdf-92ff-12a390dcaf42` | Passed: 169 people (120 lower, 49 upper), 94 committees, 1,678 memberships, zero unresolved member IDs. Raw YAML and checksums retained. This is identity/structure validation, not independent roster completeness. | No database writes or schedules. |
| 2026-09-14 | Adapter verification | Five focused tests and legislation type checks passed. Root checks passed; full verification stopped on an unrelated Shopify size-chart test timeout (5 seconds). | None. |
| 2026-09-14 | Independent Senate District 1 check | Official NCGA roster and biography list Jerry Tillett, appointed September 3, 2026. The latest pinned Open States snapshot lacks District 1. This is a source omission, not a current vacancy. No identity was invented. | Promotion remains blocked. |
| 2026-09-14 | Completeness gate and offline replay | Seven focused tests passed. Replaying all 263 retained files now correctly returns `rejected`, with `upper/1/count=0`, despite zero unresolved committee member IDs. The earlier validation result covered structure/identity only. | No database writes. |
| 2026-09-14 | Historical file inventory | Pinned NC directory also contains 358 retired-person files. Their term coverage and date ranges are not yet validated; file count is not historical completeness. Four executive and 21 municipal files are outside this legislative pilot. | None. |
| 2026-09-14 | Historical content inventory `1789399573639-94b8a6f2-7157-4ef6-bbe1-5fe10777fc75` | Parsed all 358 retired files: 334 people with 362 NC legislative roles. Earliest supplied start 2003-01-01, latest supplied end 2026-08-24. 114 roles lack starts; zero lack ends; no partial dates or reversed equal-precision dates found. These extrema do not prove continuous coverage since 2003. | Raw files and checksums retained locally; no canonical writes. |
| 2026-09-14 | Activity check | No local pilot process was active before this run. Recent Trigger results showed passage synchronization executing; it was left untouched. Direct PostgreSQL status could not be read because connection/query failed. Only isolated local validation was run. | No remote jobs launched or modified. |
| 2026-09-14 | Historical inventory verification | Four focused history tests passed. Root static checks passed. Legislation suite: 2,643 passed, 74 skipped; four receiver tests passed. Full `pnpm verify` with `TURBO_CONCURRENCY=2` still running (local session 8182); do not start a duplicate verification. Shopify tests passed this run. | No deployment. |
| 2026-09-14 | Verification completion | Previous full `pnpm verify` exited successfully with `TURBO_CONCURRENCY=2`; all nine test tasks passed. Session 8182 is finished. | None. |
| 2026-09-14 | Historical date validation | Eight focused tests passed before final lint correction. Checksum-verified offline re-read of all 358 files found no impossible dates, reversed dates, or strict full-date overlaps in the 362 legislative roles. All 114 unknown starts remain unknown. Same-day transitions are allowed; unknown-date overlap cannot be determined. | No database writes. |
| 2026-09-14 | Date validation final verification | Full `pnpm verify` passed with `TURBO_CONCURRENCY=2`. Legislation: 2,647 tests passed, 74 skipped, plus four receiver tests passed. Session 16696 finished successfully. | No deployment or remote job changes. |
| 2026-09-14 | Archive implementation and local canary | Four archive tests passed. Copied 263 YAML files plus tree/report metadata (265 objects) to an isolated local archive; verified read-back and reproduced the expected missing-seat rejection. No overwrites; a completion manifest is written last. | No canonical writes. Azure verification pending. |
| 2026-09-14 | Azure archive canary | All 265 objects uploaded to the existing `state-sources` container and read back with verified hashes. Completion marker: `openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/entities/1789397722441-6890806d-c02a-4bdf-92ff-12a390dcaf42/complete.json`. Replay correctly remains rejected for missing upper district 1. | New immutable source artifacts only; no canonical database writes, permissions changes, or deployments. |
| 2026-09-14 | Archive final verification | Full `pnpm verify` passed with `TURBO_CONCURRENCY=2`: legislation 2,651 passed, 74 skipped, four receiver tests passed. Session 98539 completed. | No deployment. |
| 2026-09-14 16:30 UTC | Activity check | No local onboarding process was active. Recent Trigger results showed passage synchronization run `run_06ga1g92e5oj044spnf2tp6n01` executing; left untouched. Database activity remains unavailable after connection/query failure. | No remote jobs started or interrupted. |
| 2026-09-14 | Historical Azure archive and replay | Archived 358 retired YAML files plus tree/report metadata, then verified remote checksums and re-ran the inventory: 334 people, 362 roles, 114 unknown starts, no date issues. Seven archive tests passed, including rejection of mixed current/history lanes. Manifest is under `nc/history/1789399573639-94b8a6f2-7157-4ef6-bbe1-5fe10777fc75/complete.json` at the pinned people revision. | Immutable Blob artifacts only; no canonical writes. Historical completeness remains unproven. |

Historical archive final verification: full `pnpm verify` passed with `TURBO_CONCURRENCY=2` on September 14, 2026.
Legislation: 2,654 passed, 74 database-dependent tests skipped, plus four receiver tests passed. Session 94677 finished;
no archive or verification process remains active from this check-in. No deployment or canonical import occurred.

Combined people inventory, September 14, 2026: checksum-verified 169 current and 358 retired files (527 total).
They contain 503 people with 577 NC legislative roles; earliest supplied start is 1996-05-09, not the retired-only
2003 minimum. There are 120 missing starts and 169 open ends, with no date issues. Open ends in current files are
not flagged as retired-source errors. No dates were inferred and no canonical records were written. Ten focused
history tests passed. This confirms why a history import must include current people, not just the retired folder.
Current/retired duplicate identities are rejected for review, and every role retains its source file path.

At the 17:01 UTC activity check, no local onboarding process was running. Recent Trigger results showed
`congress-wave-coordinator` and passage synchronization active; neither was modified. Database activity remained
unavailable. The existing current-person normalizer emits one current term; full source-role promotion is still pending.

Live archive audit, September 14, 2026: `DATABASE_DIRECT_URL` successfully supports read-only queries; the pooled
`DATABASE_URL` returned PostgreSQL `08P01`. The database has 627 non-federal sessions across all 52 supported
jurisdictions. Every one of the 624 archives in Azure
`manifests/openstates/session-json-2017-onward-2026-08-17.json` has a matching `complete: true` checkpoint.
This proves completion against that retained manifest, not against newly published archives or every child record.
The public index returned HTTP 200 but no discoverable archive links, so latest-source comparison remains open.
Do not classify the other checkpoint streams as failed archive imports without identifying their lane.

NC bill counts match all eight completed archive checkpoint indices: 2017=1,953; 2017E1=12; 2017E2=8;
2017E3=9; 2019=2,109; 2021=2,095; 2023=2,005; 2025=2,338. No NC archive reload is indicated by these checks.
There are zero NC legislative-term rows. Nationwide, zero legislative terms and zero organization memberships have
`source_provider = 'openstates'`; source-null rows were not classified by that query. Organization source counts are
OpenStates=1, null=385, Congress=243, GovInfo=850. This distinguishes bill-history completion from entity-history
readiness. No production writes, reloads, or deployments were performed during this audit.

Combined history verification completed successfully: full `pnpm verify`, session 59475, 2,656 legislation tests passed,
74 skipped, four receiver tests passed. Subsequent archive audit changes are documentation-only.

Term mapping implementation, September 14, 2026: `people-term-plan.ts` maps the combined retained sources to 577
canonical term candidates, preserving 120 null starts. Identity excludes the end date and current/retired file location
so closing a term does not create a duplicate. Distinct starts produce separate identities; indistinguishable
unknown-start terms and partial-precision dates block normalization rather than being merged or rounded. Historical
party and office titles remain null until source-backed mapping exists. Three focused tests passed. This is a plan,
not a production import: people persistence and atomic promotion remain unfinished. Corrections to identity-bearing
start dates will require reconciliation, not blind upsert. The archive CLI reports planned term counts for historical
replay. Full verification passed in session 33745: 2,659 legislation tests passed, 74 skipped, and four receiver tests
passed. The session is finished. No production writes occurred.

People import implementation, September 14, 2026: `import:openstates-people` reads the two immutable Azure manifests,
verifies their lanes/checksums, prepares current and retired people plus terms, and defaults to validation-only.
Explicit `--apply` uses the existing transactional snapshot writer only after roster acceptance. People, terms and
checkpoint share one transaction; organization replacement is disabled and unobserved people/terms are preserved.
Protected term imports take a transaction advisory lock and reject reactivation of an existing ended term. Three
focused import tests passed. A database integration test covers preservation and ended-term rejection but requires an
isolated test database; it must never be pointed at production.

The real Azure dry run prepared 503 people and 577 terms, then exited 1 with `upper/1/count=0` and
`canonicalWrites=false`. This is the expected safety rejection, not a completed import. Atomic database integration
and positive production/API acceptance remain open. The directory-specific upstream committee history contains 51
commits at the pinned revision, from 2021-05-06 through 2026-08-27 (2021:8, 2023:2, 2024:15, 2025:16, 2026:10).
Commit dates are repository observations, not appointment dates; renamed/older paths and snapshot semantics still need
review before this becomes a historical-membership import. No committee history was written.
The oldest directory snapshot (`eb1a5ec1e1e3c137eac8bd869efea92e09241440`) has 60 committee files in a non-truncated
tree. Its sampled Agriculture file uses `parent: lower`, lacks the current jurisdiction/chamber fields, and contains
at least one `person_id: null` entry (B. Jones). Historical parsing therefore needs an explicit source-format adapter
and unresolved-ID reporting; the current snapshot validator cannot simply be reused, and name-only matching is forbidden.
This is one sampled file, not an all-committee historical audit.

Import implementation verification finished: full `pnpm verify` passed in session 51957, with 2,662 legislation tests
passed, 75 database-dependent tests skipped, and four receiver tests passed. No positive database-import acceptance
is claimed; the Azure rejected-source dry run completed without writes. Production remains gated by roster completeness
and isolated database integration verification.

Historical committee parser and real-data runs, September 14, 2026: raw files and checksums are retained under
`artifacts/openstates-committee-history/`. The parser supports explicit old `parent` chamber values, preserves multiple
different roles for one person, rejects exact duplicate assignments, and never derives departures or effective dates.
Missing person IDs are reported, not guessed. Year samples are not a complete replay of the 51 commits:

| Snapshot | Commit | Committees | Role entries | Missing person IDs |
| --- | --- | --- | --- | --- |
| 2021 | `eb1a5ec1e1e3c137eac8bd869efea92e09241440` | 60 | 1,027 | 12 |
| 2023 | `42887e2ad272ebee1461c831e9edd857a0987acd` | 93 | 1,522 | 142 |
| 2024 | `3f463a03b5bba4684badf4fd4d7528a4a335031d` | 98 | 1,507 | 0 |
| 2025 | `3bb3a7e04b87ec19a64f02718c88dd4a39d2579b` | 88 | 1,515 | 0 |
| 2026 | `cec7dd8d4a9febc709b07513823c84fb2e4fa36f` | 94 | 1,678 | 0 |

The 2023 initial parser rejected Norman W. Sanderson's separate co-chair and ex officio roles. After correcting that
assumption, checksum-verified replay of all retained files produced the above counts. Its original failure marker
remains; no successful download report was fabricated. Presence of person IDs is not canonical identity reconciliation.
Full `pnpm verify` passed after the correction (session 80730). All inventory processes finished; no production writes.

Read-only coverage audit: NC has 30,315 processed bill documents and one unsupported document, but zero legislative
events. State events exist in 14 other jurisdictions; federal events number 33,164. The pinned NC event scraper reads
the current legislative calendar and has no historical-window argument; it is not evidence of past-meeting coverage.

Local database verification remains blocked: test connection returns `ECONNREFUSED`. Starting Docker Desktop and
`docker desktop start` both failed to make the Linux engine available. Docker's backend log reports inability to rename
`sailor-ingest.sock` (Windows error 1920); moving that temporary socket failed and removal was blocked by execution
policy. No Docker reset, volume deletion, or database deletion occurred. User requested local Docker rather than an
external temporary database. Do not provision an external test database under the earlier unanswered request.

Docker recovery follow-up, September 14, 2026: after the user reopened Docker, engine 29.7.2 responded. Started the
repository's local pgvector PostgreSQL service with Compose; verified the target database was local `legislation_test`
with no other sessions before running the destructive test-fixture setup. All 20 entity integration tests passed.
The first pass exposed interference from the new test's unnecessary committee fixture; changing it to a people-only
fixture removed that interference. Existing membership tests and the new ended-term/absence safeguards all pass.
Only isolated test schemas were created/dropped; no production rows or Docker volumes were deleted. The local database
is left running for subsequent tests. Positive end-to-end source import is still blocked by the incomplete NC roster.
Final repository verification also passed: 2,667 legislation tests passed and 75 database-dependent tests were skipped
in the default run; the 20 entity integration tests were separately run with the local database enabled and all passed.
Session 3972 completed successfully. Four receiver tests passed as well.

Independent validation references (not additional ingestion providers):
[NC Senate roster](https://www.ncleg.gov/Members/MemberTable/S) and
[Jerry Tillett biography](https://www.ncleg.gov/Members/Biography/S/1003).
Do not bypass the incomplete-roster gate or fabricate an OCD identifier. Continue independent runtime/history work
while the approved Open States source is missing the member. A confirmed vacancy also needs an explicit reviewed
coverage policy; the validator does not silently interpret an absent district as vacant.

Run locally from `apps/legislation`:

```sh
pnpm eval:openstates-pilot
pnpm replay:openstates-pilot artifacts/openstates-pilot/<run>
pnpm eval:openstates-history
pnpm archive:openstates-pilot artifacts/openstates-pilot/<run> artifacts/openstates-archive-canary
pnpm archive:openstates-pilot artifacts/openstates-history/<run> azure history
```

Output is under ignored `artifacts/openstates-pilot/<run>/`. `report.json` reports validation and unresolved identities;
`failure.json` records interrupted downloads. The command has a ten-minute source deadline and 30-second request
timeouts. It calls the pinned Open States people repository, not the hosted Open States API. It cannot promote data.
The snapshot is current-state only; this first adapter does not yet import historical terms or retired people.
The separate history command inventories retired YAML into ignored `artifacts/openstates-history/<run>/report.json`,
including every source role and missing-date counts. It is not a history import and does not close the historical
coverage requirement. Historical party alignment and completeness still require review; overlap cannot be established
where source dates are missing. Date checks do not independently prove the source's assertions match real events.

The archive command also accepts `azure` as its destination and uses the existing `AZURE_STORAGE_ACCOUNT`, default
Azure credential chain, and `state-sources` container. It does not provision a container or change permissions.
The source run must have a complete tree/report and valid checksums; a rejected roster may be archived for diagnosis.
Objects use `openstates/people/<revision>/nc/entities/<run>/files/` and an immutable `complete.json` marker. Retry the
same run safely: identical objects are reused, conflicting bytes fail, and incomplete uploads have no new completion
marker. Read-back verifies the marker, file sizes, hashes, revision and tree coverage before running validation again.
Cloud archive success does not authorize canonical promotion or close roster completeness.
The optional `history` lane archives only retired-person files under `nc/history/<run>/`; replay selects the historical
inventory validator rather than the current-roster validator. Both lanes enforce complete source-tree coverage and
reject files from the other lane. Historical files and metadata are now durably retained, but importing their roles
and verifying historical coverage remain separate requirements.

See [the rollout milestones](../engineering/self-hosted-openstates-milestones.md) for the full activation gates. Election results,
candidates, and inferred committee outcomes are not added to scope by this checklist.

### Full people-import database verification (2026-09-14)

- [x] All 21 entity PostgreSQL integration tests passed against the isolated local `legislation_test` database.
- [x] The full North Carolina importer persisted 170 synthetic current people and one retired person with 171 terms.
- [x] Unknown start dates stayed null; the ended term stayed inactive; repeat import retained the same term IDs.
- [x] Removing a current seat rejected the subsequent import and left stored terms and the checkpoint unchanged.
- [ ] Production promotion remains blocked by the pinned source snapshot's missing upper-chamber district 1 member.

These are synthetic transaction tests, not evidence of historical source completeness. No production import was run.

### Historical committee identity audit (2026-09-14, 18:30 UTC)

No local onboarding command or database index build was active. The bounded Trigger query returned no executing or
queued runs. Existing services were left untouched. Checksummed committee samples were compared with all 503 retained
NC legislative people, using exact primary IDs only:

| Snapshot | Committee role entries | Missing member IDs | Non-null IDs absent from primary people IDs |
| --- | --- | --- | --- |
| 2021 | 1,027 | 12 | 22 entries across four people |
| 2023 | 1,522 | 142 | 4 entries for one person |
| 2024 | 1,507 | 0 | 5 entries for one person |
| 2025 | 1,515 | 0 | 0 |
| 2026 | 1,678 | 0 | 0 |

The retained Bobby Hanig and Sarah Crawford files explicitly declare two of the older IDs in `other_identifiers`.
The people importer now preserves that source field alongside `identifiers`, deduplicated by scheme and value.
This is source-declared identity evidence, not name matching. It does not yet resolve or promote historical committee
memberships; ambiguous identifiers must fail reconciliation. Three other distinct absent primary IDs remain to research.

- [x] Audit sampled historical committee references against retained people IDs.
- [x] Implement retention of source-declared former identifiers.
- [ ] Resolve remaining historical IDs and validate uniqueness before committee promotion.

Verification: four focused importer tests passed; full `pnpm verify` passed (2,668 legislation tests passed,
76 database-dependent tests skipped, four receiver tests passed). No production import or deployment occurred.

### Former legislators in other office folders (2026-09-14)

All three remaining non-null sampled committee IDs are explained by the pinned source: Jeff Jackson's primary ID is
in `executive`, Rachel Hunt's primary ID is there too, and Hunt's `other_identifiers` explicitly supplies her former ID.
No name-only mapping or manually invented identity was used. The history collector, validator and archive completeness
gate now include `retired`, `executive`, and `municipalities`; only NC upper/lower legislative roles become terms.

The complete replacement history inventory is
`artifacts/openstates-history/1789411587916-8396c068-c0e1-4b61-9ecf-dc93be49f6e5`: 383 files, including 358 retired,
four executive and 21 municipal files. Combined with current legislators, 552 files contain 506 people with 581
legislative roles, 122 unknown starts and 169 open ends, with no date issues or conflicting source-declared person IDs.
The 21 municipal files add no NC legislative roles at this revision. These counts supersede the earlier 503/577 totals.

The older 358-file history archive and intermediate 362-file archive remain evidence, but do not satisfy the expanded
source-tree coverage gate and must not be used for promotion. Neither archive was overwritten or deleted.

- [x] Include former legislative service retained in other office folders.
- [x] Explain the three remaining non-null IDs using exact source IDs and declared former identifiers.
- [ ] Resolve committee entries with absent source IDs; historical completeness remains unproven.
- [ ] Promote current NC data only after the missing current Senate seat is resolved.

Twenty-two focused tests passed. Full `pnpm verify` passed: 2,669 legislation tests passed, 76 database-dependent
tests skipped, and four receiver tests passed. All 383 history files were archived in the existing Azure `state-sources`
container and remotely read back with verified checksums. The replacement manifest is
`openstates/people/677c6d0a566ad9bd62b6324e502af76acc3d22f3/nc/history/1789411587916-8396c068-c0e1-4b61-9ecf-dc93be49f6e5/complete.json`.
No canonical database writes or deployment occurred.

### Six-item automated NC closeout

The approved closeout covers the NC pilot, not nationwide activation. Keep each gate open until operational evidence
exists; a passing unit test is not a production import or seven days of observation.

| Gate | Required machine-checkable outcome | Status |
| --- | --- | --- |
| Source coverage | Complete current district roster; every historical discrepancy explicitly classified | Blocked on current source omission; historical identity reconciliation implemented |
| Historical committees | Repeatable exact-ID reconciliation; missing/ambiguous IDs reported; dated observations preserved | Implementation in progress |
| Production import | Canonical records and checkpoint commit together; replay stable; ended tenures protected | Local transaction tests passed; production not run |
| Extraction runtime | Pinned extraction-only build; bounded requests/runtime; immutable output and validation | Not deployed; user confirmed GPL review resolved |
| Recurring sync and reads | Lease/retry/failure drills and authenticated API/MCP acceptance on imported records | Pending runtime and import |
| Seven-day observation | Actual scheduled-run history satisfies the documented canary acceptance gate | Not started |

The user confirmed on September 14, 2026 that the planned deployment's GPL review is resolved. This clears the review
dependency, not the implementation obligations: retain notices/license, pinned corresponding source and modifications,
and apply the reviewed distribution policy to the scraper artifact. Runtime build and activation tests remain pending.

Historical identity reconciliation is now executable, not a manual correction list:

```powershell
node --env-file=.env --import tsx scripts/reconcile-openstates-committees.ts <committee-directory> <current-manifest> <history-manifest>
```

The command verifies committee source-tree coverage and hashes, remotely verifies both people archives, and resolves
only primary or explicitly declared former Open States IDs. It reports `missing_person_id`, `unknown_person_id`,
`ambiguous_person_id`, or `no_legislative_service`; unresolved output returns exit code 1. It never writes canonical data
or infers departures. It requires a successful retained committee report, not an incomplete failed download.

Real reconciliation canary: the retained May 6, 2021 snapshot, replayed against both checksum-verified Azure people
archives, resolved 1,015 of 1,027 role entries automatically. The remaining 12 have no source person ID and produce
`needs_review` with exit code 1. No database writes occurred. This replaces manual investigation for repeatable ID
matching, but does not yet implement membership promotion or establish complete historical coverage.

Reconciliation verification completed: three focused tests passed; full `pnpm verify` passed on retry with 2,672
legislation tests passed, 76 database-dependent tests skipped, and four receiver tests passed. The preceding coverage
run failed because its temporary coverage directory disappeared; no test failure was reported by that run.

### Extraction process boundary

`python/openstates_runner.py` adds the NC-only extraction launcher. It forces `--scrape`, an explicit bill session,
the pinned scraper revision, and a maximum 1,500-second runtime. Event extraction accepts no historical session claim.
The child receives an environment allowlist rather than database/cloud/Trigger credentials, runs in a private work
directory and Linux process group, and is killed with its descendants on timeout. Raw stdout/stderr are not forwarded
to task logs. An attempt result is retained; callers must archive and validate output before promotion or cleanup.

This is not yet a packaged upstream runtime: the pinned dependency build, build provenance verification, publisher
request hardening, artifact integration and Trigger wiring remain pending. `UPSTREAM_REVISION` is a build stamp checked
by the launcher, not independent proof of all packaged source bytes. Test with `pnpm test:openstates-runner`; real
subprocess tests require Linux and use a local fixture module, not the NC publisher or production data.

Linux runner evidence: all five tests passed with networking disabled in
`python@sha256:78387bc3881b8273120a12ebe6c1ab22b018ccc2c9adf565ae1ac9b536e184ea`.
The tests exercised real child-process success, nonzero exit, and a one-second deadline, plus input validation and
credential exclusion. The disposable test container was removed; the downloaded base image remains locally cached.

### Pinned build inputs and output integrity

The [build preparer](openstates-runtime-build.md) retained 494 checksummed files locally in
`artifacts/openstates-runtime/locked-build-inputs`, including the complete pinned upstream archive, license,
source, dependency lock, and hash-locked requirements export. No upstream source was added to the TypeScript package.
An earlier preparation directory is incomplete and lacks `build-inputs.json`; it must not be deployed.

The runner now retains startup failures, rejects exit-zero attempts with missing or unsafe output, inventories output
hashes and byte counts, and keeps semantic acceptance explicitly false. This is not production import completion.

Build verification encountered external download failures: the configured npm registry returned HTTP 401, a public
npm metadata attempt failed its TLS handshake, and the isolated Linux pip dependency dry run exhausted retries with
a TLS handshake failure to `files.pythonhosted.org`. TLS verification was not disabled. Python dependencies and
the Trigger Python extension were not installed; image startup and deployment remain unverified.

Verification for this unit: all 12 Python build-input/runner tests passed in the network-disabled Linux container.
Full `pnpm verify` passed with all nine coverage task groups successful. This verifies local implementation, not a
live scraper build, production import, or the seven-day scheduled observation gate.

### Offline build replay verification

Package downloads were retried: Linux pip still failed TLS negotiation with `files.pythonhosted.org`, and a direct
Windows HTTPS request to public npm also failed SSL negotiation. No TLS checks or version pins were relaxed.

Added offline verification that reconstructs expected source and requirement files from the digest-pinned archive.
Missing, extra, linked, modified, and falsely re-checksummed files are rejected. Generated files now use identical
UTF-8/LF bytes on Windows and Linux. The portable build inputs are retained at
`artifacts/openstates-runtime/verified-build-inputs`. Cross-platform replay caught and fixed an additional difference:
path ordering now uses explicit POSIX-relative strings rather than platform-specific path comparison. Earlier
`portable-build-inputs` and `locked-build-inputs` directories predate the final portable manifest contract.
The real 494-file bundle prepared on Windows passed offline reconstruction and verification in Linux. All 15 Linux
tests passed; Windows passed 11 applicable tests with four Linux-only tests skipped. This does not clear the runtime
installation or deployment gates.

Full `pnpm verify` passed on retry with all nine coverage task groups successful. The first attempt failed when
Vitest's temporary coverage directory disappeared; no overlapping test process was found before retrying. The cause
of that intermittent coverage-directory loss remains undiagnosed and is not a scraper-runtime failure.

### Approved feed authentication and archive handoff

The user confirmed that the machine intentionally blocks public npm and approved refreshing the configured private
feed sign-in. The installed Microsoft `ado-npm-auth` tool refreshed Azure Artifacts authentication successfully.
The approved feed then returned and installed `@trigger.dev/python@4.5.10`. No registry change, public-feed bypass,
TLS weakening, or token disclosure was used. The user will provide the approved Python feed details; Python package
installation remains pending that information.

Trigger configuration now packages the standard-library adapter through the official Python extension. It does not
yet install upstream scraper dependencies, package the upstream source, or activate scraper tasks/schedules.

Added the TypeScript scraper-attempt archive/replay handoff and CLI. It validates lane/session ownership and runner
status, rejects unsafe/duplicate paths and checksum mismatches, verifies create-only uploads, and retains failure
status without advancing canonical checkpoints. Six focused archive tests passed. A live Azure failure-fixture
retention and replay succeeded twice at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/fixture-retention-20260914/retained.json`.
This fixture has zero raw files and is explicitly failed; it proves archive plumbing and identical retry behavior,
not a successful source scrape or production import.

A fresh GitHub check found the last NC legislature-source change still dated August 31, 2026. The current-roster
source omission therefore remains open; no identity was invented or coverage gate bypassed.

Verification: eight focused archive/configuration tests passed; full `pnpm verify` passed with 2,679 legislation tests
passed, 76 database-dependent tests skipped, and four receiver tests passed. No production deployment, canonical
import, or schedule activation occurred. Pending external input: approved Python package feed and authentication.

### Approved Python feed discovery and NC request hardening

The machine-wide `C:/ProgramData/pip/pip.ini` already configures the approved Microsoft Python feed at
`https://packagefeedproxy.microsoft.io/pypi/simple/`. Docker did not inherit that configuration. Explicitly passing
the existing feed allowed the locked package downloads, including the source-only `sgmllib3k==1.0.0` package.
The earlier pending-feed note is superseded: no additional feed information is required for this tested environment.
TLS verification and runtime dependency hashes remained enabled. A dedicated local Docker pip cache was retained.

The dependency dry run now exposes an upstream compatibility failure rather than a network failure:
`textract==1.6.5` declares `extract-msg (<=0.29.*)`, which pip 25.0.1 rejects as invalid metadata. Installation did not
complete. No older installer, unchecked install, or silently modified third-party distribution was substituted.
Source-only package build dependencies also need a pinned build toolchain before claiming reproducible installation.

Build preparation now applies exact-match reviewed changes to NC events and shared HTML helpers: verified TLS,
10-second connection and 60-second read timeouts, HTTP error rejection, and no insecure certificate-error retry.
NC bill-link requests use the scraper session rather than a separate unbounded request. Original upstream source
remains retained in the digest-pinned archive, and offline verification reconstructs the hardened source.
The current bundle is `artifacts/openstates-runtime/hardened-build-inputs`; the older `verified-build-inputs` bundle
predates the request policy and is not the current deployment candidate. All 494 hardened files verified in Linux.

The runtime installation, live source canary, production import, recurring activation, and seven-day observation gates
remain open. These changes do not resolve the current NC roster omission or authorize incomplete-roster promotion.

Verification: all 18 Python tests passed in network-disabled Linux; Windows passed 14 applicable tests with four
Linux-only skips. Full `pnpm verify` passed: all nine coverage task groups successful, 2,679 legislation tests passed,
76 database-dependent tests skipped, and four receiver tests passed. No production deployment or canonical writes.

### Installed runtime and live event extraction

The `textract` dependency blocker is resolved by a deterministic, checksum-gated metadata repair matching the retained
Poetry lock (`extract-msg <=0.29`). Original distribution bytes are retained. Executable code, package versions, and
licenses are unchanged; the derived wheel has its own build tag, RECORD, checksum, and replay-verifiable manifest.
The entire locked dependency graph installed successfully and `pip check` passed. Source-only builds use the pinned
setuptools bootstrap with build isolation disabled, not unpinned build dependencies.

Actual startup testing found Python 3.12 incompatible with upstream `six==1.12.0`. The Python 3.11 acceptance image
uses base digest `9534e5a8e315485d4061ed659af0fd78a284c015f9b73661b41d6bab25604534` and successfully loaded the real
Open States 6.25.5 CLI plus both NC lanes. Its parser verified explicit scrape-only actions. The clean Dockerfile build
also succeeded, and its startup test passed with networking disabled. All 22 then-current Python tests passed in that
image. This is local runtime acceptance, not a Trigger deployment.

Two real NC event scrapes completed with three meetings each. The first exposed upstream's colon-containing metadata
filename, which the Windows-portable archive contract rejected. The runner now renames that exact known file before
inventory without changing its JSON bytes, rejecting collisions and unsafe names. The second scrape's seven files
were retained and read back from Azure at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/events/nc-events-live-20260914/retained.json`.
No canonical writes occurred. The raw event IDs are per-scrape UUIDs, and committee references can be unresolved name
expressions; these must not be treated as durable upstream entity identifiers during canonical promotion.

The existing 15-minute onboarding follow-up remains active. Current-roster completeness, historical committee
promotion, stable scraper normalization, Trigger deployment/activation, authenticated acceptance, and the seven-day
observation period remain open. The successful events extraction does not close those requirements.

The bill-lane canary uncovered a second source-routing issue: requesting `2025E1` returned a feed containing 1,092
Senate bills, including `S1092` filed July 27, 2026. The executable pilot now accepts only regular session `2025`;
unverified special/historical session routing is rejected before starting a child. The earlier special-session attempt
failed, retained four metadata files in Azure at `nc/bills/nc-bills-live-20260914/retained.json` under the same scraper
revision prefix, and performed no canonical writes. Direct diagnostics observed read timeouts; a separate bounded
request subsequently returned HTTP 200 and the mismatched feed. Successful transport did not establish session validity.

A regular `2025` canary extracted 51 bills and 23 votes plus four metadata files before its deliberate 90-second
deadline. One inspected example, SB 1092, retained 20 actions, one sponsorship, and six versions with the official
`https://www.ncleg.gov/BillLookUp/2025/S1092` source. All 78 files were archived and read back at
`nc/bills/nc-bills-regular-canary-20260914/retained.json` under the same revision prefix. The attempt remains timed out,
not complete, and was not promoted. No scraper container remained active afterward; the local test database stayed
healthy. This confirms extraction and timeout retention, not whole-session completeness. Recurring bill work requires
bounded batches rather than treating an entire large session as one short scheduled task.

### Bounded bill extraction verified

The executable pilot now rejects whole-session bill attempts. Each request specifies 1–10 unique bill IDs from one
chamber, and only regular session `2025` is accepted. The reviewed source patch requires every selected ID to appear
exactly once in the feed before yielding selected bills, then uses numeric ordering. A new filing cannot shift an
offset-based boundary because no feed offsets are used. Request IDs remain in retained attempt metadata. Timeouts
still fail safely; successful batches are not whole-session completion or canonical promotion.

The rebuilt local image passed dependency verification, `pip check`, network-disabled startup, and 27 Python tests.
Its image config digest is `f2444588e2eb3e50dd9bda285f421c4b7643138326ec2888e1b93786cc0cfe79`.
The current source manifest SHA-256 is `d332b3722b6718ff379f8b65c15ae2c78b5654081bafd326593f6776ae468b6b`.
The dependency manifest SHA-256 is `6bcf77e389439a651c714b122f1ac30bbb2fad4eded24f54aabd0db992342119`.
These bundles reside in `artifacts/openstates-runtime/batched-build-inputs` and `batched-dependency-inputs`.

A live batch requesting `S1091` and `S1092` completed with exit zero inside its 180-second deadline. Its two bill
records are SJR 1091 (22 actions) and SB 1092 (20 actions), both session 2025, with the corresponding official NCGA
BillLookUp source URLs. All 10 output files were archived and verified by read-back at
`openstates/scrapers/d43f853796ceeeb49205f7d144790647764ce105/nc/bills/nc-bills-batch-canary-20260914/retained.json`.
Local evidence: `artifacts/openstates-runtime/live-canary/openstates-nc-e42pidjp`.

The archive suite passed 13 tests. Final root `pnpm verify` passed: legislation 2,686 tests passed, 76
database-dependent tests skipped, and four receiver tests passed. The initial lint failure for a missing expected
error message in a new test was corrected before this successful verification. No production deployment or canonical
writes occurred. Remaining work includes durable whole-session discovery/scheduling, stable raw-record normalization,
historical committee promotion, deployed Trigger safeguards, authenticated reads, source roster completeness, and
the seven-day observation period. The existing 15-minute continuation schedule remains active; none was duplicated.
