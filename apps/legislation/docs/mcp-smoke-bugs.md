# Authenticated MCP smoke defects

Source: September 12, 2026 authenticated production smoke, all 26 advertised tools, 42 evaluated requests. Sixteen tools passed exercised cases; eight had failures; two discovery tools returned empty lists. HTTP 200 with a tool or batch-item error is a failure.

| Defect | Status | Acceptance |
| --- | --- | --- |
| Broad bill lexical and hybrid search fail around 15 seconds (`education`) | Investigating | Both modes return real canonical hits within the request deadline; preserve query semantics |
| Lexical passage search fails around 15 seconds (`tax`) | Investigating | Real full-corpus hits within deadline; do not enable an incomplete search copy |
| Bill detail and batch detail reject missing action provenance | Investigating | Correct importer persistence and real `bill:us:119:hr:8884` detail and batch read |
| Bill timeline marked complete despite missing ordering facts | Investigating | Deterministic, honest chronology and successful paginated timeline |
| Related bills reject incomplete relationship provenance | Investigating | Persist actual source facts and return real relationships |
| Bill votes reject incomplete canonical facts | Investigating | Real bill-vote collection, not just standalone vote detail |
| Supporting-material hearing link resolves to not found | Investigating | `event:congress:published-hearing-27208` resolves or invalid linkage is corrected at ingestion |
| Event and calendar discovery return empty | Investigating | Nonempty source-backed discovery fixtures; distinguish hearings from scheduled meetings |

Do not fabricate dates, sources, active status or relationships to bypass validation. Fix ingestion for future records as well as the affected stored records. Preserve the completed vector indexes and the isolated passage-search rollout gate.

## Implementation and verification

The first release fixes the bill-search fallback scan, timestamp decoding, action-source persistence, shared vote projection and bounded embedded vote positions, and source-backed hearing completeness. Unknown remote status is null; date-only hearings do not claim an exact start time.

Fresh Congress.gov source replay restored the affected bill's action and relationship provenance and the hearing's source facts. Local fixed-code reads against production succeeded for bill detail (3.5 seconds), bill votes (1.3 seconds), and hearing persistence (1.1 seconds). The corrected bill-search database plan completed in approximately one second; this is not yet deployed MCP latency evidence.

Verification: 2,678 legislation tests passed, 73 skipped, plus four webhook receiver tests. The Next production build passed. Root `pnpm verify` is not green because of unrelated scoring-package coverage failure; legislation coverage passed independently.

Passage search remains gated on complete search-copy validation. Calendar discovery has no source calendar importer yet; empty discovery is not evidence of a broken request, but the data-coverage gap remains open.

Final closure requires deployed authenticated replay of every failed case and another full 26-tool smoke. No defect is closed yet.
