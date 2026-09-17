# Remaining regulatory sync and production operations tasks

Owner: [production backlog](production-backlog.md). Requirements: [acquisition workflows](acquisition-workflows.md),
[implementation specification](implementation.md) and [state onboarding](state-onboarding.md).
Production inspection is separate from the existing local evidence. No purchases or activation occur by documenting tasks.

## Regular syncs and corrections

Build and exercise these paths with fixtures and bounded manual development dispatch before G4. Keep recurring source
schedules disabled until SYNC-11. Reuse acquisition, publication, passage, copy and vector stages; do not create a second
normalization or direct-to-index update path. Workstream prerequisites: ORCH-01 and source contracts.

- [x] **SYNC-01 Persist discovery checkpoints.** Store source/query scope, last committed cursor/window, overlap,
  last attempt/success and source cutoff independently of Trigger run history. **Done:** an interrupted discovery page
  resumes without advancing past unregistered work; repeat pages create no duplicate units.
  Implemented locally September 16, 2026. The canonical database owns immutable query scopes, page receipts and
  pending units. Page registration and cursor advance share one serializable transaction; revision/cursor compare-and-
  swap prevents competing discovery attempts from skipping work. PostgreSQL fault and replay evidence is recorded in
  [the implementation ledger](implementation-progress.md). Trigger history is not part of the checkpoint identity.
- [ ] **SYNC-02 Implement eCFR change discovery.** Poll title metadata under the configured hourly discovery policy,
  accounting for reserved titles, import-in-progress and per-title dates; schedule changed raw observations. **Done:**
  unchanged titles produce no unnecessary parse/vector work and incomplete publisher updates retain prior serving data.
  Depends on SYNC-01, ING-07.
  Local progress: the bounded `regulatory-ecfr-discovery` task validates all publisher title metadata, refuses an
  import-in-progress response, classifies reserved/unchanged/changed titles against explicit current heads and registers
  changed acquisition units. Its concurrency is one and no recurring schedule is registered. Pending-unit acquisition,
  a live publisher canary and the G4-gated hourly schedule remain open.
- [ ] **SYNC-03 Implement FR modification discovery.** Query source modification time with overlap, bounded pagination
  and saturation splitting, including edits to old publication dates. **Done:** an old corrected rule enters the same
  acquisition/reconciliation pipeline as a new publication; publication-date-only polling cannot hide the correction.
  Depends on SYNC-01, ING-08.
- [ ] **SYNC-04 Discover annual edition inventory changes.** Refresh available year/title/volume manifests and package
  observations without assuming a new directory year means new text. **Done:** new/missing/replaced volumes trigger
  all-volume revalidation; repeated Title 1 bytes preserve honest currency. Depends on SYNC-01, ING-04/12.
- [ ] **SYNC-05 Classify changed observations.** Distinguish new text, same-date corrected bytes, metadata/currency-only
  change, moved membership and removed record using source/normalized hashes. **Done:** unchanged text reuses immutable
  versions, while changed passage context still triggers the appropriate derived work. Depends on ING-11, SYNC-02–04.
- [ ] **SYNC-06 Publish corrections atomically.** Run a failed refresh, out-of-order old correction and successful new
  version through canonical validation/head selection and durable derived outboxes. **Done:** failed refreshes preserve
  the previous valid scope; late history cannot overwrite newer current data. Depends on SYNC-05, ORCH-05.
- [ ] **SYNC-07 Emit scoped change events.** Record observed change type, exact before/after version, evidence and
  historical-import flag; separate effective/publication/observation dates. **Done:** backfill/parser replay emits no
  ordinary new-regulation alert and duplicate discovery causes no duplicate event. Depends on SYNC-06, ING-10–11.
- [ ] **SYNC-08 Complete incremental derived catch-up.** Connect correction outboxes to preparation, copy validation,
  vector invalidation/generation and search selection using bounded shared queues. **Done:** a changed version cannot
  serve stale vectors and a metadata-only update does not cause a full re-embedding. Depends on SYNC-06, INDEX-04,
  VECTOR-06; use bounded pilot vectors before bulk approval.
- [ ] **SYNC-09 Implement reconciliation sweeps.** Run daily recent-FR/current-title checks plus rotating supported-history
  inventory/hash audits. **Done:** a deliberately missed discovery event or same-date correction is found and repaired
  with a targeted unit, not an unbounded national reimport. Depends on SYNC-02–08.
- [ ] **SYNC-10 Exercise extended source outage recovery.** Simulate failure beyond the normal overlap window, cursor
  loss and multiple queued changes to one title. **Done:** discovery expands/replays a bounded recovery window, latest
  valid state wins, delayed work remains visible and no source window is silently skipped. Depends on SYNC-09, ORCH-08.
