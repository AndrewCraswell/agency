# Durable preparation dispatch

`regulatory-preparation-dispatch` accepts an explicit `dispatches` array of 1–10 items. Each item contains a UUID
`waveId`, an edition/publication observation scope, selected tokenizer model, version-batch limit 1–25 (default 10)
and optional `retryBlocked` (default false). Duplicate wave/scope/model identities are rejected before database access.
There is no recurring schedule or implicit national inventory selection.

The canonical `legal_preparation_dispatches` table stores immutable payload hashes and small reference payloads.
It also stores the exact preparation ID derived from scope, pinned tokenizer and passage contract, so later accounting
and recovery do not guess which preparation generation belongs to an intent. Re-registering the same dispatch after any
identity drift fails instead of silently attaching it to newer preparation behavior.
Every item in the bounded wave is registered before the first child is submitted. Partial registration failures admit
no children; replay completes registration. Submission runs serially, with one dispatcher and a two-connection pool.
The existing preparation queue limits active children to two workers. This is not an aggregate all-stage connection budget.

Each intent moves from pending to submitting under a two-minute fenced lease. A successful Trigger response stores
the child handle and marks it submitted. Submitted does not mean prepared, copied, indexed or embedded. An uncertain
response leaves the intent submitting and releases its lease for retry with the same key. Payload changes under the
same wave/scope/model identity fail. Fresh operator attempts must use a new wave ID, not mutate old intent.

