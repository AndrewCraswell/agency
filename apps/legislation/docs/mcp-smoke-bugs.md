# Authenticated MCP smoke defects

Source: September 12, 2026 authenticated production smoke, all 26 advertised tools, 42 evaluated requests. Sixteen tools passed exercised cases; eight had failures; two discovery tools returned empty lists. HTTP 200 with a tool or batch-item error is a failure.

| Defect | Status | Acceptance |
| --- | --- | --- |
| Broad bill lexical and hybrid search fail around 15 seconds (`education`) | Fixed, deployed replay passed | Lexical 1.5–3 seconds, hybrid 2.4 seconds; real canonical hits |
| Lexical passage search fails around 15 seconds (`tax`) | Open, full search copy incomplete | Real full-corpus hits within deadline; do not enable an incomplete search copy |
| Bill detail and batch detail reject missing action provenance | Fixed, deployed replay passed | Actual importer source persistence; detail 301 ms, batch 264 ms |
| Bill timeline timestamp is not decoded as a Date | Fixed, deployed replay passed | Correct database decoder; timeline 222 ms |
| Related bills reject incomplete relationship provenance | Fixed for smoke fixture, source replay passed | Refreshed outgoing and incoming relationships from all four source bills; replay 508 ms |
| Bill votes reject incomplete canonical facts | Fixed, deployed replay passed | Shared projection, bounded position pagination; collection 311 ms |
| Supporting-material hearing link resolves to not found | Fixed, deployed replay passed | Source-backed hearing resolves in 220 ms |

Do not fabricate dates, sources, active status or relationships to bypass validation. Fix ingestion for future records as well as the affected stored records. Preserve the completed vector indexes and the isolated passage-search rollout gate.

## Implementation and verification

The first release fixes the bill-search fallback scan, timestamp decoding, action-source persistence, shared vote projection and bounded embedded vote positions, and source-backed hearing completeness. Unknown remote status is null; date-only hearings do not claim an exact start time.

Fresh Congress.gov source replay restored the affected bill's action and relationship provenance and the hearing's source facts. Local fixed-code reads against production succeeded for bill detail (3.5 seconds), bill votes (1.3 seconds), and hearing persistence (1.1 seconds). The corrected bill-search database plan completed in approximately one second; this is not yet deployed MCP latency evidence.

Verification: 2,678 legislation tests passed, 73 skipped, plus four webhook receiver tests. The Next production build passed. Root `pnpm verify` is not green because of unrelated scoring-package coverage failure; legislation coverage passed independently.

Passage search remains gated on complete search-copy validation. Calendar discovery is excluded from this bug list: its valid empty response reflects an unimplemented importer, not a runtime defect. The calendar endpoint is unchanged.

## Deployed acceptance

Commit `eeeaf13` is pushed to main. Railway deployment `0e6c5217-b1d1-4354-9798-bfe35151d98c` reached SUCCESS. Trigger version `20260912.3` deployed with 28 tasks, including the corrected ingestion code.

The repeated smoke exercised all 26 tools in 43 requests. It initially found two errors: lexical passage timeout and incomplete incoming related-bill provenance. Refreshing the three incoming source bills resolved the latter, confirmed by an additional authenticated request. There is now one failing exercised tool mode, plus calendar discovery returning a valid empty page. Semantic and hybrid passage searches passed, as did all other exercised search modes and six continuation-page requests.

Remaining bug closure: complete and validate the passage copy before cutover. The copy checkpoint is still unfinished (Arizona document IDs as of September 12, 17:37 UTC). Do not report all defects closed or all source records repaired: these results validate the smoke fixtures and corrected future ingestion, not a corpus-wide replay.

Calendar ingestion remains outside this bug-fix scope, per the user's September 12 clarification.

## Passage copy follow-up

September 12, 18:07 UTC: target contains 647,844 sections; source statistics estimate 16,560,791 sections. Backfill remains incomplete, with 334 queued events including 53 deferred retries. The live replay benchmark overlapped the scheduled publisher and may have caused lock-contention retries; these must clear before acceptance.

On the same 100 existing documents / 4,400 sections, transfer pages of 250 took 54.771 and 52.243 seconds; pages of 1,000 took 34.399 and 35.241 seconds. The default transfer page is now 1,000 (the existing maximum), preserving the 100-document atomic transaction, single-publisher lock and deadlines. This is a replay benchmark, not a measured full-backfill speedup. Twenty-five focused worker/queue/replication tests passed. Root verification still fails unrelated scoring coverage.

At the observed pre-tuning throughput, roughly 45–55 hours remain for copying, excluding integrity, relevance/performance acceptance and cutover. This is provisional: source counts are estimates, later documents vary in size, and failed/deferred work must be reconciled. The lexical API timeout remains open until deployed full-corpus acceptance passes.

## Copy concurrency experiment

September 12: a disposable table in the isolated passage database was populated from the same 160 processed documents / 5,143 sections, split into eight disjoint 20-document batches. The table copied the live table's indexes. Each transaction used the existing replication implementation, 1,000-row transfer pages and unchanged deadlines. Only the scratch-table adapter omitted the production publisher lock. Source access was read-only; production queue ownership, checkpoints and publisher concurrency were unchanged.

| Concurrent writers | First run | Reverse-order repeat | Acceptance |
| --- | --- | --- | --- |
| 1 | 55.638 seconds | 52.925 seconds | Both runs passed row and fingerprint checks |
| 2 | 30.991 seconds | 35.116 seconds | Both runs passed row and fingerprint checks |
| 4 | 29.805 seconds | 27.137 seconds | Both runs passed row and fingerprint checks |
| 8 | 27.992 seconds, incomplete | Not repeated | Two statement cancellations (`57014`); only 3,972 rows committed; rejected |

The first attempt had a benchmark-only asynchronous counter race; that result was discarded and the counter corrected before the measurements above. The eight-writer failure stopped the concurrency ladder rather than increasing deadlines or accepting missing batches. Disposable schemas are removed after each ladder. No live rows were deleted or replaced by this experiment.

Interpretation: gains diminish beyond two writers; four remains a candidate, while eight is not acceptable with the current deadlines. This small, locally driven public-network experiment is not a sustained Trigger throughput or full-corpus ETA measurement. Sampled search-service CPU stayed below 0.1 vCPU and memory below 3.5 GB; these coarse samples do not isolate the bottleneck or exclude source/network contention.

Before production fanout: implement exclusive work ownership and move-safe publication ordering, exercise retries and concurrent source edits/moves, then repeat a bounded two/four-worker comparison from the deployed execution environment. Merely increasing Trigger queue concurrency would duplicate unclaimed work and contend on the global publication lock. Keep that lock and the single production publisher until its correctness contract has a tested replacement. Latest production check during the experiment: 805,072 target sections, 246 queued events, zero deferred retries; enumeration remains incomplete.

The implemented follow-up keeps one publisher instead: two readers partition the batch using a shared exported snapshot, and explicitly serialize their pages into one atomic target transaction. This retains queue ownership, section-move ordering and rollback semantics without a new lease system. Read concurrency defaults to two and can be reduced to one. In the final live scratch-table comparison (100 documents / 3,238 sections), one reader took 24.570 seconds and two took 19.604 seconds, approximately 20% less time. Complete row fingerprints matched and scratch tables were removed. This is distinct from the independent-writer experiment above; it does not claim its 1.6–1.9× gains. Twenty-nine focused tests and eight isolated-source database integration tests passed, including concurrent edits and section moves. Deployment acceptance is still required. Seven pending production retries appeared during the integration run and must clear before readiness.
