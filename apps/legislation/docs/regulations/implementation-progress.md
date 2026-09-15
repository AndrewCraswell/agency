# Federal regulatory implementation progress

Updated September 15, 2026. Implementation is underway. Backfill first: all recurring regulatory source schedules remain
disabled. This is a dated execution ledger, not a recurring-agent configuration or task queue. Older entries describe
then-current blockers and counters; newer evidence and the production backlog supersede those operational directions.

Current task selection is owned by the [remaining production backlog](production-backlog.md), expanded September 15
into concrete source, orchestration, passage/index, evaluation/vector, HTTP/MCP, sync and operations tasks. The original
phase checklist is retained as prior art. This backlog update establishes no new implementation or deployed coverage.
The remaining-work plan contains 147 tasks with closure evidence, dependency ordering and five capability-specific
gates. Documentation review and `git diff --check` passed; root `pnpm verify` passed with nine successful tasks in
2m43s. Verification log: `C:/Users/andcra/AppData/Local/Temp/tabra-production-backlog-verify.log`.

## Implementation evidence, newest first

ING-02 now has exact canonical eCFR verification and reuse at the existing normalized-import dispatch entry point.
The inspector uses one repeatable-read, read-only PostgreSQL snapshot per title and bounded record batches. It verifies
the raw artifact, stored manifest/generation identity, current rights, edition dates/head precedence, staged payloads,
record hashes, provision identities, version text/tables and every edition membership/parent against replayed output.
Counts alone cannot pass. Corruption, ambiguous generations and active writers prevent reuse; valid older-parser
editions are returned without new generations, leases or outbox work. `--reuse-only` also enforces read-only access at
the PostgreSQL connection level and cannot fall through to importing missing units.

The retained local pilot on port 55438 passed all 49 active eCFR titles: 49 distinct published/current editions and
275,149 exact records/memberships, zero mismatches and zero failures. Evidence:
`artifacts/regulatory-backfills/ecfr-canonical-reuse-audit.json`. A live Title 1 invocation through the actual importer
CLI returned its existing edition with `reused: true` under database-enforced read-only access; evidence:
`ecfr-canonical-dispatch-reuse-smoke.json`. These runs made no canonical writes, downloads or embedding requests.
The deployment destination and deployed Trigger controller still need their own inspection and admission/recovery gates.
Annual CFR and Federal Register canonical reuse remain separate work; ING-02 is therefore still partial.

All 66 focused checks passed, including 53 real PostgreSQL lifecycle tests. New tests prove cross-parser reuse on a
read-only connection across multiple record batches, changed inventory envelopes, corruption rejection, missing-unit
refusal and active-writer exclusion. Existing synthetic annual/FR manifests now compute size totals from their selected
units so they exercise the intended publication gates under the stronger manifest validator. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-canonical-reuse-final-tests.log`.
Final root `pnpm verify` passed with nine successful tasks in 1m55s; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-canonical-reuse-accepted-verify.log`. The repeated-file replay test now has
30-second test-harness headroom after a five-second coverage timeout; production deadlines and assertions are unchanged.

The ING-02 replay command `replay:regulatory-parser` now processes up to five freshly audited units per invocation,
with a frozen-manifest cursor, parser-code pinning, exclusive comparison reports and safe reuse of committed parser
generations. It compares exact shards and all source/count/date/warning metadata; only parser hash, runtime version
and elapsed time are excluded from parity. Differences require review and cannot change canonical data. A failure
stops cursor advancement at the last completed unit. Exhausting a cursor alone never proves whole-manifest completion.

All 13 focused replay/audit tests passed, including damaged-source recovery, corrupted shards, invalid cursors and
source-date warning differences despite identical record shards. The four-subprocess recovery test now has a
30-second harness timeout after it exceeded five seconds under full coverage; its assertions and production parser
deadline are unchanged. Focused log: `C:/Users/andcra/AppData/Local/Temp/tabra-parser-replay-final-tests.log`.
Root `pnpm verify` passed with nine successful tasks in 1m58s; log: `tabra-parser-replay-accepted-verify.log`.

The full retained eCFR replay completed in ten batches: all 49 active titles, 275,149 records, zero failures and zero
differences requiring review. Current-parser outputs were newly generated under
`artifacts/regulatory-backfills/ecfr-current-parser-normalized/`. Every retained baseline matched exact shard hashes
and source metadata; all batches used parser hash
`c17afd84575e08e1ca80c99e379ad137a5e3353a906e87ef21c10ee70ca7501c`. Frozen manifest membership reconciled
without skipped or duplicate units; reserved title 35 remains excluded. Evidence:
`artifacts/regulatory-backfills/ecfr-parser-replay-20260915-085444/complete.json` and its ten referenced batch reports.
This closes current-parser parity for retained eCFR, not canonical database parity, annual CFR or Federal Register
coverage. No source downloads, canonical changes or embeddings occurred. Next ING-02 steps are exact canonical
edition/member/content verification, intended-deployment reconciliation and dispatch reuse integration.

ING-02 now has a read-only retained-file audit and `audit:regulatory-reuse` CLI. The audit replays the frozen manifest,
streams raw checksums, validates normalized shards/records and reports conflicts, missing input, damage and older
parser generations separately. It does not access canonical databases or enable dispatch. The eight new audit tests
and six delivery-plan tests passed, including conflicting self-consistent copies, missing shards, same-length raw
corruption, altered receipt semantics and older-generation damage. Focused log:
`C:/Users/andcra/AppData/Local/Temp/tabra-retained-audit-final-tests.log`.

The retained eCFR smoke verified all 49 raw units and older normalized generations with 275,149 records. No invalid
raw/normalized copies or unassigned inventory issues were found. None of these outputs uses the current Python parser
hash `c17afd84575e08e1ca80c99e379ad137a5e3353a906e87ef21c10ee70ca7501c`; they are intact retained evidence,
not current-parser reuse receipts. No downloads, parser execution, canonical writes or embedding calls occurred.
Evidence: `artifacts/regulatory-backfills/ecfr-retained-audit-locations.json` and
`ecfr-retained-generations-audit.json`; the earlier `ecfr-retained-input-audit.json` checked current generations only.
The subsequent full replay above closes the parser-version gap found by this initial audit. ING-02 remains partial;
the 275,149 count here measures normalized records and is not a fresh database-membership audit.
Root `pnpm verify` passed with nine successful tasks in 1m54s after fixing a test-hook assertion and registering the
audit CLI in package scripts. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-retained-audit-clean-verify.log`.

ING-01 now has deterministic read-only delivery partitions through planner `--delivery-output`, with corpus,
jurisdiction, current/recent/extended wave, explicit reserved exclusions, listed volumes and required evidence.
Federal Register windows without XML retain unknown document counts and require independent inventory; annual
publication dates are not inferred from package years. Full release-scope selection and non-reserved exclusion
decisions remain open, so ING-01 is still partial and no ING-02 canonical reuse audit is claimed.

Manifest validation now checks size accounting, unique inventory requests and source-bound evidence hashes. Offline
replay reconstructs the complete requested inventory and rejects omitted units/exclusions even after rehashing.
All 33 focused tests passed; the existing omission test was updated to falsify totals consistently so it still exercises
the deeper independent replay check. A retained-evidence eCFR plan produced 50 partitions, 49 acquisition units and
one reserved exclusion at the September 14 cutoff with zero HTTP requests and identical replay. Evidence:
`ecfr-frozen-delivery-manifest.json`, `ecfr-frozen-delivery-plan.json`. CLI replay also produced the three-volume
`annual-title5-delivery-plan.json`; its source parsing/publication blocker remains unresolved. All evidence is under
`artifacts/regulatory-backfills/`. No imports, canonical writes, embedding calls or recurring activation occurred.
Focused log: `C:/Users/andcra/AppData/Local/Temp/tabra-delivery-plan-final-tests.log`. Root `pnpm verify` passed with nine successful tasks in 2m16s (`tabra-delivery-plan-clean-verify.log`). The prior run hit an unrelated five-second bill-retrieval timeout; that test passed on the unchanged rerun. A test-only clone lint issue was also corrected.

Bounded passage-copy traversal and its explicit-dispatch Trigger worker are now implemented. The service validates
prepared inventory and live rights, copies at most 25 versions, yields after its admission deadline, and resumes only
from committed ordinals. The worker closes both pools before idempotent continuation. Traversal exhaustion never marks
search ready or acknowledges the outbox; whole-copy inspection remains mandatory.

All 44 focused tests passed, including the PostgreSQL lifecycle suite and four worker tests. New database coverage
proves replay, unavailable-target recovery, invalid-cursor rejection and refusal to acknowledge a skipped inventory.
The retained Title 2 smoke replayed ordinals 0–9 identically and advanced through 10–19 with zero HTTP calls. Evidence:
`artifacts/regulatory-backfills/passage-copy-batch-smoke.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/tabra-copy-batch-tests.log`. The smoke ran the local service, not a deployed task.
Controller admission, deployed runtime validation, cancellation recovery and large-scope resumable acknowledgement
remain open. No recurring source schedules or embedding requests were enabled. Root `pnpm verify` passed with nine successful tasks in 1m55s; log: `C:/Users/andcra/AppData/Local/Temp/tabra-copy-batch-verify.log`.

The explicit-dispatch `regulatory-passage-preparation` Trigger worker now wraps canonical preparation with strict
scope/model/batch payloads, two-worker concurrency, two connections per worker, lease-aware retries and idempotent
continuation. It closes its pool before submitting a successor, reloads remaining items from canonical checkpoints,
and refuses no-progress or inconsistent receipts. Completion stops the chain without copying, acknowledging or
embedding anything. This is one worker; controller admission, cancelled-run recovery and deployed packaging/load
smokes remain open. No schedules were created or enabled.

All 12 focused worker tests passed. A local execution against the retained annual CFR Title 2 pilot revalidated
all 2,200 completed versions, processed zero new versions and made zero HTTP requests (HTTP was blocked by the smoke).
The smoke called the actual worker function, not a deployed Trigger task. Evidence:
`artifacts/regulatory-backfills/preparation-worker-smoke.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/tabra-preparation-worker-tests.log`. Final root `pnpm verify` passed with nine successful tasks in 1m43s after correcting test assertions and mock types. Log: `tabra-preparation-worker-final-verify.log`.

Strict legal search transport schemas now validate corpus/date compatibility, bounded selectors, mode-dependent limits,
exact-version hit context and consistent generation/model/degradation metadata. Existing client envelopes are shared
without changing existing parsers. Route serialization, a callable client method and MCP wiring remain open; this
slice does not expose a new endpoint or run embedding requests. All 42 focused contract/client tests passed; root
`pnpm verify` passed with nine successful tasks in 1m42s after correcting braces and ESM import extensions.
Logs: `C:/Users/andcra/AppData/Local/Temp/tabra-legal-contract-tests.log` and
`tabra-legal-contract-clean-verify.log`. New validation messages have not been Fluent-validated; Fluent Agent is unavailable.


The application-layer legal search canary now requires verified request-context identity, an explicit organization
allowlist, an acknowledged preparation and API/MCP rights. It rejects caller-supplied identity/access fields and limits
this initial service to official federal sources with worldwide rights. Territory-limited data is denied until trusted
territory attributes exist. Denials return a generic forbidden error; infrastructure failures remain distinguishable.
No HTTP route, typed wire DTO or MCP tool is registered by this slice.

Scope authorization now reads locked ownership/policy metadata before any full text. Internal lexical reads can remain
allowed when external API permission is denied. All 44 focused checks passed, including the real PostgreSQL lifecycle
suite, account isolation and API-disabled/territory-limited policies tested against an unavailable target to prove early
refusal. The retained title-2 source pilot returned five hits across CFR 200.302, 200.303 and 200.318 through this service.
Its identity was a synthetic trusted request context, not a live HTTP/JWT/MCP authentication exercise. Evidence:
`artifacts/regulatory-backfills/legal-api-access-smoke.json`; test log:
`C:/Users/andcra/AppData/Local/Temp/tabra-legal-access-tests.log`. No provider calls or embedding writes occurred.
Fluent Agent was unavailable; the new generic denial message has not received Fluent copy validation.
Final root `pnpm verify` passed with nine successful tasks in 1m53s after correcting a test-only literal type.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-legal-access-final-verify.log`.

