# Remaining source ingestion and orchestration tasks

Owner: [production backlog](production-backlog.md). Requirements: [data contract](../../../../packages/legislation-core/docs/regulations/data-contract.md),
[acquisition workflows](acquisition-workflows.md). All tasks are remaining work; extend the existing implementations.

## Source inventory and reconciliation

Work in `src/ingestion/regulations/`, `python/regulations/parse_xml.py`, existing regulatory scripts and baseline
migration 0048. Source fixes can proceed independently of controller deployment. Live backfill dispatch depends on G1.

- [ ] **ING-01 Freeze the delivery manifest.** Extend the existing planner to record absolute cutoff, jurisdiction,
  corpus, source, title/year/month/volume, required renditions and inclusion/exclusion reason. Separate current, recent,
  extended history and optional statutes. **Done:** repeated planning against retained discovery produces identical
  unit IDs and denominators; unsupported periods cannot become successful empty partitions.
  Partial implementation: replay-verified delivery partitions and required-evidence lists now exist through planner
  `--delivery-output`; selecting/freezing the actual full release manifest and documenting non-reserved exclusions remain.
- [ ] **ING-02 Reconcile retained inputs before dispatch.** Inventory existing raw artifacts, normalized shards,
  canonical editions/observations and their hashes across the retained pilots and intended deployment. Produce a
  reuse/missing/invalid plan. **Done:** all 49 current eCFR titles and 275,149 recorded memberships are accounted for;
  valid retained units are not downloaded again. Depends on ING-01.
  Partial implementation: `audit-regulatory-reuse.ts` now verifies retained raw XML and current-parser normalized
  generations against a replayed manifest, reporting missing/damaged/conflicting copies and explicit next actions.
  Retained smoke verified all 49 raw titles and older normalized generations containing 275,149 records. The subsequent
  `replay:regulatory-parser` run generated current-parser output for all 49 titles in ten bounded batches; exact shards
  and source metadata matched every retained baseline, with no failures or differences requiring review.
  The local canonical audit now verifies all 49 published/current eCFR editions and 275,149 exact staged records and
  memberships with zero mismatches. The normalized importer revalidates and reuses these editions without new work;
  a real Title 1 `--reuse-only` CLI run succeeded through a database-enforced read-only connection.
  Remaining closure steps: annual CFR/FR canonical observations and reuse, intended-deployment inventory, and deployed
  controller admission/recovery integration. Local prototype verification does not certify a production destination.
  Evidence: `ecfr-retained-generations-audit.json`, `ecfr-parser-replay-20260915-085444/complete.json`,
  `ecfr-canonical-reuse-audit.json` and `ecfr-canonical-dispatch-reuse-smoke.json` in backfill artifacts.
- [x] **ING-03 Resolve annual CFR Title 5 volume 2.** Inspect the real quoted-revision boundaries against official
  alternate renditions; determine whether the 1,647 nested sections are quoted content or malformed structural scope.
  Implement a source-evidenced parser rule or retain an explicit unavailable partition. **Done:** current and quoted
  text inventories reconcile without duplicate current identities; the warning is never merely disabled.
  Closed locally September 15: [source review](annual-title5-source-review.md) confirms 1,631 current sections and
  16 quoted future sections inside the malformed scope. The exact-artifact correction restores 45 logical parents;
  changed bytes still require review. All three annual volumes published atomically at the January 1, 2025 revision
  date. Read-only comparison verified 6,803 staged records and canonical memberships with zero differences, including
  text, blocks and parents. Evidence: `annual-title5-reviewed-canonical-audit.json` in backfill artifacts.
- [ ] **ING-04 Complete annual date dispositions.** Persist the existing Title 1 duplicate-revision assessment through
  canonical observation/edition publication and selectors. Broaden checks to every selected annual volume. **Done:**
  later package labels sharing 2023 bytes retain their observations but do not fabricate 2024/2025 text currency;
  conflicting volume dates prevent title publication.
  Partial implementation September 15: the normalized importer now persists `observed` annual generations anchored
  to a verified, published revision-year volume. It compares exact content and hierarchy, preserves original date
  warnings, and creates no later-year edition or derived work. A fresh isolated Title 1 pilot has one 2023 edition
  with 368 memberships and two 2024/2025 observations; replay leaves all counts unchanged. Evidence:
  `annual-title1-observation-audit.json`, `annual-title1-observation-import.json` and
  `annual-title1-observation-replay.json`. See [observation contract](annual-source-observations.md).
  Remaining: reconcile this disposition across every annual unit in the final frozen release manifest; pilot
  completion does not establish release-wide historical coverage.