- [ ] **SYNC-11 Activate only gated schedules.** Reconcile intended versus deployed schedules read-only, then activate
  the approved source/corpus scope with recorded cutoff, cadence, environment and run IDs. Activate rights-maintenance
  separately from source collection after its deployed smoke. **Done:** no duplicate schedules, excluded backfills stay
  visible, pause is tested, and the selected backfill gate G4 has passed without quietly reducing scope.
- [ ] **SYNC-12 Run the seven-day freshness soak.** Measure source publication delay separately from discovery-to-canonical,
  lexical and semantic lag; include an outage and repair. **Done:** the specified p95 targets (30/45/120 minutes
  respectively) are measured for the approved workload or the gate remains failed; report real versus synthetic changes.
  Depends on SYNC-11, OPS-11–12. Sparse live changes cannot be presented as seven days of demonstrated update throughput.

## Deployment, scale and operations

Use existing Railway/Trigger/database/artifact infrastructure. Numerical limits are selected from measured capacity;
historical legislative embedding throughput and concurrency settings are not automatically valid for regulations.

- [ ] **OPS-01 Inventory actual deployed capacity.** Record environment IDs, task runtime/SDK versions, active queues,
  source rate budgets, database/PgBouncer ceilings, memory/storage, search host and existing workload. **Done:** a dated,
  credential-free capacity report identifies headroom and actual connections, not assumed local defaults.
- [ ] **OPS-02 Define deployment and artifact configuration.** Validate canonical/search separation, source credentials,
  immutable artifact prefixes, manifests, encryption/access and environment-specific settings using existing secret
  management. **Done:** target validation fails before writes on a wrong database; test artifacts cannot be mistaken
  for production source evidence. Depends on OPS-01.
- [ ] **OPS-03 Apply and verify schemas in development.** Deploy the canonical unreleased baseline and isolated search
  schema using repository conventions; inspect constraints/indexes and failure behavior. **Done:** disposable and
  development checks agree; no incidental legacy-vector rebuild or unrelated schema reset occurs. Depends on OPS-02.
- [ ] **OPS-04 Verify packaged runtime startup.** Deploy the parser and candidate tokenizer workers; validate Python
  executable, XML parser, tiktoken WASM and pinned Voyage JSON assets in the actual task image. **Done:** retained real
  input reproduces local hashes/token counts; task memory/time are measured, not inferred from a local import.
- [ ] **OPS-05 Deploy the bounded workflow canary.** Register controller/worker identities and run a tiny acquisition-to-
  acknowledgement manifest with schedules disabled. **Done:** task discovery, environment routing, run references and
  stage transitions pass through deployed services. Depends on OPS-03–04, ORCH-01–07, INDEX-03.
- [ ] **OPS-06 Measure workload-specific machine and queue limits.** Benchmark large titles, XML issues, HTML/PDF fallback,
  tables, copies, vector writes and query traffic separately. **Done:** retained RSS/CPU/IO/DB/provider metrics justify
  task duration, machine size, batch limits and aggregate concurrency; no existing workload is starved. Depends on OPS-05.
- [ ] **OPS-07 Establish progress and cost telemetry.** Emit manifest/unit/stage/source/model correlations, attempts,
  queue age, bytes, records, tokens and provider charges without source secrets or full text. **Done:** operators can
  explain one failed unit and estimate remaining work/cost from dashboards plus durable records. Depends on ORCH-01.
- [ ] **OPS-08 Deploy gated API/MCP services.** Configure organization canary access, distinct token audiences and explicit
  readiness switches; serve only acknowledged selected generations. **Done:** actual endpoint/tool canaries pass and
  unknown scopes cannot reach an internal unguarded search path. Depends on HTTP-03/09, TOOLS-01–04, OPS-02–03;
  this deployment enables the subsequent HTTP-14/TOOLS-05 smoke rather than depending on its prior completion.
- [ ] **OPS-09 Run production-target readiness inspection.** Read canonical inventory, target receipts, index validity,
  vector route/dimensions and pending age on the actual deployments. **Done:** evidence differentiates local/development/
  production scope; incomplete data is blocked from promotion. Depends on INDEX-06/12, VECTOR-10 for semantic scope.
- [ ] **OPS-10 Rehearse capability rollback.** Pause dispatch, disable semantic/lexical independently, restore a previous
  allowed generation and resume retained work. **Done:** no source/vector deletion or full rebuild is needed; revoked
  generations cannot be restored merely because they were previously active. Depends on OPS-08–09, INDEX-14/VECTOR-11.
- [ ] **OPS-11 Add actionable alerts.** Monitor stale source discovery, queue stalls, retries/quarantine growth, unmatched
  inventories, copy/embedding lag, failed index builds and resource saturation. **Done:** inject each class and verify
  existing alert delivery, deduplication and links to the relevant unit/runbook. Depends on OPS-07, SYNC-09.
