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
