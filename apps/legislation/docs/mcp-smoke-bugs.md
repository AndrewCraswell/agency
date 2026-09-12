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
| Event and calendar discovery return empty | Partial: events pass; calendar ingestion missing | Hearing discovery is nonempty; durable publisher-calendar source remains to be selected and ingested |

Do not fabricate dates, sources, active status or relationships to bypass validation. Fix ingestion for future records as well as the affected stored records. Preserve the completed vector indexes and the isolated passage-search rollout gate.

## Implementation and verification

The first release fixes the bill-search fallback scan, timestamp decoding, action-source persistence, shared vote projection and bounded embedded vote positions, and source-backed hearing completeness. Unknown remote status is null; date-only hearings do not claim an exact start time.

Fresh Congress.gov source replay restored the affected bill's action and relationship provenance and the hearing's source facts. Local fixed-code reads against production succeeded for bill detail (3.5 seconds), bill votes (1.3 seconds), and hearing persistence (1.1 seconds). The corrected bill-search database plan completed in approximately one second; this is not yet deployed MCP latency evidence.

Verification: 2,678 legislation tests passed, 73 skipped, plus four webhook receiver tests. The Next production build passed. Root `pnpm verify` is not green because of unrelated scoring-package coverage failure; legislation coverage passed independently.

Passage search remains gated on complete search-copy validation. Calendar discovery has no source calendar importer yet; empty discovery is not evidence of a broken request, but the data-coverage gap remains open.

## Deployed acceptance

Commit `eeeaf13` is pushed to main. Railway deployment `0e6c5217-b1d1-4354-9798-bfe35151d98c` reached SUCCESS. Trigger version `20260912.3` deployed with 28 tasks, including the corrected ingestion code.

The repeated smoke exercised all 26 tools in 43 requests. It initially found two errors: lexical passage timeout and incomplete incoming related-bill provenance. Refreshing the three incoming source bills resolved the latter, confirmed by an additional authenticated request. There is now one failing exercised tool mode, plus calendar discovery returning a valid empty page. Semantic and hybrid passage searches passed, as did all other exercised search modes and six continuation-page requests.

Remaining closure: complete and validate the passage copy before cutover; select and ingest a real publisher-owned calendar. The copy checkpoint is still unfinished (Arizona document IDs as of September 12, 17:37 UTC). Do not report all defects closed or all source records repaired: these results validate the smoke fixtures and corrected future ingestion, not a corpus-wide replay.

GovInfo's [Congressional Calendars](https://www.govinfo.gov/help/ccal) are legislative business calendars, not interchangeable with dated committee meeting schedules. Choosing between these is a product/data-source decision, not permission to manufacture calendar rows from the restored hearing.