Maintenance continuation checks passed (five tests), including unchanged-cursor partial drainage, completion,
idempotent dispatch retry, database failure and no-progress protection. The first full verification detected formatter
changes to the exact Federal Register metadata fixture. Reconstructing its compact JSON recovered the original
127,967 bytes and SHA-256 `8293405067402d1b94263d11d07743fd0fae71e68fc25a29467ff721a9fd8df2` exactly;
the provenance record was not changed. The raw fixture is now excluded from formatting and Git text conversion.
Focused fixture/continuation tests passed; logs: `C:/Users/andcra/AppData/Local/Temp/tabra-rights-continuation-tests.log`
and `tabra-rights-continuation-fixture-tests.log`.
The subsequent parallel repository run hit an unrelated five-second fencing-theme timeout. Sequential coverage passed
all nine tasks without weakening that test, followed by a clean root `pnpm verify` (nine successful tasks, 2m34s).
Logs: `C:/Users/andcra/AppData/Local/Temp/tabra-continuation-sequential-coverage.log` and
`tabra-continuation-clean-verify.log`. The final focused fixture/continuation run passed 26 tests. No provider calls,
embedding writes, maintenance deployment or recurring source activation occurred in this slice.

Search lifecycle handling is implemented: per-scope memberships preserve shared generations, whole-scope verified
receipts are committed before canonical lexical acknowledgement, and the current-provision reader follows and rechecks
the authoritative source head. An unindexed newer edition never falls back to an older copy. Explicit historical reads
remain possible under live rights. A receipt surviving a failed source commit cannot pass the acknowledgement gate.

Revocation reconciliation automatically scans memberships, clears selected scope receipts, resets affected lexical jobs
to pending and removes unreferenced regulatory passages/generations in 25-membership batches. Shared generations survive
until their last scope is removed. Restoring rights requires recopy/reverification. The bounded `regulatory-search-rights`
Trigger task includes continuation: an incomplete batch dispatches its returned cursor with a stable
parent-run idempotency key; uncertain dispatch retries reuse that key. Completed sweeps stop, failed database batches
dispatch nothing, and empty incomplete results fail rather than spawning a chain. Deployment and periodic activation
remain open. No source schedules or embedding rebuilds were activated.

Validation: 38 PostgreSQL tests plus two Trigger-wrapper tests passed on the sequential complete run. They cover
receipt-write rollback, deferred source-commit failure after target commit, replay, newer-head refusal, shared copies,
revocation, restoration and 25/8-member cleanup continuation. The additional Federal Register observation test passed
after correcting its fixture lookup column, verifying one publication acknowledgement leaves the other two pending
and revocation requeues only the selected observation. Logs: `C:/Users/andcra/AppData/Local/Temp/tabra-search-lifecycle-final-tests.log`
and `tabra-publication-lifecycle-final-test.log`. An earlier run overlapped another coverage process and
timed out in two tests; the focused sequential rerun passed without relaxing assertions or timeouts.
Durable target revocation markers now preserve cleanup discovery when target deletion commits but the canonical job
reset fails. The real annual-CFR title-2 pilot reused all 2,200 existing generations, verified its 2,547 passages and
acknowledged the lexical job, then repeated acknowledgement successfully. A healthy rights sweep removed nothing.
The one pilot outbox item is now acknowledged; earlier pending counts below are historical. Evidence:
`artifacts/regulatory-backfills/passage-search-lifecycle-smoke.json` (164.2 seconds for membership registration,
acknowledgement/replay and rights sweep). No provider calls or embedding writes occurred.
The final recovery run passed all **41 checks** (39 real PostgreSQL tests and two Trigger-wrapper tests), including
deferred cleanup-commit failure followed by automatic recovery from a revocation marker. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-search-lifecycle-recovery-tests.log`.
Final root `pnpm verify` passed with nine successful tasks in 1m46s after correcting four test-lint findings.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-search-lifecycle-final-verify.log`.

The isolated search canary now validates published source membership and current rights before connecting to the target.
Source rights stay locked until the read finishes, so revocation blocks disclosure even when the copy remains retained
or the target is unavailable. It checks generation ownership/metadata and completeness, then revalidates each hit against
canonical content and input hashes. It remains explicitly version-scoped and internal; API/MCP authentication, caller
entitlements, current-version selection, physical revocation cleanup and outbox acknowledgement are still open.

The real-source parity pilot identified an index mismatch: canonical FTS uses complete `input_text` (including context),
while the initial isolated table indexed only `body`. The original target schema now indexes `input_text` too, and the
regression suite includes a context-only query. Only the two disposable regulatory projection tables at ports 55443
and 55444 were reset; canonical imports, passages, preparation state, bill projections and existing embeddings were
untouched. The original failed diagnostic is retained in `artifacts/regulatory-backfills/passage-search-rights-smoke.json`.

All 37 PostgreSQL tests passed for the reader changes. The focused separate-database test passed again after the index
correction, including live-rights refusal before target access, changed-hit rejection, incomplete-generation refusal,
wrong-version refusal and the context-only query. Logs: `C:/Users/andcra/AppData/Local/Temp/tabra-search-rights-tests.log`
and `tabra-search-context-test.log`.
The corrected target copied and replay-verified all **2,200 generations / 2,547 passages** in 235.5 seconds:
`artifacts/regulatory-backfills/passage-replication-context-smoke.json`. Read-only search parity passed for CFR
200.302, 200.303 and 200.318 (five total hits), including exact IDs, order, scores and content:
`artifacts/regulatory-backfills/passage-search-context-smoke.json`. This is a bounded lexical canary, not a retrieval
quality comparison. One outbox item remains pending; zero provider requests or vector writes occurred. Final root
`pnpm verify` passed with nine successful tasks in 1m57s (`tabra-search-rights-verify.log`).

Whole-scope copy inspection is implemented in `passage-copy-readiness.ts`. It verifies the prepared inventory against
the source, every generation's ownership/context/tokenizer, and exact source/target passage equality and manifest hashes.
Separate repeatable-read transactions and row locks keep the inspected snapshots consistent. It writes no data and
leaves outbox acknowledgement and public search readiness false; those still require scope publication and access gates.

The retained annual CFR title-2 pilot passed the whole-scope inspection: **2,200 generations / 2,547 passages** in
11.7 seconds, with its one outbox item still pending and no embedding/provider activity. Evidence:
`artifacts/regulatory-backfills/passage-copy-readiness-smoke.json`. All 37 PostgreSQL integration tests passed,
including missing generation, changed target passage, changed preparation context and revoked-rights rejection.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-copy-readiness-tests.log`. The inspector has a 60-second budget and
fails closed on larger scopes that cannot finish; resumable validation of those scopes remains open.
Final root `pnpm verify` passed with nine successful tasks in 1m40s. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-copy-readiness-verify.log`.

Immutable passage generations now copy atomically into independent regulatory tables in the isolated
`legislation_passage_search` database. The worker validates ownership, canonical manifests, exact input hashes and
source rights, and holds source membership/rights locks through target commit. Target locking serializes concurrent
copies; replay checks all retained metadata and passage rows rather than trusting a previous receipt. Copy failures
roll back the whole target generation. Work is bounded by row, byte and aggregate time limits. This implements the
per-generation storage handoff; whole-scope acknowledgements, tombstones, current-version selection and public search
authorization remain open. The target uses PostgreSQL FTS for a private lexical canary, not BM25.

All 37 PostgreSQL integration tests passed, including the new separate-database test for concurrent replay,
failed-copy rollback, wrong scope, revoked rights and source/target corruption. Test source and target databases are
disposable local databases at port 55443. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-legal-replication-tests.log`.
The complete retained annual CFR title-2 pilot copied **2,200 generations / 2,547 passages**, then verified all 2,200
replays against a fresh isolated target database at port 55444. Combined copy/replay took 191.8 seconds. Canonical
publication work remains pending (one outbox item); no provider calls or vector writes occurred. Evidence:
`artifacts/regulatory-backfills/passage-replication-source-smoke.json`. Final root `pnpm verify` passed with nine
successful tasks in 1m34s after correcting two missing-brace lint findings. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-legal-replication-final-verify.log`.

Canonical passage preparation is now restartable for complete editions and publication observations. The job freezes
version/context inventory, pages metadata in bounded requests, processes at most 25 versions per invocation, and records
each completed generation. Renewable leases and fences reject active/stale workers; failures retain progress and a retry
delay. Final checks reconcile source and checkpoint inventory hashes, version/context/tokenizer associations, and passage
counts. `prepared` is a canonical-preparation state only: the source outbox stays pending until isolated-index work and
readiness gates are implemented.

The full retained 2025 annual CFR title-2 pilot at port 55444 completed **2,200/2,200 versions**, producing 2,200 immutable
generations and 2,547 passages with the OpenAI Small tokenizer. The final replay processed zero additional versions;
generation/passage counts were unchanged and the one publication indexing job remained pending. This used no embedding
provider calls or vector writes. Evidence: `artifacts/regulatory-backfills/passage-preparation-source-replay.json`.
The first run exposed a trailing-newline context mismatch on 142 empty-heading records. Context normalization was aligned,
and only this disposable pilot's preparation checkpoints were reset; all completed passage generations were retained and
reused. The initial diagnostic is retained in `passage-preparation-source-smoke.json`. Source parser summary, staged records,
and published membership all agree on 2,200 records. The earlier narrative count of 2,219 was corrected after checking
both the original annual source pilot and this new database. Existing eCFR imports and embeddings were not regenerated.

Validation: all 36 real PostgreSQL integration tests passed on the final sequential run, including bounded resume,
expired-lease recovery, checkpoint rollback, replay reuse, and inventory tampering. A preceding run overlapped the source
pilot and hit two existing five-second test timeouts; the sequential rerun passed without weakening assertions or timeouts.
Type checks and focused lint passed. Final root `pnpm verify` passed: nine successful tasks in 1m53s. Logs:
`C:/Users/andcra/AppData/Local/Temp/tabra-preparation-serial-tests.log` and `tabra-preparation-verify.log`.
Next are isolated-index copying and acknowledgement, readiness gates, then authenticated API/MCP integration. Full
federal ingestion remains gated on these tasks, source reconciliation, and the final passage-based model comparison.

Persistent canonical passage storage and a version-scoped PostgreSQL lexical canary are implemented in
`passage-storage.ts`, with provision/publication ownership, atomic complete-generation insertion, bounded batches,
concurrent/replay integrity checks, exact inputs and source spans, and a generated English FTS GIN index. Published
source membership and current display/local-search rights are checked before preparation, again at write commit, and
on every lexical lookup. No embedding calls, vector writes, existing freshness changes or outbox acknowledgements occur.

An isolated real-source pilot at port 55442 published the retained 2025 annual CFR title 2 source and prepared sections
200.302, 200.303 and 200.318 with both model tokenizers: six generations, nine passages, six verified replays and six
successful lexical probes. One edition outbox item remains pending as intended. Evidence:
`artifacts/regulatory-backfills/passage-storage-source-smoke.json`. Disposable PostgreSQL regression tests use a separate
new database at port 55441; prior source pilots were not reset. The isolated search copy, outbox/recovery/readiness,
global version selection, embedding jobs, and authenticated API/MCP implementation remain open.
Validation: 54 focused tests passed before the final byte-bounded batching adjustment. The final focused run passed 53
and hit one existing history-replay test's five-second timeout while root coverage was running concurrently; that test
passed in isolation afterward. New passage-storage PostgreSQL tests passed in both runs. Logs:
`C:/Users/andcra/AppData/Local/Temp/tabra-passage-storage-tests.log`, `tabra-passage-storage-final-tests.log`,
`tabra-passage-storage-history-retry.log`. Type checks and focused lint passed. Final root `pnpm verify` passed with nine
successful tasks in 1m43s (`tabra-passage-storage-verify.log`), superseding the earlier unrelated unused-script blocker.

Ordinary table passages now carry explicit source group labels and resolve chained ditto values through exact prior
single-column cell spans. Group changes and empty/missing/spanning cells prevent stale reference reuse. Passage packing
stops when required context differs; original reader text remains unchanged. The retained 100-version / 131-block
sample still passes all 131 blocks with both tokenizers after these context changes. Evidence:
`artifacts/regulatory-backfills/table-passage-context-smoke.json`. Focused tests passed: 37 passage/table/reader tests,
including chained references and refusal to carry a value across a new group. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-table-context-tests.log`. These results are source-layout acceptance for a
bounded sample, not retrieval-quality or full-corpus acceptance. No provider calls or embedding rebuild occurred.
Type checks and focused lint passed. Direct legislation coverage passed: 317 files / 2,996 tests, plus four webhook
receiver tests (database-dependent tests remain skipped without their disposable database setting). Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-table-context-direct-coverage.log`. Root `pnpm verify` is currently blocked
by the unrelated untracked `scripts/inspect-openstates-content.ts` being reported as unused; that file was left intact.
Root log: `C:/Users/andcra/AppData/Local/Temp/tabra-table-context-verify.log`. This supersedes earlier clean root runs
for the current working tree; no current full-repository pass is claimed.