- [x] **ING-05 Complete FR collision identities.** Apply the existing citation/source-location evidence to canonical
  identity registration for `00-113`, distinguishing the airspace rule from the land notice despite their shared printed
  number. **Done:** both source observations survive, IDs replay stably, no metadata/text cross-association remains,
  and the issue denominator is reconciled to actual documents rather than unique document numbers.
  Closed locally September 15: [source-based publication](fr-source-identities.md#canonical-publication-contract)
  atomically publishes all 110 January 18, 2000 XML records using 107 validated document PDFs and three reviewed
  issue-PDF extracts. Both `00-113` publications retain distinct citation IDs, corrected metadata and their original
  footers; `00-1083` has an evidenced title correction. Replay creates no additional versions or events. An independent
  database audit compares all 110 bodies, headings, blocks, kinds and locators to staged XML with zero differences.
  Number lookup remains ambiguous; the number-only writer still rejects ambiguous aliases. Original conflicting
  metadata is retained separately. Evidence: `fr-jan18-source-publication.json`, its replay report and
  `fr-jan18-source-publication-audit.json`. This is local canonical coverage, not deployed indexing or embeddings.
- [ ] **ING-06 Finish rendition reconciliation.** Connect existing XML, document HTML and PDF/OCR evidence paths to one
  per-document required-rendition status. Preserve native page spans and shared-page boundaries. **Done:** missing XML
  can use verified alternate text; wrong-subject HTML, adjacent PDF text and unusable OCR remain quarantined. Depends on ING-05.
  Partial implementation: separate artifact-bound field reviews retain corrected titles, kinds and page intervals
  for both `00-113` documents and the `00-1083` subscript conflict. Original source evidence remains unchanged.
  Shared-page boundaries and rejected mixed HTML are explicit.
  Subsequent local evidence: the complete official PDF passes the existing PDF.js text/operator gate on all 321
  pages; the sole empty-text page is visibly blank. `stage:fr-pdf-regions` now extracts reviewed columns for the
  three disputed records with exact hashes, identity/neighbor/footer gates and concurrent replay verification.
  The January 18 pilot now persists all 110 required-rendition outcomes and consumes them in atomic canonical
  publication. Remaining: apply the policy across the frozen release inventory and qualify missing-XML/OCR fallback;
  the reviewed PDF extracts are supporting evidence, not a replacement for canonical XML.
- [ ] **ING-07 Freeze current eCFR currency.** Reconcile the retained title inventory with an explicit publisher cutoff,
  reserved title 35, import-in-progress titles and per-title issue dates. Plan only genuinely missing/corrected versions.
  **Done:** every requested title is validated, delayed or excluded with evidence; collection time never substitutes
  for publisher currency. Depends on ING-01–02.
- [ ] **ING-08 Qualify the recent FR window.** Build complete day/document inventories for the frozen 90-day window,
  including rules, proposals and notices; exhaust metadata pagination and split saturated windows. **Done:** independently
  sourced expected IDs and text/metadata/rendition outcomes reconcile for every day. Depends on ING-01, ING-05–06.
- [ ] **ING-09 Finish source-agency mapping.** Persist publisher agency IDs/names and reviewed mappings to existing
  organization identities; preserve unresolved aliases and multiple issuing agencies. **Done:** unknown aliases remain
  searchable as source references without creating fictitious organizations or dropping documents.
- [ ] **ING-10 Persist evidenced relationships.** Extend literal authority/CFR/Public Law extraction into typed edges
  with exact version, locator and supporting text. Build action/publication groups only from explicit source evidence.
  **Done:** ambiguous citations and absent statutes remain unresolved; similarity never creates an authority edge.
- [ ] **ING-11 Complete deletion and historical precedence.** Exercise removed/moved/renumbered provisions and older
  backfills against newer current heads, including unchanged text with changed hierarchy. **Done:** absence from an
  incomplete import cannot mean repeal; exact prior versions remain addressable and older observations cannot win.
- [ ] **ING-12 Plan recent historical partitions.** Freeze FR 2020-to-cutoff and annual CFR 2020-to-latest inventories,
  all required volumes, format/rendition availability and byte estimates. **Done:** partition replay is deterministic;
  each annual title has a frozen complete volume denominator. Depends on ING-01, ING-03–06.
- [ ] **ING-13 Execute recent historical backfills.** Dispatch the ING-12 partitions through the deployed controller;
  capture source/canonical count/hash reconciliation and duplicate-observation dispositions. **Done:** every requested
  partition is verified or explicitly blocked, no newer head is replaced, and replay writes no duplicate events.
  Depends on G1, ING-11–12.
- [ ] **ING-14 Qualify extended history.** Sample each source-format era, then freeze FR 2000–2019/CFR 1996–2019 units
  with missing XML and alternate-rendition policies. **Done:** representative years and known defect fixtures pass;
  no pre-2000 FR XML assumption leaks into the supported manifest. Depends on ING-06, ING-12.
- [ ] **ING-15 Execute extended history.** Run resumable year/month/title waves with per-partition throughput, failures,
  hashes and storage growth. **Done:** all selected units reconcile and no aggregate success conceals a missing year,
  volume or document. Depends on ING-13–14 and ORCH-14.
- [ ] **ING-16 Produce the final source coverage ledger.** Join expected inventory, acquired artifacts, parsing,
  publication, quarantine and approved exclusions; retain original and resolved defect evidence. **Done:** every unit
  has one explainable disposition and zero unexplained gaps; downstream stages can consume the ledger. Depends on the
  executed ING-07/08/13/15 scope, not optional U.S. Code.

Source smoke gate: source bytes -> normalized text/tables -> canonical memberships must agree for modern XML,
alternate HTML/PDF, duplicate printed identifiers, a quoted revision and conflicting annual dates. Unsupported source
data is reported as unavailable, not a successful import. Live source availability and fixture reproducibility are
separate evidence fields.

## Orchestration and recovery

Extend `src/trigger/tasks/`, existing regulatory checkpoint/outbox services and shared synchronization infrastructure.
Reuse the preparation, copy and rights workers. Keep task payloads small references; no document bodies or secrets.
Workstream prerequisites: ING-01 for durable identities and OPS-01–03 before live deployment/dispatch.

- [ ] **ORCH-01 Define the remaining stage state machine.** Map inventory, acquisition, parse, validation, publication,
  preparation, copy, acknowledgement and embeddings to existing durable records; add only missing transitions.
  **Done:** each stage has prerequisites, terminal states, retry disposition and owner; failed/delayed work cannot
  satisfy parent completion. Migration and state-transition tests cover illegal advances.
- [ ] **ORCH-02 Implement the bounded controller.** Select eligible units by indexed keyset, reserve a finite dispatch
  window and persist child handles; submit batches of at most 100. **Done:** restarting the controller resumes its
  manifest without loading or dispatching the whole national inventory. Depends on ORCH-01.
  Local progress: pending discovery rows can now be registered in immutable current-acquisition manifests of at most
  100 units. Selection, manifest persistence and the registered transition are atomic and use locked bounded rows. A
  manual controller now plans the next committed stage with keyset pages of at most 100, persists all child intents and
  submits them serially with stable global Trigger keys. Current-eCFR discovery now starts one 25-unit controller window
  after committing changed units, and every canonically completed source-stage worker replenishes that bounded window
  with a replay-stable global key after closing its database pool. Multi-source admission, deployed verification and
  measured aggregate limits remain open.
- [ ] **ORCH-03 Add the acquisition worker adapter.** Wrap existing source clients/artifact acquisition with strict
  payloads, source budgets, artifact references and committed checkpoints. **Done:** interrupted downloads never
  produce a complete artifact; retry verifies checksum and reuses valid retained bytes. Depends on ORCH-01.
  Local progress: one current discovery unit now streams through the existing bounded XML/checksum implementation and
  atomically records its artifact and receipt on the registered discovery row. Retry revalidates retained bytes. Shared
  provider admission/cooldown, persisted worker leases and deployed durable artifact storage remain open.
- [ ] **ORCH-04 Add the parser and validation worker adapters.** Invoke the existing Python bridge with bounded
  manifests/shards, resource limits and safe failure summaries. **Done:** process exit, timeout, missing shard and
  invalid envelope leave the unit unpublished; retry preserves deterministic normalized hashes. Depends on ORCH-03.
  Local progress: acquired current units now use the existing bounded Python parser and full TypeScript shard,
  provenance, hierarchy, hash and count validation. Parser state commits only after validation and deterministic retry
  reuses the generation. Deployed runtime/resource smoke and durable submission/lease recovery remain open.
- [ ] **ORCH-05 Add publication worker adapters.** Invoke existing eCFR/FR/annual writers only after full required-unit
  validation; persist stage completion with the canonical publication transaction. **Done:** missing annual volume or
  failed outbox write cannot partially promote a title. Depends on ORCH-04, ING-11.
  Local progress: a parsed current eCFR unit now revalidates its manifest, receipt, source artifact and normalized shards,
  then uses the existing fenced canonical staging/materialization/publication path. Its discovery row records the exact
  published generation and edition only after the canonical transaction succeeds. Real retained Title 1 bytes published
  368 members, one current head and one lexical outbox item; replay reused the same identities. FR/annual controller
  handoff, deployed verification and downstream dispatch remain open.
- [ ] **ORCH-06 Connect preparation, copying and acknowledgement.** Dispatch existing workers from publication state;
  route copy exhaustion to resumable INDEX-03 validation before acknowledgement. **Done:** copied-but-unacknowledged
  data remains unavailable, completed stage replay is safe, and no preparation task automatically creates vectors.
  Depends on ORCH-05, INDEX-03.
  Local progress: a canonically prepared scope now hands off to bounded passage copying with a preparation-scoped global
  key. Exhausted copy hands off to bounded validation; validation continues from persisted ordinals and submits the
  separate finalizer only after its last page passes. Finalization remains the only step that acknowledges the lexical
  outbox, and no handoff creates embeddings. Two real PostgreSQL tests pass partial-copy and complete
  validation/acknowledgement behavior. An explicit model-bound admission mode now selects only due pending eCFR,
  annual-CFR or Federal Register lexical outbox scopes, persists at most ten intents and submits them through recovery.
  A fresh current-publication database test admitted one lexical job exactly once. Deployed handoff smoke, selected-scope
  scale, large-scope resumable finalization and completion accounting remain open.
- [ ] **ORCH-07 Close submit/ack races.** Persist submission intent and attempt identity around Trigger calls; reconcile
  uncertain responses and expired idempotency retention using database uniqueness. **Done:** crash after acceptance
  but before saving a run ID cannot create duplicate canonical work or leave a permanently undiscoverable unit.
  Depends on ORCH-02.
  Local progress: the explicit preparation dispatcher persists bounded waves before submission, uses fenced leases
  and global Trigger keys, reuses saved handles and refuses old uncertain keys before TTL expiry. PostgreSQL fault
  canaries pass; disposition reconciliation, automatic scanning and deployed faults remain open. See
  [durable preparation dispatch](preparation-dispatch.md).
  Explicit wave recovery now reads verified stored payloads with bounded keyset paging and read-only preview by
  default. Executing a page reuses original keys/handles and defers busy/old uncertain intents. A separate manual
  preparation-run recovery path now inspects Trigger disposition, retains protected attempts, records prior run history
  and increments the persisted attempt before replacing cancelled, expired or failed children. Deployed
  submit-before-ack and late-worker fault injection remain open.
  The source-stage controller now applies the same persist-before-submit boundary to acquisition, parsing and
  publication. Each stage intent retains its immutable payload, lease, first attempt and Trigger run ID; uncertain
  submission retries keep the original attempt key. Bounded reconciliation now preserves active and recent uncertain
  runs, records prior run history and increments the attempt before an eligible replacement receives a new global key.
  Workers now record canonical completion before submitting continuation, close their database pools first and reuse a
  global continuation key on task retry. A fresh PostgreSQL check rejects premature completion, accepts completion only
  after real acquisition state advances and proves replay is idempotent. Deployed submit-before-ack and late-worker
  fault injection remain open.
- [ ] **ORCH-08 Recover cancelled, lost and expired runs.** Reconcile durable pending work with Trigger run disposition,
  lease expiry and retry time; enqueue a fenced replacement only when eligible. **Done:** cancelled parent, killed
  child, missing run history and late original worker all converge to one valid completion. Depends on ORCH-07.
  Local progress: the manual source-stage recovery task inspects at most 25 durable intents through Trigger run history.
  Active runs are retained; terminal failures receive a persisted incremented attempt before replacement. Missing saved
  handles wait six days and missing remote history waits seven days, matching global idempotency retention. Remote success
  is accepted only after canonical stage advancement; otherwise the state mismatch remains visible. Fresh PostgreSQL
  tests cover active retention, failed-run replacement, uncertain submission retention and expiry, missing-history
  replacement, premature completion, completed-stage reconciliation and replay-safe publication. Deployed cancellation,
  killed-worker, late-original and parent-replacement smoke still keep ORCH-08 open. Preparation dispatches now use the
  same canonical-state rule and attempt-specific replacement keys; fresh-database evidence is recorded in the progress
  ledger. Copy/validation/finalization run-disposition recovery and deployed faults remain open.
- [ ] **ORCH-09 Share provider admission and cooldown.** Reuse host/key budgets across GovInfo legislative and regulatory
  callers; persist Retry-After cooldown and bounded jittered retry. **Done:** two parents cannot multiply the provider
  allowance, a 429 pauses the affected budget, and unrelated providers can progress. Depends on ORCH-03.
- [ ] **ORCH-10 Enforce aggregate database admission.** Budget the actual pools for parser/publication/copy/vector work,
  existing legislative jobs and repair capacity; reserve the specified freshness/repair share. **Done:** measured
  peak connections remain below OPS-01's verified limit at configured fan-out. Depends on OPS-01, ORCH-02.
- [ ] **ORCH-11 Add cooperative pause and cancellation.** Stop admitting new units at stage boundaries while retaining
  committed artifacts/checkpoints; document handling of an already-running transaction. **Done:** pause/resume loses
  no work, does not turn cancellation into success and does not require deleting prototype data. Depends on ORCH-08.
- [ ] **ORCH-12 Add operator preview and repair commands.** Implement planned `run-regulatory-backfill.ts`,
  `inspect-regulatory-readiness.ts` and `repair-regulatory-units.ts` using existing services. **Done:** default invocation
  is read-only; apply binds exact manifest/environment/units and records disposition; malformed targets fail before writes.
  Depends on ORCH-02, ORCH-08.
- [ ] **ORCH-13 Run deployed fault-injection smoke.** Exercise 429/5xx, missing blob, parser kill, lost lease, duplicate
  parent, submit-before-ack crash, target commit/source failure and cancelled child. **Done:** retained run IDs and DB
  checks show no lost work, duplicate publication or premature acknowledgement. Depends on ORCH-03–12, OPS-04–05.
- [ ] **ORCH-14 Run staged scale trials.** Benchmark 2/4/8/16 workers using fixed representative manifests, with an
  existing legislative job active; record throughput, p95 time, memory, connections and queue age. **Done:** select a
  measured concurrency ceiling, stop at resource saturation and document rollback. Depends on ORCH-09–10, ORCH-13.
- [ ] **ORCH-15 Implement completion accounting.** Aggregate expected/completed/delayed/failed/quarantined/cancelled
  units and downstream stages without treating empty runnable queues as completion. **Done:** a delayed retry and
  an unacknowledged copy keep the appropriate gate incomplete. Depends on ORCH-01, ORCH-06–08.
  Local progress: planned preparation waves now persist the exact model-bound preparation identity and have a read-only
  aggregate inspector. It requires an exhausted nonempty plan, denominator equality, canonical run completion, prepared
  passage state, active display/search rights and acknowledged lexical copy for every scope. Fresh PostgreSQL checks
  prove pending planning, missing preparation, delayed retry and unacknowledged copy remain incomplete, while a real
  copied and acknowledged scope becomes ready. Immutable current-source manifests now have a separate read-only
  inspector that reconciles their exact unit denominator, source-stage intents and attempt history, canonical
  publication references, versioned rights and lexical outbox admission. It distinguishes terminal quarantine from
  readiness and refuses premature remote completion, delayed lexical work and incomplete source stages. Frozen-scope,
  A cross-database per-preparation inspector also reconciles the complete lexical handoff through target membership,
  validation checkpoints, exact receipt identity and live source/target revision fences; it cannot treat traversal or
  checkpoint exhaustion as acknowledgement. Frozen-scope, embedding and multi-partition rollups remain open.
- [ ] **ORCH-16 Run an interrupted multi-partition wave.** Complete a representative current/FR/annual manifest across
  controller restart and deployment replacement using the chosen concurrency. **Done:** final ING-16 ledger and
  canonical hashes match uninterrupted execution; actual costs and elapsed time are retained. Depends on ORCH-14–15.

Orchestration release gate: executable failure recovery passes in the deployed runtime; throughput increases within
measured budgets; work is recoverable after scheduler/run-history loss; source collection schedules remain disabled.
