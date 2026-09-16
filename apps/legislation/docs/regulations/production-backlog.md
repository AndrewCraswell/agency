# Regulatory ingestion and production backlog

Updated September 15, 2026. This is the execution backlog for **remaining** regulatory work. It supersedes the older
[implementation backlog](implementation-backlog.md) for work selection, not the underlying data/API requirements.
[Implementation progress](implementation-progress.md) remains the record of executed checks and actual coverage.
Unchecked tasks below are outstanding deliverables, even where an existing implementation supplies part of the work.

## Scope and boundaries

Deliver direct federal ingestion, versioned storage, lexical and semantic retrieval, regular updates, authenticated
HTTP APIs and API-backed MCP. Initial baseline is current eCFR plus 90 recent Federal Register days at a frozen cutoff.
Historical waves cover FR/CFR 2020 onward, then FR 2000–2019 and annual CFR 1996–2019, only where source inventories
support those ranges. U.S. Code is a separate statutory-context lane and does not block useful regulatory coverage.
Regulations.gov dockets/comments, RegInfo/OIRA planning, agency guidance/enforcement, pre-2000 FR formats, and licensed
state delivery are explicit extension lanes, not hidden prerequisites or implied completed coverage.

Backfills precede activation of recurring regulatory source collection. Implement and test sync code earlier using
retained or bounded development inputs; keep source schedules disabled until the selected backfill gates pass. Freeze
the exact release/backfill scope in ING-01: an excluded partition stays visible and cannot count as ingested. Do not
silently shrink that scope to enable recurrence. A verified partition can progress without an unrelated blocked one.

The user's deferred rebuild of **existing embeddings** remains in force. Do not delete existing vectors, change their
freshness contracts to cause a rebuild, or dispatch that rebuild. New regulatory evaluation requests are authorized;
bulk regulatory embeddings require EVAL-12 and the bounded HTTP/MCP model canary. No vendor purchase is implied.

## Already implemented: extend these foundations

| Foundation | Verified boundary; work not to repeat |
| --- | --- |
| Current eCFR import | 49 nonreserved titles, 275,149 members in the retained local pilot. Not a production deployment or searchable national corpus. Reuse retained artifacts and verify their hashes. |
| Canonical editions and publications | Baseline migration 0048, version/membership/rights storage, atomic writers, annual all-volume publication, modern and alternate-rendition FR pilots. Full inventories and unresolved source exceptions remain. |
| Reader and passage preparation | Lossless block projection, real pinned tokenizers, bounded prose/table splitting, durable preparation checkpoints and per-version hashes. Remaining table shapes and full-corpus qualification need PASS tasks. |
| Search copy | Separate legal search tables, FTS, exact copy/replay checks, copy batches, scope receipts, acknowledgement and rights cleanup. Full-corpus search, resumable large-scope acknowledgement and production load acceptance remain. |
| Trigger workers | Explicit preparation, copy and rights-maintenance workers with bounded pools/queues and continuation. Not a deployed acquisition-to-serving graph or a cancellation-recovery controller. |
| Embedding transport | Shared OpenRouter exact-input bug fixed; pinned OpenAI/Voyage tokenizers and diagnostic reuse cache. No regulatory production vector pipeline or final model decision. |
| Model evidence | Provisional 60-query/350-excerpt comparison and blind review packets exist. Final passage evaluation, reviewed labels, broader cohorts and deployed route verification remain. |
| API foundation | Strict legal-search schemas, organization-gated internal search and exact-version text HTTP/client/MCP delivery. Coverage/discovery, public legal search and deployed canaries remain open. See [reader delivery](legal-text-serving.md). |

These are local evidence statements, not fresh production audits. OPS-01 inventories actual deployed state.

## Execution map