The Trigger adapter explicitly creates a global idempotency key with a seven-day TTL; a raw string alone defaults
to the parent-run scope. See [Trigger idempotency](https://trigger.dev/docs/idempotency). Database retries refuse an
uncertain intent six days after its first attempt, before key expiry. Such records require reconciliation rather
than automatic resubmission. Existing submitted handles are reused without another Trigger call. Key expiry is not
a completion signal. Worker canonical leases and checkpoints remain the final protection against duplicate writes.

## Evidence and remaining work

Before creating a full PASS-09 wave, run `pnpm tool regulations/audit-passage-manifest-admission --catalog <catalog>
--hash <catalog-sha256>` against the explicit local `REGULATORY_TEST_DATABASE_URL`. The read-only audit rehashes the
catalog, every partition manifest and every ordered entry stream inside a repeatable-read transaction. It rejects paths
outside the catalog directory and requires the live edition identity, source generation, rights profile and policy hash,
membership count, ordinal/version/content/source-locator identity, and preparation context to match the frozen catalog.

For a generation already stored in PostgreSQL, the audit also derives its storage ID from the frozen generation identity
and requires exact passage contract, tokenizer, context, input manifest, eligibility, expected and actual passage counts,
version ownership, and current source-provenance hash. A conflict fails the whole audit. Missing generations are counted
as pending and do not fail admission. The report accounts for every version and passage by partition; it performs no
passage writes, dispatches, provider calls, readiness promotion or embedding work. Passing admission authorizes only
preparation against that exact catalog. The wave still requires an explicitly chosen candidate and immutable cutoff.

The audit report includes a compact `admission` object containing the catalog hash, model, tokenizer, scope kind and
the exact sorted owner inventory with frozen version/passage counts. Copy that object unchanged into `plan` or
`admission`. The planner persists it in the immutable wave parameters and compares each 11-row database lookahead with
the corresponding admitted owners before rights checks or intent writes. A missing, additional or reordered owner,
model mismatch, duplicate owner, changed cutoff or changed admission descriptor fails the transaction. An exhausted
wave is accepted only when its selected count equals the admitted owner count. This protects a wave from inventory drift
after the read-only audit; the retained audit report remains the evidence that the supplied catalog hash and counts were
actually verified.

The same task accepts `{ "plan": { "waveId": "<uuid>", "source": "ecfr", "model":
"openai/text-embedding-3-small", "publishedBefore": "2026-09-16T00:00:00Z", "manifestAdmission":
<audit-report.admission> } }` to select published federal
edition references. `source` is `ecfr`, `govinfo-cfr` or `govinfo-fr`; the model may also be `voyageai/voyage-4`.
`limit` controls the child preparation batch (default ten, maximum 25), not planner page size. Planning reads at most
eleven edition IDs and records at most ten intents per call, using a partial `(source_id,id)` index and an immutable
UTC publication cutoff. Future cutoffs are refused. This selects all published editions in the source before the
cutoff, including historical editions, not only current code heads. `govinfo-fr` instead selects published Federal
Register observations using their publication batch's Rostra timestamp and records `publication` scopes. The historical
document date is not the planning cutoff. All retained observations are selected, including multiple observations of
the same version from different batches; scope-specific preparation identity remains the deduplication boundary.

The wave's normalized parameters, exact admitted owner inventory and checkpoint are durable. Reusing the wave with
changed parameters fails. A row
lock serializes page selection; rights checks, all page intents and the checkpoint commit in one transaction. A lost
response does not lose intent: recovery scans the wave from its beginning. Calling `plan` again advances the next page;
it does not replay the previous response. Once exhausted it returns zero without reopening selection. Planning makes
no remote calls. Use the recovery path below to preview or submit recorded intents. The worker rechecks rights.

For full admitted inventory planning, send the same payload as `{ "controller": <plan> }`. One run persists at most ten
intents, closes its database pool, then schedules exactly one continuation under a global key bound to wave, catalog and
the committed selected count. Each continuation reuses the immutable plan and durable checkpoint. Exact exhaustion stops
the chain with `continuationRunId: null`. This controller registers intent only: it does not submit preparation children,
call a model provider, copy passages or create embeddings. Run recovery separately after inspecting the complete wave.

This is a bounded scan against a caller-supplied, previously audited frozen inventory. The planner detects concurrent
backdated insertions, removals and changed publication eligibility when they alter that exact ordered inventory. Source
reconciliation and a fresh audit/wave are required after such changes. A rights-denied edition stops the page without
advancing; it is not silently omitted. The explicit 1–10 `dispatches` path remains useful for manual canaries but does
not establish full PASS-09 manifest admission. Historical completeness, shared database admission, automatic controller
continuation and deployed throughput qualification remain separate gates.

The September 17 retained-database admission passed both frozen current-eCFR candidate catalogs. OpenAI Small accounts
for 49 editions, 275,138 versions and 501,543 passages; 35 versions are already materialized and 275,103 are pending.
Voyage 4 accounts for the same 49 editions and 275,138 versions with 522,180 passages, all pending. Reports are retained
as `artifacts/regulatory-backfills/openai-small-passage-admission.json` and
`artifacts/regulatory-backfills/voyage-4-passage-admission.json`. These are local read-only admission results. They do
not select a model or claim PASS-09 completion.

`pnpm tool regulations/run-regulatory-passage-backfill` is the operator entry point for converting one of those audited
catalogs into a complete planning-controller wave. It requires explicit environment, catalog path and hash, wave UUID,
source, publisher cutoff, bounded child limit and exclusive output receipt. The default invocation is read-only and
repeats the complete catalog/database audit before emitting a stable plan hash and exact controller payload. This avoids
using a stale retained admission report as write authorization.

Apply additionally requires `--apply --plan <preview-plan-hash>`, an exact `REGULATORY_ENVIRONMENT` match and
`REGULATORY_EMBEDDING_MODEL` equal to the catalog model. The selected-model requirement keeps both candidate catalogs
previewable while preventing either one from becoming a full passage corpus before EVAL-12. A successful submission
uses a seven-day global idempotency key and retains the Trigger run ID; an uncertain failure retains a bounded failure
receipt. The controller still only registers durable preparation intents. Use the existing recovery flow to inspect and
submit those intents after the complete plan is visible.

The retained OpenAI Small preview on canonical port 55457 revalidated all 49 current editions and 275,138 versions,
including 35 materialized and 275,103 pending versions, before producing plan
`569abfb26537a4b3c1a2b7c6a1034a4e4dc461bfe33bb49fd95d7f850e245125`. No apply was attempted because reviewed model
selection remains open. Receipt: `artifacts/regulatory-backfills/openai-small-passage-backfill-preview-final.json`.

The task also accepts `{ "admission": { ...plan, "pendingOnly": true } }`. This selects only due pending lexical
outbox scopes, registers at most ten intents under the durable wave checkpoint and immediately executes one recovery
page to submit those recorded intents. eCFR and annual CFR admissions join `legal_derived_outbox`; Federal Register
admissions join `regulatory_publication_outbox`. The caller must supply the model explicitly. Here it chooses the pinned
tokenizer/input contract for passage preparation and does not promote an embedding route or authorize vector generation.
Re-running the same immutable wave recovers its stored intents; changing source, cutoff, model or pending-only policy
fails the plan identity check.

At `2026-09-16T04:50:55Z`, a clone of the 110-observation Federal Register pilot on disposable port 55456 passed
eleven-page selection and recovery preview without omissions or duplicate scopes. Two concurrent planner calls
serialized to distinct ten-item pages and cumulative checkpoints of ten and twenty. Rights revocation rolled back
the complete attempted page; the original rights state was restored. Cutoff tests distinguished historical document
dates from batch publication. The actual Trigger task function's exhausted planning path also passed. No Trigger or
provider calls were made, and the retained source database was untouched. Evidence and a PostgreSQL query plan are
in `artifacts/regulatory-backfills/fr-preparation-plan-canary.ts/.json`. This is local pilot evidence, not a national
throughput or deployed Trigger acceptance result.

Recovery uses the same task with `{ "recovery": { "waveId": "<uuid>", "limit": 10 } }`. It defaults to read-only
preview. Set `execute: true` inside recovery to submit ready stored intents. An indexed `(wave_id,id)` keyset query
reads at most 11 rows and returns at most 10. Pass `nextAfterId` as `afterId` to inspect the next page. Every selected
row's identity, payload hash, wave, source scope and model are checked before any remote request. Corruption rejects
the whole selected page. Pending work uses the original key; saved run handles are reused.

Results distinguish ready, busy, requires-reconciliation, newly submitted and already-submitted intents. Busy or old
uncertain records do not prevent other ready rows in the page from progressing. An empty next cursor means the current
scan ended, not that the wave completed. Restart a later scan from the beginning to revisit deferred rows. Concurrent
new inserts may require another scan. Unexpected submission failures propagate and retain the original intent.

Remote run disposition has a separate manual `regulatory-preparation-recovery` task. It scans at most ten submitted or
uncertain intents from one wave by dispatch-ID keyset. Active Trigger runs remain assigned to their saved attempt. A
submission without a run ID remains protected for six days; a saved run missing from Trigger history remains protected
for seven days. After those windows, or immediately after a terminal failed/cancelled/expired run, recovery first appends
the old attempt, run ID, observed disposition and observation time to durable history, increments the database attempt,
then submits the immutable payload under `legal-preparation:<dispatch-id>:<attempt>`. A Trigger 404 is missing history;
other inspection errors propagate without changing assignment.

Trigger `COMPLETED` is not canonical completion. Recovery derives the preparation ID from the stored scope, selected
pinned tokenizer and passage contract, then checks `legal_passage_preparations`. Only canonical `prepared` or `blocked`
states close the dispatch; `blocked` retains `source_records_blocked`. Remote completion while canonical state remains
absent or pending records `completed_without_preparation` and submits no replacement. This preserves the mismatch for
operator repair instead of converting a lost checkpoint into success. The task shares the serialized preparation queue,
uses a two-connection canonical pool, has no schedule and never calls an embedding provider.

`inspect:regulatory-readiness --wave <uuid>` reads one immutable planned wave under a repeatable-read inspection transaction.
It reconciles the plan denominator with registered dispatches, durable run outcomes, exact preparation IDs, delayed or
active preparation checkpoints, lexical outbox state and active display/search rights. `ready` requires an exhausted
nonempty plan, exact registered/completed/prepared counts and an acknowledged lexical job for every selected scope. A
pending or delayed lexical job, missing preparation, blocked source record, uncertain submission, premature remote
completion, inactive/invalid rights profile or incomplete planner page keeps the wave unready. Historical failed and
cancelled attempts remain counted even after a successful replacement. The inspector performs no writes or dispatches.

At `2026-09-16T04:21:31Z`, a real PostgreSQL canary on disposable database 55453 passed lost-response key reuse,
stored-handle replay, changed-payload rejection, expired-key refusal, concurrent exclusion, expired-lease fencing and
recovery. Trigger responses were simulated; no child, source, preparation, provider or vector work was started.
Evidence: `artifacts/regulatory-backfills/preparation-dispatch-canary.ts/.json`. Focused worker tests also verify
wave limits, registration before submission, global key generation, database separation and pool cleanup.

After a preparation reaches canonical `prepared` state, its worker submits `regulatory-passage-copy` with the immutable
preparation ID, initial ordinal and the same bounded item limit. The handoff uses a global key derived from the
preparation ID, so worker replay cannot mint a second copy chain. A blocked preparation does not advance. Copy
continuations retain their committed ordinal. When copying is exhausted, the copy worker submits the first bounded
`regulatory-copy-validation` page under a second preparation-scoped global key.

Validation persists checkpoints in pages and advances only from the returned ordinal. An exhausted page submits a
separate finalization run; it does not acknowledge the lexical outbox itself. Finalization rechecks the full checkpoint
inventory and current source/target revisions before acknowledging the canonical lexical job. A nonadvancing page,
copy failure, stale checkpoint or finalization failure dispatches no successor. None of these handoffs creates an
embedding request or changes the embedding rollout gate.

This advances ORCH-02/06/07/08 but does not close them. Indexed multi-source national manifest selection,
aggregate database admission and deployed fault injection remain open. Source
publication/rights validation remains in the preparation worker; submitting an ID grants no source read permission and
proves no eligibility. Recurring ingestion and bulk embedding gates remain unchanged.

The recovery canary on disposable 55453 additionally verifies five-intent pagination without omissions, preview with
zero submission calls, recovery of only ready intents, retained-handle replay and rejection of corrupted stored payloads.
Evidence: `artifacts/regulatory-backfills/preparation-recovery-canary.ts/.json`. Remote responses are simulated.