Oversized-row continuations now retain the complete column headings, the other identifying column values, the nearest
explicit spanning group label, and exact source/context spans. Each continuation identifies its complete original row
and long column. The complete prepared input is token-counted and hashed; original text is neither shortened nor replaced.
Ambiguous spanning continuation cells, unresolved ditto values, or identifying context too large for the target still fail.
The same read-only 100-version / 131-block sample now passes for **all 131 blocks with both tokenizers**, including the
three rows previously blocked. Evidence: `artifacts/regulatory-backfills/table-passage-row-continuation-smoke.json`.
The original failures below are retained diagnostic history, not current failures for those three records.
This smoke used local source data and local tokenizers only: no provider requests, persisted vectors, or source mutations.
Focused passage/table/reader tests passed: 36 tests, with long text in each column, Unicode, identifying context and
source group-label preservation, and explicit ditto rejection. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-table-row-continuation-tests.log`. Broader nested/spanning layouts, ordinary
row-group/ditto dependencies across passage boundaries, full-corpus validation, persistent indexing, model retrieval
acceptance, authenticated API/MCP and Trigger backfill/recovery gates remain open. Full embedding regeneration stays deferred.
Final `pnpm verify` passed with nine successful tasks in 1m28s. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-table-row-continuation-verify.log`.

Large-table passage generation now separates actual tables from prose and multiple-table appendix wrappers, preserves
whole data rows, repeats explicit multilevel headers, and records separate source/context spans plus exact input hashes.
Both token and transport-character limits apply. Exponential row-group probes avoid repeatedly tokenizing each growing
prefix. The source reader remains lossless and receives no repeated headers. No embeddings were regenerated.

The retained read-only pilot sampled 100 current-eCFR versions containing 131 source blocks over 6,000 characters.
With both OpenAI Small and Voyage 4 tokenizers, 128 blocks passed exact reconstruction and passage budgets; three blocks
remained blocked by an individual row exceeding the hard budget. The largest passing block was 206,057 characters.
This is a bounded layout smoke, not full-corpus or semantic retrieval acceptance. Evidence:
`artifacts/regulatory-backfills/table-passage-source-final-smoke.json`; initial diagnostic results remain in
`table-passage-source-smoke.json`. The blocked version/source-ordinal pairs are
`0dba3f46-e0e3-4664-880f-bb0d6226da55 / 2`, `133a26fa-00cf-4f76-82f5-e3c6ceb56948 / 197`, and
`194b31a5-b7fb-432b-8cf1-02beb72e0776 / 2`. They contain long ingredient/commodity/citation rows; no row was silently cut.
Nested tables, spanning data cells, row-group labels/ditto references, and individually oversized rows still need
broader source-layout and semantic acceptance before the full passage backfill. Focused passage/table/reader tests:
32 passed (`C:/Users/andcra/AppData/Local/Temp/tabra-table-passages-tests.log`).
Full `pnpm verify` passed: nine successful tasks, 1m34s; retained log
`C:/Users/andcra/AppData/Local/Temp/tabra-table-passage-verify.log`. No production deployment or full ingestion was started.