| Workstream | Detailed backlog | Initial dependencies | Prior-art references |
| --- | --- | --- | --- |
| Source repair and frozen backfills | [ING tasks](ingestion-production-tasks.md#source-inventory-and-reconciliation) | Existing collectors/writers | SRC, COL, DATA, HIST, LIVE-01–04 |
| Durable controller and workers | [ORCH tasks](ingestion-production-tasks.md#orchestration-and-recovery) | ING-01; OPS-01–03 for live dispatch | FLOW; existing three workers |
| Full-corpus passage preparation | [PASS tasks](search-production-tasks.md#passages-and-source-text) | Validated source partitions | SEARCH-01; reader/storage evidence |
| Search storage and retrieval | [INDEX tasks](search-production-tasks.md#indexing-and-query-execution) | PASS; ORCH for deployment | SEARCH-02–05, 10–11, 13–14 |
| Model evaluation and bulk vectors | [EVAL and VECTOR tasks](search-production-tasks.md#model-evaluation) | PASS samples; HTTP/TOOLS canary | SEARCH-06–09, 12, 15–17 |
| HTTP and MCP | [HTTP and TOOLS tasks](api-mcp-production-tasks.md) | Shared contracts; INDEX query service | API-01–14; MCP-01–07; APP |
| Recurring updates | [SYNC tasks](operations-production-tasks.md#regular-syncs-and-corrections) | Code can start now; activation after G4 | LIVE-05–11; HIST-06 |
| Deployment, scale and operation | [OPS tasks](operations-production-tasks.md#deployment-scale-and-operations) | Starts now; gates below govern activation | REL; FLOW-14; SRC-08/10 |
| Licensed state and later federal feeds | [EXT tasks](operations-production-tasks.md#explicit-extension-lanes) | Contract/source evidence | STATE; deferred sourcing scope |

Dependencies named on an individual task add to its workstream prerequisites. Tasks without a local prerequisite can
start independently once their workstream prerequisites are met. API schemas and synthetic fixtures can precede real
data. Do not make a full public endpoint inventory or extended history a prerequisite for a bounded model canary.

## Milestones and gates

| Gate | Required evidence | What becomes possible |
| --- | --- | --- |
| G1: deployed bounded ingestion | ING-01–02 and validated pilot source units; ORCH-01–13; OPS-01–05. Actual parser/tokenizer startup, provider cooldown, leases, duplicate parents and killed-run recovery in development. | Dispatch bounded production backfill partitions under measured limits; unresolved source units remain quarantined. |
| G2: searchable lexical pilot | PASS-01–08; INDEX-01–08/11; HTTP-01–06/08–11/14; TOOLS-01–04/11. Exact inventory/copy acknowledgement and authenticated source-cited lexical queries. | Enable lexical serving only for the verified pilot scope; semantic tasks are not prerequisites. |
| G3: regulatory embedding selection | EVAL-01–12; VECTOR-01–07; bounded HTTP-17/TOOLS-05 semantic smoke with persisted pilot vectors. Frozen reviewed quality/cost report. | Run the selected regulatory embedding manifest, not existing embedding regeneration. |
| G4: selected backfills complete | ING-06–16 as applicable to ING-01; ORCH-14–16; PASS-09–10; INDEX-12–14; VECTOR-08–12 for semantic claims; OPS-06–10. Per-partition inventories and declared exclusions reconcile at every stage. | Declare only the completed corpus/date/capability scope available; activate approved recurring collection via SYNC-11. |
| G5: production operation | SYNC-01–12; remaining HTTP/TOOLS release tasks; OPS-11–16. Seven-day observations, recovery, rollback, load, backup and deployed API/MCP parity. | Maintain the advertised federal scope with measured freshness and operational ownership. |

G1 does not require full historical repair; unresolved units are quarantined. G2 is lexical-only. G3 uses a small pilot
generation and therefore does not depend on G4's bulk embeddings. G4 can report lexical and semantic completion
separately. U.S. Code and extensions have their own capability rows and cannot inflate federal regulation coverage.

## Recommended first execution slices

1. ING-01–02 and OPS-01–03: freeze scope, existing-data reconciliation and deployed capacity without repeating imports.
2. ORCH-01–08: durable stage controller, remaining worker adapters and lost-run recovery; wire existing preparation/copy workers.
3. ING-03–08 alongside PASS-01–07: resolve known source exceptions and classify every passage failure.
4. INDEX-01–08/11 plus HTTP-01–06/09–11/14 and TOOLS-01–04/11: large-scope validation and an authenticated lexical pilot.
5. EVAL-01–12 and VECTOR-01–07: reviewed final-passage comparison and durable bounded vector canary.
6. ORCH-09–16 and OPS-04–10: deployed failure tests and staged scale; run the backfill and vector waves as their gates pass.
7. Complete remaining HTTP/TOOLS functionality; then SYNC/OPS operation gates. Develop sync code earlier but do not activate it early.

This ordering identifies independently executable work; it does not permit bypassing the task dependencies below.

## Closing a task

Each checkbox represents an inspectable implementation or execution result. Close it only with the named acceptance
evidence. Record owning files, commit or workspace revision, environment, exact manifests/IDs/contracts, commands or
Trigger run IDs, expected/actual counts and hashes, failures/exclusions, timings and artifact location. Assign an
implementer when starting; no team member or completion date is invented by this backlog. Use `not_started`, `running`,
`blocked`, `partial`, or `passed` in the progress ledger; a checkbox is checked only for `passed`.

Retain evidence under the configured regulatory artifact store and link a short report from implementation progress.
New script/file names in task text are proposed deliverables unless identified as existing. Reuse existing services,
smoke utilities, task infrastructure, API authentication and model clients. Modify the unreleased schema baseline
rather than introducing compatibility migrations for prototype state. Preserve unrelated legislative/Open States work.

Run focused executable tests and root `pnpm verify` after each coherent implementation slice. Do not create tests that
validate backlog prose. Local mocks do not establish deployed success; fixture smoke and live smoke are reported
separately. Scale/latency/freshness numbers in the specifications are targets until measured. Pending, delayed,
quarantined and failed units must remain visible; an empty runnable queue is not completion.
