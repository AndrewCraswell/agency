# Durable preparation dispatch

`regulatory-preparation-dispatch` accepts an explicit `dispatches` array of 1–10 items. Each item contains a UUID
`waveId`, an edition/publication observation scope, selected tokenizer model, version-batch limit 1–25 (default 10)
and optional `retryBlocked` (default false). Duplicate wave/scope/model identities are rejected before database access.
There is no recurring schedule or implicit national inventory selection.

The canonical `legal_preparation_dispatches` table stores immutable payload hashes and small reference payloads.
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

The same task accepts `{ "plan": { "waveId": "<uuid>", "source": "ecfr", "model":
"openai/text-embedding-3-small", "publishedBefore": "2026-09-16T00:00:00Z" } }` to select published federal
edition references. `source` is `ecfr`, `govinfo-cfr` or `govinfo-fr`; the model may also be `voyageai/voyage-4`.
`limit` controls the child preparation batch (default ten, maximum 25), not planner page size. Planning reads at most
eleven edition IDs and records at most ten intents per call, using a partial `(source_id,id)` index and an immutable
UTC publication cutoff. Future cutoffs are refused. This selects all published editions in the source before the
cutoff, including historical editions, not only current code heads. `govinfo-fr` instead selects published Federal
Register observations using their publication batch's Rostra timestamp and records `publication` scopes. The historical
document date is not the planning cutoff. All retained observations are selected, including multiple observations of
the same version from different batches; scope-specific preparation identity remains the deduplication boundary.

The wave's normalized parameters and checkpoint are durable. Reusing the wave with changed parameters fails. A row
lock serializes page selection; rights checks, all page intents and the checkpoint commit in one transaction. A lost
response does not lose intent: recovery scans the wave from its beginning. Calling `plan` again advances the next page;
it does not replay the previous response. Once exhausted it returns zero without reopening selection. Planning makes
no remote calls. Use the recovery path below to preview or submit recorded intents. The worker rechecks rights.

This is a bounded scan of published inventory, not a frozen national inventory or proof of completeness. UUID keysets
and a publication cutoff do not account for concurrent backdated insertions or changed publication timestamps behind
the checkpoint. Source reconciliation and a fresh wave are required after such changes. A rights-denied edition stops
the page without advancing; it is not silently omitted. Historical completeness, shared database admission, automatic
controller continuation and deployed throughput qualification remain separate gates.

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

At `2026-09-16T04:21:31Z`, a real PostgreSQL canary on disposable database 55453 passed lost-response key reuse,
stored-handle replay, changed-payload rejection, expired-key refusal, concurrent exclusion, expired-lease fencing and
recovery. Trigger responses were simulated; no child, source, preparation, provider or vector work was started.
Evidence: `artifacts/regulatory-backfills/preparation-dispatch-canary.ts/.json`. Focused worker tests also verify
wave limits, registration before submission, global key generation, database separation and pool cleanup.

This advances ORCH-02/07 but does not close them. Indexed national manifest selection, background intent scanning,
Trigger disposition lookup, cancellation/expired-key repair, aggregate database admission and deployed fault injection
remain open. Source publication/rights validation remains in the preparation worker; submitting an ID grants no source
read permission and proves no eligibility. Recurring ingestion and bulk embedding gates remain unchanged.

The recovery canary on disposable 55453 additionally verifies five-intent pagination without omissions, preview with
zero submission calls, recovery of only ready intents, retained-handle replay and rejection of corrupted stored payloads.
Evidence: `artifacts/regulatory-backfills/preparation-recovery-canary.ts/.json`. Remote responses are simulated.