Shared embedding integrity repair: the client now rejects over-limit inputs and provider size errors without truncating
or retrying shorter text. Exact request bodies remain stable across transient retries. Added pinned model tokenizers,
per-input/per-batch token guards, and a shared lossless prose splitter consumed by regulatory passages. The user approved
this shared preparation work and explicitly deferred regenerating all existing embeddings. No freshness contract was
bumped, vectors deleted, production rollout dispatched, or existing embeddings regenerated. The remote read-only audit
confirmed there is no persisted shortened-retry flag; affected counts remain unknown. Full rebuild preparation is tracked
in [embedding rollout](../engineering/embedding-rollout-plan.md#input-integrity-repair-and-deferred-rebuild-september-15-2026).

Tokenizer verification: 33 focused tests passed, including exact text/Unicode preservation, 21 Voyage Rust-reference
cases, token-dense input/batch rejection, and no persistence after provider rejection. Synthetic OpenRouter checks matched
OpenAI usage exactly; Voyage reported one fewer token per input than both local and Rust-reference counters. This remains
an explicit provider-accounting discrepancy in `embedding-input-integrity-smoke.json`, not a change to the tokenizer.
Final tokenizer implementation passed full `pnpm verify` (nine successful coverage tasks, 3m9s), service compilation,
and loading/counting with both tokenizers from compiled output. Logs:
`C:/Users/andcra/AppData/Local/Temp/tabra-embedding-tokenizer-verify.log`,
`tabra-embedding-final-tokenizer-tests.log`, `tabra-embedding-final-build.log`. Production deployment remains pending.

Annual CFR publication is implemented with a frozen title-volume denominator, revision-date agreement, duplicate-provision
checks, and atomic fenced publication/outbox insertion. The unreleased baseline now includes annual title/volume grouping.
Real local pilot at port 55440 published 2025 title 2 (one volume, 2,200 records, printed revision 2025-01-01) and replayed
without duplicates. Evidence: `annual-title2-publication*.json`. Title 5 has three acquired volumes; volume 2 nests 1,647
section elements under quoted replacement text. The parser now retains replacement text in its owning provision and flags
extensive quoted structure for review. Title 5 remains unpublished with volume 2 blocked as `quoted_revision_scope_review`.
Evidence: `annual-title5-publication-*`, final parser report under its normalized directory. No publisher-year date repair
was invented. Synthetic two-volume PostgreSQL tests verify missing-volume refusal, whole-title replay, cross-volume duplicate
rejection and conflicting-date refusal. This closes the annual writer implementation, not all federal source reconciliation.

No active regulatory jobs were found. Implemented persistent local embedding reuse for the diagnostic command through
`--cache`. Keys bind exact inputs and model/dimension/input-contract/query-mode settings. Entries are immutable and
atomically retained; corrupt keys/vector checksums and mismatched provider models fail without paid fallback. Same-request input
duplicates are embedded once and restored to caller order. Cache hits and new token usage are reported separately.
This is diagnostic storage, not production rights enforcement or canonical vector persistence.

Verified a live fill using the retained 12-document/12-query smoke set, followed by a replay with network fetching
deliberately disabled. Both models returned 24 cache hits, zero requests/batches/new tokens, and byte-identical ranking
reports. A fresh fill/replay also verified vector checksums, which detect otherwise valid numeric corruption. Evidence:
`regulatory-cache-smoke-manifest.json`, `regulatory-cache-checksummed-fill.json`,
`regulatory-cache-checksummed-replay.json`, `regulatory-embedding-cache-checksummed/`. Nine focused tests passed.
Final checksum implementation passed full `pnpm verify` (nine successful coverage tasks, 1m21s).
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-cache-checksum-verify.log`. The full 350-document
benchmark was not repeated. Earlier cache artifacts lack checksums and are historical evidence only.

The idle-work check found no active regulatory jobs. Implemented a reusable blind relevance-review pool and CLI,
`pool:regulatory-judgments`, with complete-system/query coverage checks, candidate identity validation, exact source
version/input hashes, deterministic rank-blind ordering, and blank human grades/rationales. It pools competing answers
without changing the frozen labels or revealing model/ranking names in the candidate view. The real benchmark produced
60 question packets and 1,315 candidate excerpts across seven configurations; no external API calls were made. Evidence:
`regulatory-review-systems.json` and `regulatory-judgment-review.json` under `artifacts/regulatory-backfills/`.
Focused tests and service TypeScript passed. Full `pnpm verify` passed, with nine successful coverage tasks (1m30s).
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-judgment-pool-verify.log`. Human review is still incomplete.

Expanded the embedding diagnostic from 12 easy questions to a frozen 350-excerpt corpus and 60 queries across 12 eCFR
parts, with 30 development and 30 held-out questions split by regulatory title before execution. Both configured models
completed the run and an unchanged held-out repeat. Voyage's held-out Recall@5/nDCG@10 were 1.000/0.959; OpenAI Small's
were 0.933/0.857. Each model also completed 60 Cohere reranking calls; their held-out aggregates tied at 0.967/0.965.
All semantic Recall@25 scores were 1. This is provisional evidence, not model promotion: single-known-answer labels
are not exhaustive human judgments, and source review found an additional correct municipal-waste answer. Frozen labels
were not changed after scoring. Full details and limitations are in [search indexing](search-indexing.md#local-comparison-evidence-september-15).

Implemented the reusable `smoke:regulatory-embeddings` CLI with preview/live modes, frozen manifest hash, split selection,
exclusive output reservation before paid calls, and up to 512 inputs submitted in bounded 64-record batches. The shared
OpenRouter embedding client now rejects duplicate/skipped/out-of-range response indices even when counts and dimensions
match. No production route or canonical vectors changed. Source excerpts are not final tokenized passages; storage reuse,
historical/proposal/state cohorts, exhaustive relevance review and deployed API/MCP canaries remain open.

Annual CFR date disposition now links exact 2024/2025 title-1 volume-1 copies to the unique verified 2023 source
observation. It requires matching title/volume/hash/printed date and rejects ambiguous or cross-title anchors. Fresh
parsing and audit confirmed both duplicate observations. Later package years remain uncovered; no later legal-currency
date was invented, and the annual publication gate remains closed. This classifies the defect but does not implement
the multi-volume annual canonical writer.

Focused checks passed 17 tests, scoped lint and service TypeScript. Full `pnpm verify` passed (nine successful coverage
tasks; coverage phase 1m31s). Log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-comparison-verify.log`.
Evidence lives under `artifacts/regulatory-backfills/` with the `regulatory-comparison-*` prefix and
`annual-title1-revision-dispositions.json`. The initial lexical scoring result is invalid because of SQL regex escaping;
only `regulatory-comparison-corrected-results.json` is used for lexical/hybrid conclusions. No additional model requests
were made to repair lexical scoring.

Persistent HTML subject-conflict quarantine is implemented. Acquisition is separated from parsing so conflicting raw
evidence remains available. The loader catches only the typed `FrHtmlSubjectMismatch`; operational failures and other
validation errors still abort. Every metadata record must appear exactly once in the verified/quarantined partition.
The partition and parser dependency hash bind import generation identity. Registration retains raw artifact references,
quarantine evidence and coverage in the generation summary; publication retains the same report in batch reconciliation.
Only verified records create canonical documents and lexical outbox jobs. Even a fully quarantined day can retain a
report with zero publications. The unreleased baseline permits zero expected records only for the HTML import contract;
XML edition/issue validation retains its positive-record requirement. Existing pilot schemas were not migrated in place.

Real January 18 replay: 109 supported metadata identities, 108 verified, one quarantined (`00-113`), and
`issueInventoryVerified: false`. An initial smoke imported 108 into the consolidated local pilot at port 55438, bringing
that pilot's FR document count from 75 to 183. Final-code verification uses the separate `tabra-fr-quarantine-pilot`
at port 55439 with the updated migration baseline: **108 documents, 108 versions, 108 observations, 108 outbox rows**
after publication and replay (`reused: true`). These 108 are the same source records as the earlier smoke; do not add
them twice when counting coverage. No disputed record was published. Generation:
`b78b8df12842010631e21c425503fa0b4abd5106d839fc7eca95f04e999969f3`.

Evidence: `fr-jan18-quarantine-inputs.json`, `fr-jan18-quarantine-stage.json`, `fr-jan18-quarantine-publish.json`,
`fr-jan18-quarantine-final-stage.json`, `fr-jan18-quarantine-final-publish.json`,
`fr-jan18-quarantine-final-replay.json` and hash-addressed `fr-jan18-imports/` under `artifacts/regulatory-backfills/`.
Final storage verification passed all 28 real-PostgreSQL tests, including mixed/fully quarantined batches, rollback and
idempotent replay. HTML/input checks passed 12 tests. Scoped lint and service TypeScript checks passed. The disposable
test container was stopped. Root `pnpm verify`
is blocked by five unrelated Open States lint failures in `scraper-alaska-batches.test.ts` and `scraper-normalize.ts`;
full coverage did not run. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-fr-quarantine-verify.log`.

Remaining work is explicit: ingest/persist the full issue's distinct source-location observations, reconcile all 110
publications rather than 109 metadata identities, and implement reviewed citation identity before resolving 00-113.
This quarantine slice does not close annual date handling, model comparison, full-issue completeness or search readiness.

January 18, 2000 alternate-rendition investigation recovered all 109 metadata-listed HTML files and 109 PDFs (383
validated PDF pages). It exposed a cross-rendition identity defect: metadata for 00-113 has the Minnesota notice's
title/pages but type `Rule`; HTML has the Hobbs airspace rule's body with a header claiming page 2639. Matching only
number/date/type/pages would have attached the wrong body. No January 18 canonical publication was performed. The raw
issue contains 110 supported records versus 109 metadata identities; individual download completion is not issue completeness.

`fr-html.ts` now requires the metadata subject in the rendition's subject area before AGENCY/ACTION/SUMMARY (or the bounded
leading area for other formats). `fr-subject.ts` compares publisher TeX/curly quotes, dash typography and hyphenated line
wrapping without rewriting retained text. New checks initially flagged ten records; nine were verified typography
differences. Normalized comparison then passed **108/109**, rejecting only 00-113 with `fr_html_subject_mismatch`.
All **75/75** earlier January 3 HTML records passed the stricter check. The parser hash changed: older reports remain
historical evidence, not current-parser publication approval.

`fr-identity-resolution.ts` adds a pure collision plan retaining artifact/locator-bound observations, distinct citation
keys and an explicitly ambiguous number alias. Metadata matching requires title/kind/page agreement. Duplicate citations
cannot be resolved with arbitrary suffixes or input order. Real evidence isolates `/FEDREG[1]/RULES[1]/RULE[5]`
(Hobbs, 65 FR 2537–2538) and `/FEDREG[1]/NOTICES[1]/NOTICE[62]` (Minnesota, 65 FR 2639). Neither matches all fields of
the mixed metadata record; both remain unresolved and publication-disabled. This planning foundation does not yet replace
canonical document-number identity or the strict whole-issue parser. Next: evidence-bound per-record quarantine and
citation-identity publication, so unaffected documents can publish without dropping the extra source record.

Evidence under `artifacts/regulatory-backfills/`: `fr-2000-jan18-html/`, `fr-2000-jan18-html-report.json` (old checks),
`fr-2000-jan18-pdfs/`, `fr-2000-jan18-pdf-report.json`, `fr-2000-jan18-pdf-validation.json`,
`fr-2000-jan18-subject-replay.json` (typography failures), `fr-2000-jan18-subject-normalized-replay.json`,
`fr-2000-early-subject-replay.json`, `extract-fr-identity-evidence.py`, `fr-jan18-identity-evidence.json`,
`resolve-fr-jan18-collision.ts` and `fr-jan18-collision-plan.json`. The diagnostic extractor found two empty PRTPAGE markers
and retains unknown page values instead of guessing; it is not a production parser replacement.

Focused verification passed: 41 tests across HTML parsing, publication inputs, collision planning and real-PostgreSQL
storage integration. A lint repair in the collision planner passed its three-test rerun; scoped lint and service
TypeScript checks passed. Root `pnpm verify` was attempted twice: the retry is blocked by an unrelated nested ternary
in `src/ingestion/openstates/scraper-normalize.ts` (line 281 in that snapshot). Full coverage did not run. Logs are
`C:/Users/andcra/AppData/Local/Temp/tabra-fr-subject-verification.log` and
`C:/Users/andcra/AppData/Local/Temp/tabra-fr-subject-verify-retry-20260915.log`. The isolated test container was stopped.
Annual source-date dispositions, the larger model comparison and full-ingestion gates remain open. Current eCFR data
and prior FR publications were not modified.

The user reprioritized full-ingestion blockers: model comparison, annual source-date remediation and missing/duplicate
FR resolution. The existing 10-minute follow-up now explicitly prioritizes these tasks instead of repeating completed
current-title backfills. None of these broader gates is closed merely by the following diagnostic successes.

`embedding-smoke.ts` implements a bounded comparison through the existing embedding client: identical validated inputs,
one attempt (preventing the client's oversized-input shortening retry), explicit document/query modes, dimension/finite/
nonzero vector checks, exact-version rankings and retained input hash. Three tests cover paired modes/version retrieval,
oversized input and invalid judgments, wrong dimensions, and no shortening retry. No production model is selected.

Live diagnostic: 12 explicit source excerpts and 12 provisional agent-authored topical queries, OpenAI Small/1,536 and
Voyage 4/1,024 dimensions. Both achieved Recall@5=1 and nDCG@10=1 on this small easy diagnostic. OpenAI reported 4,086
tokens and 2,937 ms total document/query latency; Voyage reported 4,291 tokens and 1,243 ms. These single-run totals are
not latency percentiles or a quality winner. Evidence under `artifacts/regulatory-backfills/`:
`run-regulatory-model-smoke.ts`, `regulatory-model-smoke-manifest.json`, `regulatory-model-smoke-results.json`.
After removing whitespace transformation from the input schema, a repeat against the same retained source inputs
again achieved Recall@5=1 and nDCG@10=1 for both models. Exact-input evidence:
`replay-regulatory-model-smoke.ts` and `regulatory-model-smoke-exact-input-results.json`. OpenAI: 4,086 tokens/2,572 ms;
Voyage: 4,291 tokens/714 ms. This repeats network calls and is not a persistent embedding-reuse test.
Inputs are explicitly bounded excerpts with offsets/body hashes, not complete production passages. The 60-query minimum,
hard negatives, development/held-out split, human relevance review, lexical/hybrid/reranking comparison, cost accounting,
reuse and deployed API/MCP confirmation remain required before bulk embeddings. No canonical vectors were written.

Fresh source investigation confirmed the Jan 18, 2000 duplicate is present in the official printed issue itself:
[GovInfo full issue PDF](https://www.govinfo.gov/content/pkg/FR-2000-01-18/pdf/FR-2000-01-18.pdf), PDF pages 25 and 126
(one-based), prints FR Doc. 00-113 for both the Hobbs airspace rule (65 FR 2537–2538) and a Minnesota land notice.
This is not solely an XML parsing defect. The remediation must preserve distinct citation/source-location identities
and the disputed publisher-number alias; it must not guess a corrected number, merge the records or discard one.
Existing strict duplicate publication gates remain in place until that identity/reconciliation path is implemented.

The [official 2024 title 1 HTML](https://www.govinfo.gov/content/pkg/CFR-2024-title1-vol1/html/CFR-2024-title1-vol1.htm)
likewise labels its wrapper 2024 while the title page and scope statement specify January 1, 2023. Preserve these as
separate publisher assertions; package year alone cannot establish later currency. [GovInfo CFR help](https://www.govinfo.gov/help/cfr)
also explicitly documents an unrelated 2007 title 49 volume 6 printed-header error, demonstrating why resolutions need
specific publisher evidence rather than a blanket rule. No correction notice resolving the title 1 conflict was verified.
Implement evidence-backed ingestion/coverage dispositions so retained conflicting source observations need not prevent
unrelated imports; do not advertise the conflicting package as a verified later point-in-time edition.

Three focused tests, scoped lint and service TypeScript checks passed. Initial root verification failed on unrelated
curly-brace lint errors in Open States and bill batch ownership files; those files were not changed. Final root retry
also failed at lint, log `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-model-smoke-verify-retry.log`.
No command from this slice remains active. This is not a clean repository-wide verification gate.
All broader blocker-remediation tasks remain active.

The first lexical-passage foundation is implemented in `src/ingestion/regulations/passages.ts`. It validates source-reader
hashes and contiguous offsets, produces deterministic version/context/tokenizer-bound IDs, counts prefixed input against
explicit tokenizer budgets, and maps each passage back to exact reader-block spans. It preserves Unicode/source text,
classifies empty bodies separately, and keeps fitting tables intact. Oversized tables explicitly block the generation
until row/header segmentation exists. SEARCH-01 remains partial; no outbox job has been consumed and no index is searchable.

Six focused tests passed: exact reconstruction/spans/budgets, identity invalidation, intact/oversized tables including
reader-split tables, corrupt input/invalid tokenizer rejection, empty/repeal eligibility, and astral-character boundaries.
A read-only smoke against 200 canonical section versions (50 each from titles 1/7/21/40) produced 1,068 passages with
exact reconstruction, no budget violations and zero oversized-table blockers in that sample. The smoke deliberately used
UTF-8 byte counts as a named test budget, **not a model tokenizer or model-quality evaluation**. No embedding calls or
database writes occurred. Evidence: `artifacts/regulatory-backfills/smoke-passage-foundation.ts` and
`artifacts/regulatory-backfills/passage-foundation-smoke.json`.

Root `pnpm verify` passed after correcting a focused test's explicit-exception lint requirement; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-passage-foundation-verify-retry.log`. No command from this slice remains active.
Next: row/header-aware table splitting, selected-model tokenizer adapters and
bounded canonical passage/outbox projection. The embedding comparison remains mandatory before bulk embeddings;
recurring regulatory source schedules stay disabled. Current consolidated coverage remains 49 titles/275,149 members.

The current eCFR corpus is now consolidated in the port 55438 pilot: **49 non-reserved titles and 275,149 members**.
Titles 1/21/40 were imported from retained raw artifacts and the current-parser regression output, without new downloads,
database copying, schema changes or code changes. All three published and final replay reused the same editions and
generations. The original port 55434 pilot remains intact but must not be added to the consolidated coverage total.
LIVE-02 is complete for this frozen current local scope; broader foundation, historical, indexing and release gates remain open.

Source: `federal-pilot-2026-09-14.json`, raw `raw/`, normalized `historical-parser-regression/`, importer `--limit 3`.
That manifest also contains annual CFR and FR units, deliberately outside this consolidation command; its report's two
pending units are those unselected corpora, not missing current eCFR titles. Existing historical/source blockers remain.

The first attempt published titles 1 and 21 but title 40 hit SQLSTATE 57014 under the unchanged 60-second statement
timeout. Its 30,310 records were fully staged, with no edition members yet. A subsequent EXPLAIN ANALYZE of the staging
parent-validation query completed in 64.594 ms using a parallel hash join. The timeout was not reproduced and its exact
cause remains unproven. Resume passed without increasing timeouts or weakening checks; a final replay reused all three
editions. Preserve this failure as a throughput/recovery observation for profiling before large historical waves.

Independent SQL compared all 275,149 stored bodies/headings/blocks against staging with zero mismatches. There are 49
heads, 49 pending edition projection jobs and no active leases. The 75 FR publications and their identity digest are
unchanged. Single-database inventory reconciliation found no missing, unexpected or duplicate title keys; reserved title
35 is excluded. This is consolidated current eCFR source coverage, not full historical coverage or production search.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-consolidation-import.json` (initial failure),
`ecfr-consolidation-resume.json`, `ecfr-consolidation-replay.json`, `ecfr-consolidation-integrity.json` and
`ecfr-consolidated-title-coverage.json`. Root `pnpm verify` passed; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-ecfr-consolidation-verify.log`. No command from this slice remains active.
Next dependency-ready work is lexical
projection implementation, with historical-source work continuing independently. Embedding model comparison remains
mandatory before bulk embeddings; recurring source schedules remain disabled and API/MCP delivery remains pending.

The final missing current eCFR titles, 3 and 7, completed acquisition, parsing and canonical import without warnings or
failures. Replay reused both editions and generations. No code changes were needed. Raw XML totals 40,683,555 bytes.
Manifest: `artifacts/regulatory-backfills/ecfr-president-agriculture-2026-09-14.json`, ID
`72c22febaefd8f459646e99b1a4f548eed3237433a37e9df47510a8ce9593322`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 3 | 33 | 27 | 2024-05-17 | 2026-09-11 |
| 7 | 20,552 | 17,205 | 2026-09-09 | 2026-09-11 |

This adds 20,585 section/structural records, including 17,232 sections. The port 55438 pilot now contains 234,708 members
across 46 title heads and 46 pending edition projection jobs. Independent SQL compared every body, heading and block to
staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are unchanged.

Live inventory reconciliation across this pilot and the older port 55434 pilot verified all **49 non-reserved current
eCFR titles**, **275,149 members**, no missing/unexpected/duplicate titles, and reserved title 35 excluded. The older
pilot holds 40,441 members for titles 1/21/40. Both pilots' title currency dates are September 11. This is a complete
title inventory for the frozen current eCFR scope across two local databases, not consolidated storage, full historical
edition coverage, complete federal regulatory data, executive-order coverage, or production search availability.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-president-agriculture-raw/`,
`ecfr-president-agriculture-normalized/`, `ecfr-president-agriculture-import.json`,
`ecfr-president-agriculture-replay.json`, `ecfr-president-agriculture-integrity.json` and
`ecfr-current-title-coverage.json`. The inventory report initially hit PowerShell line-by-line JSON decoding; joining
the returned JSON lines corrected the report step, and the subsequent complete inventory gate passed.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-president-agriculture-verify.log`. No command from
this slice remains active. Next: consolidate the current corpus through the existing validated importer,
implement lexical projections, and continue unresolved historical-source work. Recurring source schedules remain
disabled, and the required embedding comparison must precede bulk embeddings. API/MCP delivery remains pending.

The frozen eCFR wave for titles 46–50 completed without code changes. All five acquisitions, parses and canonical
imports succeeded without warnings or failures. Replay reused every edition and generation. Raw XML totals 117,956,550 bytes. Manifest:
`artifacts/regulatory-backfills/ecfr-transport-wildlife-2026-09-14.json`, ID
`eff7a280efa72b3dbe3a3aab060219b1bc1ce72e6ef4db7b6c19f58cb4d9e561`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 46 | 10,206 | 8,430 | 2026-09-01 | 2026-09-11 |
| 47 | 5,995 | 5,178 | 2026-09-11 | 2026-09-11 |
| 48 | 15,073 | 11,550 | 2026-09-01 | 2026-09-11 |
| 49 | 10,789 | 8,998 | 2026-09-11 | 2026-09-11 |
| 50 | 3,943 | 3,213 | 2026-09-11 | 2026-09-11 |

This adds 46,006 section/structural records, including 37,369 sections. The port 55438 pilot now contains 214,123 members
across 44 title heads and 44 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are
unchanged. Titles 1/21/40 remain in the separate port 55434 pilot; titles 3 and 7 remain to backfill. These current local
imports do not establish full historical edition coverage or production search availability.

Title 49 materialization took longer than earlier titles; live database inspection showed active short membership-write
batches and no reported lock wait. It completed successfully. Preserve this observation for throughput profiling before
larger historical waves rather than treating successful replay as a performance benchmark.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-transport-wildlife-raw/`, `ecfr-transport-wildlife-normalized/`,
`ecfr-transport-wildlife-import.json`, `ecfr-transport-wildlife-replay.json` and `ecfr-transport-wildlife-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-transport-wildlife-verify.log`. No command from
this slice remains active. Continue titles 3/7 and lexical projection implementation. Recurring source schedules
stay disabled, and the required embedding comparison must precede bulk embeddings.

The frozen eCFR wave for titles 41–45 completed without code changes. All five acquisitions, parses and canonical
imports succeeded without warnings or failures; replay reused all editions and generations. Raw XML totals 52,007,882
bytes. Manifest: `artifacts/regulatory-backfills/ecfr-health-welfare-2026-09-14.json`, ID
`d84dc48aecc9a909f45afb58e648660eaf5c9a4d0372bd44031b638d7d846b8d`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 41 | 3,848 | 3,094 | 2026-08-31 | 2026-09-11 |
| 42 | 8,547 | 7,290 | 2026-08-13 | 2026-09-11 |
| 43 | 6,517 | 5,436 | 2026-08-12 | 2026-09-11 |
| 44 | 1,160 | 943 | 2026-06-22 | 2026-09-11 |
| 45 | 7,015 | 5,809 | 2026-08-31 | 2026-09-11 |

This adds 27,087 section/structural records, including 22,572 sections. The port 55438 pilot now contains 168,117 members
across 39 title heads and 39 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are
unchanged. Titles 1/21/40 remain in the separate port 55434 pilot. Titles 3, 7 and 46–50 remain to backfill. Current local
imports do not establish full historical edition coverage or production search availability.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-health-welfare-raw/`, `ecfr-health-welfare-normalized/`,
`ecfr-health-welfare-import.json`, `ecfr-health-welfare-replay.json` and `ecfr-health-welfare-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-health-welfare-verify.log`. No command from this
slice remains active. Continue the remaining frozen titles and lexical projection implementation.
Recurring source schedules stay disabled, and the required embedding comparison must precede bulk embeddings.

The frozen wave for eCFR titles 32–34 and 36–39 completed without code changes. All seven acquisitions, parses and
canonical imports succeeded without warnings or failures; replay reused every edition and generation. Title 35 is
reserved and is not part of this requested scope. Raw XML totals 58,406,984 bytes. Manifest:
`artifacts/regulatory-backfills/ecfr-defense-education-2026-09-14.json`, ID
`c5febb307fce868e7c42db27412bb0ac372daa67dc0f866e36b81a50082123a4`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 32 | 4,473 | 3,640 | 2026-08-17 | 2026-09-11 |
| 33 | 5,388 | 4,649 | 2026-09-10 | 2026-09-11 |
| 34 | 4,045 | 3,259 | 2026-09-09 | 2026-09-11 |
| 36 | 3,717 | 3,135 | 2026-09-11 | 2026-09-11 |
| 37 | 1,627 | 1,331 | 2026-08-26 | 2026-09-11 |
| 38 | 3,506 | 2,953 | 2026-08-27 | 2026-09-11 |
| 39 | 1,350 | 1,137 | 2026-06-12 | 2026-09-11 |

This adds 24,106 section/structural records, including 20,104 sections. The port 55438 pilot now contains 141,030 members
across 34 title heads and 34 pending edition projection jobs. Independent SQL compared every body, heading and block to
staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest are unchanged.
Titles 1/21/40 remain in the separate port 55434 pilot. Current eCFR coverage is still partial and local; titles 3, 7 and
41–50 remain to backfill. These imports do not establish historical edition coverage or production search availability.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-defense-education-raw/`, `ecfr-defense-education-normalized/`,
`ecfr-defense-education-import.json`, `ecfr-defense-education-replay.json` and `ecfr-defense-education-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-defense-education-verify.log`. No command from
this slice remains active. Continue the remaining frozen titles and lexical projection implementation;
recurring source schedules stay disabled and embedding comparison remains required before bulk embeddings.

The frozen wave for eCFR titles 27–31 completed without code changes. All acquisitions, parses and canonical imports
succeeded without warnings or failures; replay reused all five editions and generations. Raw XML totals 66,549,204
bytes. Manifest: `artifacts/regulatory-backfills/ecfr-labor-treasury-2026-09-14.json`, ID
`c0ee31ac74640c8625f397a74119e234a9fe6df9d9facbc15baf004dcf106825`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 27 | 4,874 | 3,952 | 2026-08-17 | 2026-09-11 |
| 28 | 3,758 | 3,071 | 2026-09-10 | 2026-09-11 |
| 29 | 8,847 | 7,271 | 2026-09-09 | 2026-09-11 |
| 30 | 6,942 | 5,954 | 2026-09-10 | 2026-09-11 |
| 31 | 6,513 | 5,442 | 2026-09-10 | 2026-09-11 |

This adds 30,934 section/structural records, including 25,690 sections. The port 55438 pilot now contains 116,924 members
across 27 title heads and 27 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain; the 75 FR publications and their identity digest remain
unchanged. Titles 1/21/40 remain in the separate port 55434 pilot. These are local canonical backfills, not searchable
production coverage.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-labor-treasury-raw/`, `ecfr-labor-treasury-normalized/`,
`ecfr-labor-treasury-import.json`, `ecfr-labor-treasury-replay.json` and `ecfr-labor-treasury-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-labor-treasury-verify.log`. No command from this
slice remains active. Continue remaining frozen titles and lexical projection implementation. Recurring
source schedules remain disabled, and the required embedding comparison must precede bulk embeddings.

The frozen eCFR wave for titles 22–26 completed without code changes. All five acquisitions, parses and canonical
imports succeeded without warnings or failures, and replay reused every edition and generation. Raw XML totals
115,569,281 bytes, including the 87,254,727-byte Internal Revenue title. Manifest:
`artifacts/regulatory-backfills/ecfr-housing-tax-2026-09-14.json`, ID
`f7fdc2138257f62a99fb5708b814f63fe0607399f31f86a75bc1402e0e250352`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 22 | 4,086 | 3,408 | 2026-09-11 | 2026-09-11 |
| 23 | 1,237 | 987 | 2026-09-11 | 2026-09-11 |
| 24 | 5,843 | 4,877 | 2026-08-20 | 2026-09-11 |
| 25 | 5,522 | 4,747 | 2025-12-01 | 2026-09-11 |
| 26 | 6,595 | 6,158 | 2026-09-08 | 2026-09-11 |

This adds 23,283 section/structural records, including 20,177 sections. The port 55438 pilot now contains 85,990 members
across 22 title heads and 22 pending edition projection jobs. Independent SQL compared all bodies/headings/blocks to
staging with zero mismatches. No active leases remain, and the 75 FR publications and their identity digest are unchanged.
The older titles 1/21/40 remain in the separate port 55434 pilot. These local imports are not yet searchable production
coverage. Title 25's older issue date is retained separately from the publisher's September 11 currency date.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-housing-tax-raw/`, `ecfr-housing-tax-normalized/`,
`ecfr-housing-tax-import.json`, `ecfr-housing-tax-replay.json` and `ecfr-housing-tax-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-housing-tax-verify.log`. No command from this
slice remains active. Continue the remaining frozen title imports and lexical projection
implementation. The embedding comparison remains mandatory before bulk embeddings; recurring source schedules stay off.

The frozen eCFR wave for titles 17–20 completed using the existing pipeline, without code changes. Acquisition and
parsing succeeded without warnings; all four imports published and replay reused the same editions and generations.
Raw XML totals 50,107,693 bytes. Manifest: `artifacts/regulatory-backfills/ecfr-finance-labor-2026-09-14.json`, ID
`0579da64f0a933b13e6ee05d190b3da12690f483c82193e5cc1df36fbee5a55c`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 17 | 4,117 | 3,525 | 2026-09-08 | 2026-09-11 |
| 18 | 2,486 | 2,048 | 2026-08-24 | 2026-09-11 |
| 19 | 3,840 | 3,172 | 2026-08-26 | 2026-09-11 |
| 20 | 6,706 | 5,635 | 2026-09-09 | 2026-09-11 |

This adds 17,149 section/structural records, including 14,380 sections. The port 55438 pilot now has 62,707 eCFR members
across 17 title heads and 17 pending edition projection jobs. Independent SQL compared every body, heading and block
against staging with zero mismatches. No active leases remain. The 75 FR publications and their observation/version
identity digest remain unchanged. Titles 1/21/40 remain in the separate port 55434 pilot; these are local backfill
results, not consolidated national coverage or a searchable production release.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-finance-labor-raw/`, `ecfr-finance-labor-normalized/`,
`ecfr-finance-labor-import.json`, `ecfr-finance-labor-replay.json` and `ecfr-finance-labor-integrity.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-finance-labor-verify.log`. No command from this
slice remains active. Remaining work includes frozen title backfills, lexical projections,
the required embedding model comparison before bulk embeddings, and public API/MCP implementation. Recurring source
ingestion remains disabled; the 10-minute continuation remains active.

The next frozen wave imported eCFR titles 11, 13, 14, 15 and 16 without code changes. All downloads, parses and imports
succeeded without warnings or failures. Raw XML totals 42,040,552 bytes. Manifest:
`artifacts/regulatory-backfills/ecfr-business-transport-2026-09-14.json`, ID
`a44419cfbb6319f662489c04fe8420b878407794128623a3d861aa3ecc962409`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 11 | 675 | 587 | 2026-06-08 | 2026-09-11 |
| 13 | 2,082 | 1,707 | 2026-09-10 | 2026-09-11 |
| 14 | 7,638 | 6,363 | 2026-09-11 | 2026-09-11 |
| 15 | 2,884 | 2,237 | 2026-08-28 | 2026-09-11 |
| 16 | 2,750 | 2,158 | 2026-08-31 | 2026-09-11 |

This adds 16,029 section/structural records, including 13,052 section records. Replay reused all five editions. The
port 55438 pilot now contains 45,558 eCFR members across 13 heads, 13 pending edition projection jobs and the unchanged
75 FR publications. Independent SQL compared all 45,558 bodies/headings/blocks with staging and found zero mismatches;
no active leases remain. Older titles 1/21/40 remain in the separate port 55434 pilot.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-business-transport-raw/`, `ecfr-business-transport-normalized/`,
`ecfr-business-transport-import.json`, `ecfr-business-transport-replay.json` and `ecfr-business-transport-integrity.json`.
Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/tabra-business-transport-verify.log`; the prior unrelated
Open States lint blocker no longer prevents verification. No command from this slice remains active. Continue frozen
title backfills and lexical projection work; the 10-minute follow-up stays active and recurring source ingestion stays off.

The next frozen eCFR wave added titles 4, 6, 8, 9 and 10 using the existing pipeline, without code changes. All five
downloads/parses/imports succeeded without warnings, blockers or import failures. Raw XML totals 35,979,594 bytes.
Manifest: `artifacts/regulatory-backfills/ecfr-additional-titles-2026-09-14.json`, ID
`53ca6721aac1902e5297e746bef70ab90ab02606b1d24949a402745acf950e00`.

| Title | Canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 4 | 271 | 222 | 2024-07-18 | 2026-09-11 |
| 6 | 707 | 584 | 2026-08-12 | 2026-09-11 |
| 8 | 1,192 | 989 | 2026-09-09 | 2026-09-11 |
| 9 | 2,900 | 2,440 | 2026-08-19 | 2026-09-11 |
| 10 | 6,488 | 5,265 | 2026-09-09 | 2026-09-11 |

This wave adds 11,558 section/structural records, including 9,500 section records. Replay reused all five canonical
editions. The port 55438 pilot now contains 29,529 eCFR members across eight title heads, eight pending edition jobs,
and the unchanged 75 FR publications. Independent SQL compared all 29,529 bodies/headings/blocks with staging and
found zero mismatches; no active leases remain. The older titles 1/21/40 remain in the separate port 55434 pilot.

Evidence under `artifacts/regulatory-backfills/`: `ecfr-additional-raw/`, `ecfr-additional-normalized/`,
`ecfr-additional-import.json`, `ecfr-additional-import-replay.json` and `ecfr-additional-integrity.json`.
`pnpm verify` was attempted but failed on unrelated `no-unsafe-finally` lint errors in
`src/ingestion/openstates/scraper-docker.ts`; that separate work was not changed. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-ecfr-additional-verify.log`. Do not treat this as a clean repository-wide gate.
The source/import/replay/integrity checks for this data slice passed. No command remains active from this slice;
the 10-minute continuation stays active, and recurring regulatory ingestion remains disabled.

The frozen eCFR expansion added titles 2, 5 and 12 using the existing acquisition, parser and canonical import pipeline.
All three downloads and parses succeeded without warnings. The new raw XML totals 53,691,217 bytes. No code change was
needed for this slice. Manifest: `artifacts/regulatory-backfills/ecfr-expansion-2026-09-14.json`, ID
`3a82510cb9c835e6627803a86270da626794aab2a4b808adc3bce9eaa506d921`.

| Title | Parsed/canonical members | Section records | Source issue date | Publisher currency date |
| --- | ---: | ---: | --- | --- |
| 2 | 2,273 | 1,522 | 2026-08-18 | 2026-09-11 |
| 5 | 6,834 | 5,382 | 2026-09-03 | 2026-09-11 |
| 12 | 8,864 | 7,180 | 2026-09-08 | 2026-09-11 |

These are 17,971 section/structural records, including 14,084 section records, not 17,971 distinct regulations.
All three editions are canonical/current within the local port 55438 pilot, alongside the 75 historical FR documents.
Replay reused the same generations/edition IDs. Independent SQL compared all 17,971 bodies, headings and block payloads
with staging and found zero mismatches; the FR observation/version ID digest is unchanged. There are three pending
edition projection jobs and no active leases. Search execution and embeddings remain pending.

Evidence: `ecfr-expansion-raw/`, `ecfr-expansion-normalized/`, `ecfr-expansion-import.json`,
`ecfr-expansion-import-replay.json` and `ecfr-expansion-integrity.json` under `artifacts/regulatory-backfills/`.
The older titles 1/21/40 pilot remains separate on port 55434; this is not yet a consolidated national dataset.
Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/tabra-ecfr-expansion-verify.log`.
No command from this slice remains active. Continue the remaining frozen title waves and lexical projection work;
the 10-minute follow-up stays active and recurring source ingestion stays disabled.

Canonical HTML publication is implemented in `fr-html-publication.ts` and `publish:fr-html-publications`. Both HTML
and XML adapters now reuse `fr-publication-write.ts` for canonical documents, versions, observations and lexical outbox
rows. HTML retains its preformatted source contract and source URL; titles stay in observation metadata and no semantic
heading is inferred. Both raw HTML and supporting PDF artifacts are attached. The batch publishes under the shared
fenced rights transaction with exact staging verification and replay identity checks.

The retained local `tabra-fr-html-storage-pilot` database on port 55438 now has 75 documents, 75 versions, 75 observations
and 75 pending lexical jobs for January 3, 2000. No lease remains active. Independent SQL compared canonical text,
blocks and metadata with all staged records and found zero mismatches. Replay reused the same generation and retained
the observation/version ID digest `56f2de2b674412ef1bbf1ee0b024040c`, with no extra outbox rows.
Evidence under `artifacts/regulatory-backfills/`: `fr-2000-publication-report.json`, `fr-2000-publication-replay.json`,
`fr-2000-publication-integrity.json` and `fr-2000-publication-replay-integrity.json`.

All 26 real PostgreSQL storage tests passed, including canonical HTML replay, absent source evidence, staged tampering,
revoked rights and complete artifact/publication rollback when outbox insertion fails. Full `pnpm verify` passed:
`C:/Users/andcra/AppData/Local/Temp/tabra-html-publication-verify.log`. The disposable test container was stopped;
the pilot database is retained. No command from this slice remains active. Search execution, embeddings, public API/MCP
delivery, archive-wide coverage and recurring source schedules remain pending. Next: expand frozen backfill coverage
and consume the lexical outbox; embedding model comparison remains mandatory before bulk vector generation.

HTML registration/staging is implemented in `fr-import-registration.ts` and `stage:fr-html-publications`.
`fr-publication-files.ts` now shares source revalidation between normalization and staging CLIs. The importer retains
the exact normalized input artifact, registers a format-specific generation in existing tables, and stages the full
bounded set under the shared rights/lease transaction. No XML unit or parser summary is fabricated.

The separate local `tabra-fr-html-storage-pilot` database on port 55438 now contains the 75 January 3, 2000 publication
inputs in `validated` state. Generation: `0021564bf55027ab50d00471b4a2ab4700179e6ee1971c3cbdc1f80f7176de25`.
Evidence: `artifacts/regulatory-backfills/fr-2000-staging-report.json`, `fr-2000-staging-replay.json`, and retained
normalized set artifacts in `fr-2000-import-artifacts/`. Canonical documents and publication outbox remain empty in
this database. All 23 real PostgreSQL storage integration tests passed on the separate disposable port 55436 database,
which was stopped after testing. Next: the atomic canonical HTML publisher, including raw artifact attachment,
version/observation identity, rights checks and lexical outbox rollback/replay validation.

Replay retained the same generation and 75 records. Independent SQL confirmed one generation, 75 staged records,
zero canonical documents, zero publication outbox rows and zero active leases. Full `pnpm verify` passed:
`C:/Users/andcra/AppData/Local/Temp/tabra-html-registration-verify.log`. No command from this slice remains active.
The 10-minute continuation remains active; recurring regulatory source ingestion stays off.

Storage lease enforcement is now format-independent through `withImportLease`. The existing `withLease` wrapper
continues to validate XML units and summaries before invoking XML writers. This removes the lease layer's XML
assumption while retaining one shared path for rights checks, transaction rollback, token/fence matching and expiry
checks before commit. No new database tables or canonical records were created by this slice.

All 22 real PostgreSQL storage integration tests passed, including two new checks for non-XML dispatch isolation,
revoked rights and end-of-transaction expiry rollback. The disposable `tabra-fr-storage-tests` database on port 55436
was used and its container was stopped afterward. Retained pilot databases were not touched. Next: register bounded
HTML generations under the shared lease contract, then publish their verified text and supporting artifacts atomically.

Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-leases-verify.log`. No command from
this slice remains active. The 10-minute continuation remains active; recurring regulatory ingestion stays disabled.

`fr-publication-input.ts` and `normalize:fr-html-publications` now produce format-aware publication inputs from the
verified HTML and supporting PDFs. The offline adapter replays metadata, revalidates source bytes and PDF proof, and
uses the existing lossless reader projection. HTML remains `html_preformatted`; no XML structures or legal sections
are invented. Text keys are distinct from metadata observation keys. The XML issue database writer remains unchanged.

All 75 January 3, 2000 publications normalized to 128 reader blocks with zero reconstruction mismatches. Two independent
offline runs produced byte-identical files: `artifacts/regulatory-backfills/fr-2000-early-publication-inputs.json` and
`fr-2000-early-publication-inputs-replay.json`, SHA-256 `e790682d277011329bb851ff978ce875f60e671f82c0341dd7266116867e44b7`.
The serialized publication payload is 3,020,954 bytes. Normalizer hash:
`1b856b880aab2645d0ac37058d36362934b490f2626442cb0d0c24f04929aa19`.
Ten focused normalization/HTML tests passed, including a real synthetic PDF, metadata-only identity changes, source
scope/hash rejection and lossless multi-block text. No canonical records were published. Next: extend import-generation
storage and fenced publication to consume this input contract, with rights/outbox/replay tests on a disposable database.

Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/tabra-fr-publication-input-verify.log`. No command from
this slice remains active; the 10-minute continuation stays active and recurring regulatory source ingestion stays off.

The alternate-text continuation implemented `fr-html.ts` and `acquire:fr-html`. All 75 January 3, 2000 supported
publications have now been acquired as document-specific official GovInfo HTML (1,353,207 bytes; 1,333,371 retained
text characters). Every source passed header document-number, date/volume, type, page-range and expected-only-footer
checks. All 75 were hash-verified, reparsed and reused on replay. The shared-page contamination found in PDF-derived
text is avoided by these publisher-specific renditions; no PDF columns were automatically trimmed.

Evidence: `artifacts/regulatory-backfills/fr-2000-early-html-report.json`, `fr-2000-early-html-replay.json`, and raw
HTML/receipts under `fr-2000-early-html/`. Parser SHA-256:
`5a90aa88245304aad7b7b3f4c4c0327ffc64eeb72d80d24e9779ba9c12d42d06`.
Nine focused tests passed, covering preserved spacing, source assertion mismatches, foreign footers, offline replay,
corrupt retained bytes and the exact source URL allowlist. This remains source-text staging: canonical normalization,
rights-aware publication, API exposure, indexing and embeddings were not performed. Next: map verified HTML renditions
into the canonical publication contract without inventing XML structure, and retain the supporting PDFs separately.
See [HTML acquisition and validation](fr-metadata-validation.md#document-specific-govinfo-html).

Full `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/tabra-fr-html-verify.log`. No command from this slice
remains active. The 10-minute continuation remains active and all recurring regulatory source schedules stay disabled.

The PDF text slice adds `fr-pdf-text.ts`, `extract:fr-pdf-text`, its isolated worker and `fr-pdf-boundaries.ts`.
It reuses the existing document extractor and OCR assessment without submitting OCR jobs or changing the shared
extractor. Three worker/staging tests exercise actual digital and image-only PDFs, replay, hash corruption and
publisher page mismatches; three additional tests cover conservative boundary diagnostics. Existing three PDF
validation tests also pass.

All 75 January 3, 2000 PDFs extracted successfully and all 75 staged artifacts were verified and reused on replay.
The report is `artifacts/regulatory-backfills/fr-2000-early-pdf-text-replay.json`; the first run report is
`fr-2000-early-pdf-text-report.json`, and content-addressed artifacts are in `fr-2000-early-pdf-text/`.
Extractor fingerprint: `ae8ae492d73a46ac824de7090ba9d4ebe04753e5a773bc51da424db5ab0051b3`.
No source requested OCR under the shared extractor's assessment. This does not prove visual completeness or reading order.

The boundary audit flags 67 PDFs with foreign FR Doc footers; eight contain only the expected detected footer and remain
`boundaries_unverified`. For example, `99-33595` begins with neighboring publication `99-34038`. No staged PDF text is
ready for canonical publication. Next: acquire document-specific official text or implement evidence-backed page/column
boundary reconciliation; do not ingest the whole extracted PDF as the target publication. Other backfill waves remain
dependency-ready. See [PDF text staging](fr-metadata-validation.md#pdf-derived-text-staging) for runtime limits and replay.

Final `pnpm verify` passed: `C:/Users/andcra/AppData/Local/Temp/tabra-fr-pdf-text-complete-verify.log`.
An earlier run observed organization-membership assertion failures in concurrently modified non-regulatory files;
the final full run is clean. No extraction or verification command from this slice remains active, and no canonical
records, indexes, embeddings or recurring source schedules were changed.

The September 14 historical PDF continuation acquired all 75 supported January 3, 2000 publications from official
GovInfo links (17,383,416 bytes). Replay reused all 75; isolated parser validation passed for all 258 pages with matching
document numbers and publisher page counts. There were no empty-text pages. Metadata links no XML for these records;
the missing bulk XML status remains valid even though official PDFs are now retained. This slice reused the existing
acquisition and validation code, without changing the extractor or canonical storage. PDF text normalization, OCR
assessment and source-to-canonical publication remain pending.

Evidence is in `artifacts/regulatory-backfills/fr-2000-early-pdf-acquisition.json`,
`fr-2000-early-pdf-replay.json`, `fr-2000-early-pdf-validation.json`, and `fr-2000-early-pdfs/`.
Full `pnpm verify` passed; log `C:/Users/andcra/AppData/Local/Temp/tabra-fr-historical-pdfs-verify.log`.
No command from this slice remains active. The 10-minute follow-up remains active; source schedules remain disabled.

Historical FR source checks now include `audit:fr-inventory`, which independently replays the bulk listing and metadata
before comparing each date. Smoke reports are `artifacts/regulatory-backfills/fr-2000-early-inventory-audit.json`,
`fr-2000-available-inventory-audit.json` and `fr-2024-inventory-audit.json` in the same directory. January 3, 2000 has
75 supported metadata records but no listed XML; January 18 has 109 supported records and a listed issue, yet parsing
fails on a duplicate source document number. The modern January 2, 2024 inventory has 63 supported records plus two
excluded presidential documents. Neither inventory agreement nor an empty day certifies publication completeness.
Historical FRDOC formatting was fixed and all five original pilot units reprocessed without failure, totaling 40,872
records. Missing-rendition acquisition and evidence-backed resolution of the duplicate remain pending; schedules and
canonical publication were not enabled. See [parser validation](parser-validation.md) and [acquisition workflows](acquisition-workflows.md).

Validation: 24 focused inventory/parser tests passed; all five reprocessed pilot units have byte-identical normalized
shards compared with the prior parser. Full `pnpm verify` passed, with log
`C:/Users/andcra/AppData/Local/Temp/tabra-fr-historical-verify.log`. No command from this slice remains active.
The next historical task is alternate-rendition text normalization and reconciliation for the missing/ambiguous
January 2000 publications; raw January 3 PDF acquisition is now complete as recorded below. Other frozen backfill
waves can proceed independently.

- `src/ingestion/regulations/contracts.ts`: strict frozen acquisition scope, source evidence, unit/manifest identity and
  checksum validation. This is the acquisition portion of SRC-01; normalized envelopes and licensed capabilities remain.
- `backfill-plan.ts` and `scripts/plan-regulatory-backfill.ts`: actual official inventories for dated eCFR titles, monthly
  FR bulk issues and annual CFR title/volumes. Saved-inventory replay requires no network, credentials, DB or Trigger.
- `artifact-backfill.ts` and `scripts/acquire-regulatory-backfill.ts`: bounded local downloads, per-directory writer lock,
  streamed byte ceiling, immutable SHA-256 artifacts, atomic complete receipts and verified resume. HTML error bodies,
  unexpected hosts/paths, changed listing byte counts and damaged retained files fail instead of completing the unit.
- Shared HTTP client's optional `streamBody` path avoids prebuffering large regulatory XML; existing callers retain
  their current buffering behavior. Existing pacing, cooldown, timeout and provider-error handling are reused.

SRC-03, DATA-01, COL-02/04/05/07/11 and the local reader foundation API-13 are checked off. SRC-01/02/04/05/06/10/12, DATA-02/03/05/06/07/09/10/11/12/13/14 and
COL-01/03/06/08/09/12/13/14 have partial implementation or pilot evidence. Phases 0–2 have not passed their full gates.
Canonical eCFR schema and local database import are implemented. Trigger deployment, API/MCP release, embedding
execution and production coverage remain pending.

The second implementation slice adds `python/regulations/parse_xml.py`, strict normalized-record and summary schemas,
the isolated TypeScript subprocess bridge, retained official-source excerpt fixtures, and `parse:regulatory-backfill`.
The parser file is explicitly included in Trigger's Python packaging. Local execution is verified; deployment is pending.
See [parser contract and pilot validation](parser-validation.md) for bounds, evidence, source anomalies and remaining gates.

The third slice adds the initial regulatory storage migration, durable generation staging and database leases,
canonical eCFR edition/provision/version membership, fenced publication and a transactional lexical outbox. See
[storage validation](storage-validation.md) for the exact supported scope, recovery contract and retained limitations.
Rights are explicitly versioned; later licensed source adapters and read-side enforcement remain separate work.

The fourth slice adds FederalRegister.gov metadata acquisition, exact cursor traversal, saturated-window splitting,
durable page evidence/offline replay and the GovInfo XML document-number reconciliation. See [FR metadata validation](fr-metadata-validation.md).
The live pilot matched every supported publication. No canonical Federal Register publication was written by this slice.

## Live pilot evidence

Manifest: `artifacts/regulatory-backfills/federal-pilot-2026-09-14.json`, ID
`be0024b71aedb90b20e34ec70358d2225d4d8f9d2b7236b4b4a93f1ee6ff9c8a`.
Source inventory replay produced the same ID. Original JSON inventories, source URLs, retrieval timestamps and hashes
are embedded in the manifest. Raw artifacts and per-unit receipts are in `artifacts/regulatory-backfills/raw/` (local,
ignored by git); attempt reports are in its `attempts/` directory. Transfer completed at 2026-09-14T21:28:25.655Z.

| Frozen source unit | Acquired bytes | Status |
| --- | ---: | --- |
| eCFR title 1 | 477,387 | Parsed and text-audited: 368 records |
| eCFR title 21 | 21,352,229 | Parsed and text-audited: 9,763 records |
| eCFR title 40 | 157,033,410 | Parsed and text-audited: 30,310 records |
| Annual CFR 2024 title 1 volume 1 | 814,725 | Parsed: 368 records; source-date mismatch flagged |
| Federal Register January 2, 2024 issue | 1,897,193 | Parsed and text-audited: 63 publications |
| eCFR title 35 | — | Explicitly excluded as reserved |

Title 40 demonstrates why downloads must stream and parser memory must be measured. The first transfer used the
existing buffered HTTP path; the streaming correction and focused regression check were added afterward. No memory
benchmark or recommended fan-out follows from this first transfer.

A separate streaming XML structure inspection verified all five files are well formed. Retained report:
`artifacts/regulatory-backfills/federal-pilot-xml-inspection-2026-09-14.json`. Title 40 contains 1,891,004 XML elements,
maximum nesting depth 15; its structure scan took 2.89 seconds locally. This scan clears source elements and does not
normalize legal records, preserve searchable text, measure parser memory or establish production throughput.

The resume run at 2026-09-14T21:31:18.010Z verified every retained artifact's SHA-256/byte count and reused all five
receipts, with zero failures and no pending raw units in this pilot. Raw bytes remain local; Azure retention is pending.

## First-slice verification

- 35 focused tests passed across regulatory backfill and shared HTTP/cooldown suites, including 20 new regulatory tests.
- Scoped oxlint and service TypeScript checks passed.
- Root `pnpm verify` passed. Legislation coverage run: 282 test files passed, 6 skipped; 2,724 tests passed, 79 skipped.
  Environment-dependent integration skips remain skips, not evidence of production DB/schema acceptance.
- Full verification log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-backfill-verify.log`.
- Review/checks apply to the current working tree. Existing unrelated Open States, ingestion and documentation changes
  were preserved. No git commit or production deployment was made by this implementation slice.

GovInfo JSON listing endpoints require a trailing slash in the tested environment. The same paths without `/` returned
HTTP 200 HTML service-error pages. Official returned folder links omit the slash, so the annual CFR adapter normalizes
it before requesting directories. File links come directly from the listing; dates without issues are not guessed.

## Parser-slice verification

- 38 focused tests passed across regulatory acquisition, the real Python parser/bridge, and Trigger packaging configuration.
- Scoped oxlint and service TypeScript checks passed.
- Root `pnpm verify` passed, including format, lint, types, knip and coverage tests. Legislation: 283 test files passed,
  7 skipped; 2,742 tests passed, 83 skipped. Environment-dependent integration skips do not establish database readiness.
- Full verification log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-parser-verify.log`.
- All five pilot files parsed successfully: 40,872 records in 35 shards. An independent source XML comparison found
  zero text-content mismatches across those records and matched every source element count.
- The annual CFR advertised 2024 edition contains a printed January 1, 2023 revision date. Both values and a warning
  are retained; publication requires resolving the discrepancy. No canonical database writes or embedding runs occurred.

## Commands

The storage slice has its own [execution and database safety contract](storage-validation.md#execution-and-checks).

Run from `apps/legislation`. Quote comma-separated options in PowerShell. Outputs are exclusive writes; choose a new
manifest filename for a fresh source observation. Acquisition preview is the default; `--apply` writes local files only.

```powershell
pnpm run plan:regulatory-backfill --cutoff 2026-09-14 --ecfr-titles '1,21,35,40' --fr-start 2024-01-02 --fr-end 2024-01-02 --cfr-years 2024 --cfr-titles 1 --output artifacts/regulatory-backfills/federal-pilot-2026-09-14.json
pnpm run plan:regulatory-backfill --replay artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --output artifacts/regulatory-backfills/federal-pilot-replay-2026-09-14.json
pnpm run acquire:regulatory-backfill --manifest artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --output artifacts/regulatory-backfills/raw --limit 5 --apply
pnpm run parse:regulatory-backfill --manifest artifacts/regulatory-backfills/federal-pilot-2026-09-14.json --raw artifacts/regulatory-backfills/raw --output artifacts/regulatory-backfills/normalized --limit 5 --apply
```

`--limit` bounds new unit attempts; already complete receipts are hash-checked and reused. Partial bounded acquisition
reports pending counts; source failures exit nonzero. A stale local lock after a killed process is deliberately not
auto-deleted: inspect its PID and confirm the writer ended before removing that exact lock. This local lock is not the
cross-host DB lease/fencing implementation required for Trigger. Artifact-only downloads do not validate complete XML,
legal identities or usable text; parsing and publication are separate stages. Parsing `--limit` selects the first N
manifest units; increase it for larger saved manifests. Matching parser generations are revalidated and reused.

## Next dependency-ready work

Use the [production backlog](production-backlog.md#recommended-first-execution-slices), checking its dependencies against
the newest evidence above. The old five-step queue was superseded by implemented annual publication, metadata/rendition
work and local search lifecycle services. No vendor license, source activation or full serving readiness is inferred.

## Storage pilot and verification

Migration 0048 created 13 regulatory tables using the normal migration runner on disposable PostgreSQL 18. The existing
canonical jurisdiction `jurisdiction:us` owns the code records. Runtime code is in `storage.ts`, `storage-contract.ts`,
`import-normalized.ts` and `scripts/import-regulatory-backfill.ts`. No production migration or data write occurred.

| Unit | Staged | Canonical members | Disposition |
| --- | ---: | ---: | --- |
| eCFR title 1 | 368 | 368 | Published in disposable database |
| eCFR title 21 | 9,763 | 9,763 | Published in disposable database |
| eCFR title 40 | 30,310 | 30,310 | Published in disposable database |
| Annual CFR 2024 title 1 volume 1 | 368 | 0 | Blocked: printed source date needs review |
| FR January 2, 2024 | 63 | 0 | Blocked: canonical publication/metadata contract pending |

The successful bounded run took 101.404 seconds locally, including retained-file validation, staging and canonical
materialization. This is one local worker under shared workstation load, not a deployed fan-out or throughput guarantee.
Its structured result has zero execution failures, three published units and two explicit blockers; CLI exit status is
nonzero because blockers remain. All 40,872 records are staged. All 40,441 canonical members match staged text, headings,
structured blocks, source locators and ordinals, with zero mismatches in an independent read-only SQL comparison.

There are three current edition pointers, 40,441 provision versions, three pending lexical outbox jobs, no embedding or
event jobs and no active leases after completion. The lexical jobs are retained work, not completed indexing. A full
second import revalidated the raw/normalized files and reused all five generations, preserving edition IDs and blockers.

The first title-40 attempt hit the 60-second PostgreSQL statement timeout during parent validation. The initial
unreleased schema was corrected to store hierarchy metadata separately from large JSON text payloads, then the
disposable database was reset and migrated again. The corrected complete run above passed. Retained failure evidence
remains in `federal-pilot-storage-2026-09-14.json`; it is not the current pilot result.

Reports under local ignored `artifacts/regulatory-backfills/`:

- `federal-pilot-storage-metadata-2026-09-14.json`: complete run and exact generation/edition IDs.
- `federal-pilot-storage-integrity-2026-09-14.json`: independent data comparison, counts and actual query plans.
- `federal-pilot-storage-replay-2026-09-14.json`: full retained-data replay.
- `federal-pilot-storage-implementation-2026-09-14.json`: source hashes, git base, database version and verification outcome.

The title-40 keyset browse and canonical identity lookup both used their B-tree indexes. Recorded database execution
times were 0.071 ms and 0.082 ms on this warm local pilot; these exclude HTTP latency and do not establish production SLAs.

18 focused storage checks passed, including 16 real PostgreSQL cases and two strict rights-policy tests. They include
outbox failure and mid-transaction lease expiry injected after the head write: both roll back visibility and recover on
retry. Test database reset and migration ran on a separate local instance from the retained real-data pilot.
Root `pnpm verify` passed, including formatting, lint, types, knip and coverage. The legislation coverage run passed
284 files and 2,746 tests; eight files and 101 tests were skipped for their environment requirements. The separate
18-check storage run above executed against PostgreSQL and is not represented by the default run's integration skips.
Final log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-storage-verify-final.log`.
The first full check identified an undeclared use of the repository's existing `tiny-invariant` dependency; its app
declaration and lockfile were corrected before the passing final run. Unrelated working-tree changes were preserved.

Retained local pilot container: `tabra-regulatory-storage-check`, loopback port 55434, database `regulations_test`.
The isolated `tabra-regulatory-storage-fault-check` container uses port 55435 and is stopped after verification.
Neither is the existing legislation development database. No import or verification process remains running for this slice.

## Federal Register metadata pilot and verification

The January 2, 2024 metadata inventory completed four source pages containing 65 distinct documents. Offline replay
reconstructed the same manifest, and a separately acquired single-page response matched all 65 normalized records.
The GovInfo XML reconciliation matched all 63 supported publications with zero gaps. Two presidential documents remain
explicit scope exclusions, with their metadata count checked against the XML source element count.

All 63 matched publications have validated publisher-listed PDF URLs. The later rendition slice below acquired them;
the original reconciliation report still leaves `artifactsComplete` and `publicationReady` false. Correction links retain unresolved
targets outside the selected issue. No Federal Register canonical records, embeddings or recurring schedules were created.

44 focused checks passed: 28 metadata/reconciliation cases and 16 existing parser/bridge cases. The first full repository
run encountered an unrelated concurrent Next build lock and the large two-subprocess parser test's five-second timeout.
That single test now has a bounded 30-second timeout to accommodate full coverage load; the parser's runtime contract
and retained generation hashes are unchanged. The focused rerun passed before restarting repository verification after
the competing build completed.

Root `pnpm verify` passed: format, lint, types, knip and coverage. Legislation passed 286 test files and 2,774 tests;
eight files and 103 tests were skipped for their environment requirements. This includes all 240 Next router acceptance
tests. Integration skips do not establish production or regulatory database readiness.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-fr-metadata-verify-final.log`. The retained
`artifacts/regulatory-backfills/fr-metadata-implementation-2026-09-14.json` records source hashes, git base and outcomes.
No verification or acquisition process remains running for this slice. The 10-minute continuation remains active.
See [FR metadata validation](fr-metadata-validation.md) for the exact manifest, source fixtures, commands and reports.

## API review implementation and source reader

The approved API names now use `/api/legal/...` and `/api/search/legal` throughout the active contracts. The three
review perspectives are reflected in explicit text reading, edition membership discovery, source agency aliases,
capability states, strict wire-schema integration and a separately gated enterprise synchronization protocol.
See [API and MCP contract](api-mcp-contract.md). Public regulatory routes are still planned, not deployed.

`reader-contract.ts` and `reader-text.ts` implement strict selection/context/capability schemas and a lossless source
text projection. Edition plus version asserts membership; publisher-date selection is exclusive. Reader windows
preserve table tabs, footnotes and whitespace, bound blocks to 16,384 UTF-16 units and windows to 100,000, and bind
continuation to caller, edition, observation, rights revision, content generation and limit. Authorization must still
run in the future read service before every call. Source XML is not emitted, and this is not a rich table-cell renderer.

17 focused checks passed. `smoke:regulatory-reader` revalidated raw hashes and normalized shards, then reconstructed
all 40,872 retained source bodies exactly across 1,015,792 blocks and 76,301 windows, with zero failures. The largest
observed window was 99,900 characters. The smoke took 20.675 seconds locally and used preview source-record identities;
it does not prove canonical API identity, authorization, HTTP or MCP delivery. The Python parser remained unchanged.
Report: `artifacts/regulatory-backfills/federal-pilot-reader-2026-09-14.json`.
Root `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-reader-verify.log`.

## Federal Register PDF acquisition

`fr-pdf.ts` and `acquire:fr-pdfs` implement serial, paced, bounded downloads from exact publisher-listed GovInfo URLs.
Receipts bind the metadata manifest, issue date and document number. Downloads reject wrong MIME types, missing PDF
signature/end markers, length mismatches and oversized bodies. Immutable bytes and receipts use atomic links and
flushes; a per-directory writer lock prevents overlapping workers. Resume verifies every cached hash before reuse.
A process killed before cleanup can leave `writer.lock`; verify the writer is gone before removing that exact lock.
Failed records retain explicit reasons; a bounded subset never claims complete issue acquisition.

The pilot acquired all 63 supported January 2, 2024 PDFs, totaling 23,328,275 bytes. A second run reused all 63 verified
receipts. Reports are `fr-pdfs-pilot-2026-09-14.json` and `fr-pdfs-replay-2026-09-14.json` under the same artifact root;
bytes and receipts live in `fr-pdfs/`. Acquisition does not validate cross-reference tables, embedded objects, page
rendering or text extraction. Structural validation remains pending and `publicationReady` stays false. No canonical
FR records, embeddings or source schedules were created. Nine PDF tests plus 20 existing backfill tests passed;
service TypeScript and scoped lint passed before subsequent concurrent Open States edits.

Two combined verification attempts encountered concurrent-workspace coverage directory removal after the new tests
passed. The optional `LEGISLATION_COVERAGE_DIRECTORY` setting now selects an isolated Vitest report directory and is
passed through Turbo's coverage task; ordinary runs still default to `coverage`. This changes report storage only.
The isolated final run uses `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-reader-pdf-coverage-20260914`.

The reduced-concurrency coverage run passed legislation: 289 test files and 2,814 tests, with eight files and 103
environment-dependent tests skipped. It also passed the theme package after the earlier contention timeouts; unrelated
web UI tests failed. Log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-coverage-reduced.log`.
The latest root `pnpm verify` cannot be reported clean: concurrent Open States work introduced TypeScript literal-type
errors in `src/ingestion/openstates/people-archive-pair.test.ts` at lines 23 and 31. Those unrelated files were preserved.
Log: `C:/Users/andcra/AppData/Local/Temp/tabra-regulatory-reader-pdf-verify-complete.log`. Recheck root verification once
that active work settles; do not rerun the successful network acquisition or source-reader smoke without a relevant change.
No acquisition or verification command from this slice remains active.

The subsequent slice below completes the bounded FR publication writer and required-PDF attachment. Remaining work
includes canonical agency aliases, the annual CFR source-date mismatch, authenticated legal reads and route/client/MCP
integration. API-14 enterprise synchronization and embedding-model comparison remain independent explicit gates.

## Canonical Federal Register pilot

The PDF gate passed all 63 retained originals across 266 pages. Each file's current SHA-256, publisher document number
and publisher page count matched. Every page's text and drawing operators were parsed in a bounded child process.
The largest document has 51 pages; its first page was rendered with Poppler and visually inspected. Full visual review,
PDF conformance certification and malware sanitization are not claimed. Report: `fr-pdf-validation-2026-09-14.json`.

The revised unreleased migration adds five FR tables. The issue writer preserves stable document IDs, XML text versions,
metadata observations and required rendition evidence; it publishes one reconciled issue and its pending lexical jobs
in one fenced transaction. It rejects missing renditions, identity/page-count mismatches and changed snapshots on replay.
The current limit is 1,000 publications and 8 MiB staged payload per issue. Larger issues need the partitioned writer.
Agency/RIN/docket/correction evidence is retained but is not promoted into canonical agency/action/relationship records.
Metadata-only refresh under the same XML generation remains an explicit conflict, not an automatic overwrite.

Real PostgreSQL validation passed 20 storage tests, including four new FR scenarios: stable replay, missing/mismatched
renditions, full rollback after outbox failure with successful retry, and revoked rights/expired lease rejection.
Three PDF parser/gate tests passed alongside them, for 23 focused checks. The first run exposed a test cleanup omission
for the new document table; after correcting isolation, all checks passed. Service types and scoped lint passed.

The real January 2, 2024 pilot contains 63 publications, 63 versions, 63 observations and one published batch. Independent
SQL comparison found zero XML text/heading/block mismatches. A full retained-file replay preserved all IDs and counts.
There are 63 pending lexical jobs and zero active leases. No index, embedding, customer alert or source schedule was run.
The unresolved correction target `2023-27742` remains publisher evidence; its separate correction publication was retained.

Reports under local `artifacts/regulatory-backfills/`: `fr-publication-storage-2026-09-14.json`,
`fr-publication-integrity-2026-09-14.json`, and `fr-publication-replay-2026-09-14.json`.
Retained pilot: container `tabra-fr-storage-pilot`, loopback port 55437, database `regulations_test`.
Separate destructive test container `tabra-fr-storage-tests`, port 55436, is stopped. The earlier eCFR pilot on 55434
and ordinary development database on 55432 were not modified. The revised migration was applied only to fresh FR databases.
See [storage validation](storage-validation.md) for commands, bounds and recovery semantics.

Root `pnpm verify` passed: formatting, lint, types, unused-code checks and coverage. Legislation passed 291 files and
2,819 tests; eight files and 108 environment-dependent tests were skipped. The separate 20-test real PostgreSQL run
above exercised regulatory storage instead of relying on its default skips. Log:
`C:/Users/andcra/AppData/Local/Temp/tabra-fr-publication-verify-complete.log`.
An earlier attempt encountered concurrent web coverage-file removal. A subsequent run exposed a five-second timeout
in the existing corrupt-input/shard-reuse parser test, which launches real processes. That test now has a bounded
30-second timeout; all 16 parser checks passed on focused rerun, then the full repository passed. Parser production
limits and retained parser hashes were unchanged. Coverage files are retained in the isolated temporary directory;
Turbo's missing-default-output warning does not indicate a failed check. No command from this slice remains running.
The 10-minute continuation remains active. Next: larger-issue publication, source/agency relationships and remaining
historical coverage gates, then lexical-index consumption and authenticated API/MCP reads. Bulk embeddings remain gated
on the required held-out model comparison.

## Publisher agency and proceeding-reference projection

The continuation found no active regulatory worker or verification process and completed a local source-reference
projection. `fr-source-references.ts` and `project:fr-references` normalize publisher agency IDs, source parent IDs,
RINs and document-scoped dockets while retaining every original field and occurrence. No canonical organization/action
is assigned and no cross-document name or docket merge is performed. Missing names/identifiers have explicit reasons.

Offline replay of the retained metadata manifest projected all 63 supported publications: 94 agency occurrences,
40 distinct usable publisher agency IDs, seven RIN occurrences and 68 docket occurrences. No missing names, unidentified
agencies or blank identifiers appeared in this pilot. Report:
`artifacts/regulatory-backfills/fr-source-references-2026-09-14.json`. It contains the per-publication source evidence,
stable hashes and explicit unresolved assignments; it made no network requests or canonical database writes.

Five focused tests passed, covering the complete official fixture, name changes under a stable native ID, same-name
unidentified agencies, unusable values, docket collisions and shared RINs without action merging. Scoped lint and service
types passed. Full `pnpm verify` passed; log: `C:/Users/andcra/AppData/Local/Temp/tabra-fr-source-reference-verify.log`.
No command from this slice remains running. Normalized DB reference storage, reviewed organization resolution,
action/relationship promotion and public directory endpoints remain open; this projection does not close DATA-02.

## Annual CFR title-1 date audit

The idle continuation expanded the frozen annual pilot to title 1 volume 1 under package years 2023, 2024 and 2025.
All three official inventories and downloads succeeded. Each XML is 814,725 bytes, with the identical SHA-256
`443032797d95acd1d1f338e5f6252544b97ec35bd12e6fc0979d3773f9913595`. All parse to 368 records with a printed revision
of January 1, 2023. These are three package observations of the same source bytes, not three distinct code revisions.
The 2024/2025 official PDFs independently print the same date; source links are in [the data contract](data-contract.md).
The reuse is upstream, not a parser date-extraction bug. Why the publisher reused those bytes, and whether that supports
a later legal-currency claim, remains unresolved. No date override or canonical annual publication was performed.

`annual-cfr-dates.ts` and `audit:annual-cfr-dates` implement a repeatable evidence gate. The CLI rechecks raw hashes,
receipt scope and every normalized shard before comparing package years and printed dates. Missing or conflicting
dates are explicit outcomes. Shared content is grouped by hash. Even consistent dates do not bypass other publication
gates. A completed audit exits nonzero when date review is required; that is its expected outcome for this source set.

Retained files under `artifacts/regulatory-backfills/`:

- `annual-title1-date-audit-2026-09-14.json`: frozen manifest, ID `5760b9256bae54460ae5ca4be70f8560cca5ba1ae451c45a8e8a66eebb1bd052`.
- `annual-title1-raw/`: source receipts and one content-addressed blob shared by the three packages.
- `annual-title1-normalized/`: three validated generation directories and parser report.
- `annual-title1-date-assessment-2026-09-14.json`: one consistent year, two year mismatches, no publication approval.

Reproduce from `apps/legislation`:

```powershell
pnpm run plan:regulatory-backfill --cutoff 2026-09-14 --cfr-years '2023,2024,2025' --cfr-titles 1 --output artifacts/regulatory-backfills/annual-title1-date-audit-2026-09-14.json
pnpm run audit:annual-cfr-dates --manifest artifacts/regulatory-backfills/annual-title1-date-audit-2026-09-14.json --raw artifacts/regulatory-backfills/annual-title1-raw --normalized artifacts/regulatory-backfills/annual-title1-normalized --output artifacts/regulatory-backfills/annual-title1-date-assessment-2026-09-14.json
```

Use fresh output filenames for another run. Quote comma-separated lists in PowerShell. Four focused date-gate tests,
scoped lint and service types passed. Full `pnpm verify` passed; log:
`C:/Users/andcra/AppData/Local/Temp/tabra-annual-cfr-date-verify.log`. No command from this slice remains active.
No DB, index, vector or recurring source
schedule was changed. Other backfill work can continue independently of this annual-date gate.