- [ ] **OPS-12 Write and exercise repair runbooks.** Cover provider cooldown, poison source/XML, stuck lease, missing
  volume, duplicate identity, model outage, correction lag and revoked source. **Done:** exact inspect/pause/repair/resume
  commands work in development and preserve original evidence; operational owner is assigned. Depends on ORCH-12, OPS-11.
- [ ] **OPS-13 Verify backup and restore.** Restore canonical records, immutable artifact references, durable jobs and
  selected search/vector state into an isolated target; identify projections that require recopy. **Done:** source-to-
  citation checks and recovery timing meet recorded objectives; restored revoked data remains inaccessible. Depends on OPS-03/09.
- [ ] **OPS-14 Set retention and garbage collection.** Define retention for source bytes, immutable versions, retired
  indexes/vectors, candidate cursors, evaluation caches and workflow evidence, respecting legal/source rights. **Done:**
  dry-run GC lists only unreferenced eligible objects; a cancelled wave and historical citation retain required data.
  Depends on OPS-13, INDEX-05, VECTOR-06.
- [ ] **OPS-15 Run final concurrent serving acceptance.** Exercise ingestion, search, source correction, API/MCP clients
  and ordinary legislative work together using agreed representative load. **Done:** correctness, latency, connection
  ceilings, freshness and rollback tests pass with raw evidence; fixture-only checks are labeled. Depends on SYNC-12,
  HTTP-16, TOOLS-10, OPS-10–14.
- [ ] **OPS-16 Publish the release evidence and coverage.** Record completed corpus/date ranges, exclusions, model route,
  deployed revisions, source/search/semantic gates, runbooks and known limitations. **Done:** documentation, API coverage,
  enabled schedules and product claims agree; source inventory and all selected downstream counts reconcile. Depends on
  ING-16, PASS-10, INDEX-14, qualified VECTOR scope, OPS-15. Root `pnpm verify` is clean for the delivered revision.

## Explicit extension lanes

These prevent current federal work from hard-coding assumptions that block later feeds. They do not imply a license,
all-state coverage, daily historical availability or a commitment to ingest every external source immediately.

- [ ] **EXT-01 Qualify U.S. Code source releases.** Inspect actual publisher release inventory and currency; choose the
  authoritative current statutory-context source and preserved editions. **Done:** release/format/rights evidence and
  an explicit statutory manifest exist; no fixed stale year is embedded in acquisition logic.
- [ ] **EXT-02 Add the statutory adapter and pilot.** Map a bounded U.S. Code sample through common code/provision/
  edition/passage/search contracts and resolve evidenced authority links. **Done:** corpus filters distinguish statutes
  from regulations and missing authority text remains explicit. Depends on EXT-01, ING-10, INDEX-02, HTTP-07.
- [ ] **EXT-03 Obtain Vaquill delivery evidence.** Request actual feed schema, dated jurisdiction/corpus/history inventory,
  representative snapshots/deltas, identifiers, update policy and permitted uses through an authorized commercial process.
  **Done:** coverage and redistribution/embedding/API rights are documented; marketing claims are not treated as evidence.
- [ ] **EXT-04 Test synthetic state compatibility now.** Exercise arbitrary state citations, unknown currency, non-English
  text, restricted territory/redistribution, withdrawal and incomplete history through common storage/query contracts.
  **Done:** federal-specific assumptions fail visibly without changing federal IDs or buying vendor data.
- [ ] **EXT-05 Implement the licensed adapter after qualification.** Map actual vendor identity, provenance, snapshot/delta
  ordering and rights into existing durable stages. **Done:** missing sequence and termination/revocation tests require
  recovery or purge as specified; no duplicate state-specific query pipeline. Depends on EXT-03–04 and licensed access.
- [ ] **EXT-06 Pilot and qualify state cohorts.** Compare representative vendor code/statute text and currency to official
  sources; measure missed/late updates and API/MCP parity. **Done:** capability is promoted per verified jurisdiction/
  corpus/history cohort; state rulemaking is claimed only if separately supplied and verified. Depends on EXT-05.
- [ ] **EXT-07 Scope docket and planning enrichment.** Define separate Regulations.gov docket/comment/attachment and
  RegInfo agenda/OIRA manifests, joins, rate budgets and coverage semantics before implementation. **Done:** source
  overlap and missing link behavior are explicit; these records are not confused with consolidated CFR text.
- [ ] **EXT-08 Qualify additional federal formats separately.** Assess pre-2000 FR, guidance/enforcement and incorporated
  standards only against a concrete source/rights/format proposal. **Done:** each approved expansion has its own adapter,
  cost and validation backlog; unavailable formats do not inflate the core federal coverage claim.
