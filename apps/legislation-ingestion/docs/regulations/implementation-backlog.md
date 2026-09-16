# Regulatory implementation phase reference

The September 14, 2026 phase checklist is superseded for execution by the
[production backlog](production-backlog.md). This compact map preserves its task-ID references and milestone evidence;
it is not a second set of open checkboxes. Current requirements remain in [implementation](implementation.md),
[data](../../../../packages/legislation-core/docs/regulations/data-contract.md), [acquisition](acquisition-workflows.md), [search](search-indexing.md) and
[API/MCP](../../../legislation-web/docs/regulations/api-mcp-contract.md). Recorded results belong to [implementation progress](implementation-progress.md).

## Original IDs and current owners

| Original phase and IDs | Current work selection | Requirements preserved |
| --- | --- | --- |
| 0: SRC-01 through SRC-12 | [ING source inventory](ingestion-production-tasks.md#source-inventory-and-reconciliation), OPS-01 through OPS-04 | Frozen scope, source/runtime evidence, retained artifacts, rights and measured capacity |
| 1: DATA-01 through DATA-14 | ING, ORCH, INDEX and HTTP contracts in the production map | Canonical identities, editions, memberships, atomic publication, source observations, rights and strict selectors |
| 2: COL-01 through COL-15 | ING-03 through ING-11; ORCH-03 through ORCH-05; EXT-01/02 | Source-specific collectors/parsers, complete rendition inventory, bounded runtime and evidence-based relationships |
| 3: FLOW-01 through FLOW-14 | [ORCH tasks](ingestion-production-tasks.md#orchestration-and-recovery) | Durable admission, fenced stages, provider budgets, lost-run recovery, scale and operator controls |
| 4: LIVE-01 through LIVE-11 | ING-07/08 and [SYNC tasks](operations-production-tasks.md#regular-syncs-and-corrections) | Frozen current baseline, correction discovery, generation precedence and separately approved recurring activation |
| 5: HIST-01 through HIST-10 | ING-12 through ING-16; SYNC-04 through SYNC-10 | Recent/extended manifests, all-volume validation, temporal accuracy, corrections and explicit unsupported history |
| 6: SEARCH-01 through SEARCH-17 | [PASS, INDEX, EVAL and VECTOR tasks](search-production-tasks.md) | Lossless passages, acknowledged isolated copies, rights cleanup, frozen evaluation, bounded vector jobs and independent capability promotion |
| 7: API-01 through API-14 | [HTTP tasks](../../../legislation-web/docs/regulations/api-mcp-production-tasks.md#http-surface); PRODUCT-03 for enterprise sync | Strict wire schemas, selectors, exact text, coverage, authenticated routes/clients and a separately specified synchronization protocol |
| 8: MCP-01 through MCP-07; APP-01 through APP-05 | [TOOLS and PRODUCT tasks](../../../legislation-web/docs/regulations/api-mcp-production-tasks.md#mcp-tools) | API-backed tools, output budgets, audience isolation, hostile-source tests and gated product integration |
| 9: REL-01 through REL-12 | [OPS tasks](operations-production-tasks.md#deployment-scale-and-operations) and production gates G1-G5 | Deployed evidence, load/recovery, independent rollback, observability, costs and explicit release scope |
| 10: STATE-01 through STATE-12 | [EXT tasks](operations-production-tasks.md#explicit-extension-lanes) and [state onboarding](state-onboarding.md) | Actual licensed feed/rights, synthetic extensibility, snapshot/delta recovery, official-source comparison and cohort qualification |

Original broad items could contain implemented foundations and remaining work. Do not infer completion or recreate
an importer from an old unchecked ID. Conversely, an earlier checked foundation does not satisfy its current full-corpus,
deployment or public-serving acceptance. The new task's dependencies and closure evidence control execution.

## Retained milestone evidence

These were checked in the original phase record. They remain bounded historical observations, not today's live counters.

| Original IDs | Recorded result | Limits and evidence owner |
| --- | --- | --- |
| SRC-03 | Read-only planner for eCFR, FR bulk XML and annual CFR | U.S. Code and final release scope remain separate; [progress](implementation-progress.md) records newer ING-01/02 work |
| DATA-01 | Baseline migration 0048 and disposable PostgreSQL edition/membership validation | Local storage foundation; [storage validation](storage-validation.md) |
| COL-02, COL-05 | Paginated Federal Register metadata and 63-publication metadata join pilot | Not full history or rendition completion; [FR metadata validation](fr-metadata-validation.md) |
| COL-04, COL-07, COL-11 | Federal Register/eCFR parsing and Python bridge with retained source-text checks | Deployed runtime and wider source shapes remain gated; [parser validation](parser-validation.md) |
| LIVE-02 | Retained current eCFR pilot: 49 nonreserved titles and 275,149 members | Not nationwide production/search acceptance; current-parser reuse needs ING-02 reconciliation |
| API-13 | Lossless reader projection over 40,872 retained records | Not a registered HTTP/MCP route; [search and reader requirements](search-indexing.md) and progress |

## Rules still in force

- Backfills precede activation of recurring source collection. The declared scope cannot be silently reduced to pass G4.
- Lexical, semantic, historical and licensed-state capabilities are separately gated; a bounded model canary need not wait
  for bulk vectors, and its success does not authorize old-vector regeneration.
- No pending, delayed, quarantined or failed unit becomes successful because a runnable queue is empty.
- Preserve exact source text, canonical identity, version context, rights and current-head precedence through replay.
- Evidence names the environment/revision, frozen source manifests, commands, expected/actual IDs/counts/hashes, limitations
  and artifact location. Fixture, local and deployed results remain distinct.
- Use current package commands and existing test/smoke utilities. Names proposed in the original checklist are not proof
  that a script exists. Do not create validators for this prose or mark a task complete from documentation alone.

The former duplicated procedures and per-task status narratives have been condensed into their current owners above.
Retain actual source/evaluation artifacts and reports; they remain necessary for reproducing the implementation decisions.