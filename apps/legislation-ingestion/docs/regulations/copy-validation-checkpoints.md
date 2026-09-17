# Resumable copy-validation boundaries

INDEX-03 remains open. Whole-copy inspection retains a 60-second deadline; the measured Title 23 pilot took 44.95
seconds after batching metadata reads. Explicit finalization now consumes verified pages without rereading passage
bodies. Copy traversal ending does not authorize serving.

## Implemented mutation counters

Canonical and isolated-search schemas now have independent `legal_copy_revisions` tables keyed by generation ID.
Bigint revisions advance in the same transaction as relevant writes. Counters are separate from generation metadata,
so transfer hashes and embedding freshness contracts do not change.

- Canonical generation and passage inserts, updates and deletes advance affected generations.
- Canonical provision/publication version updates advance related generations through indexed version IDs.
- Target generation, passage and membership changes advance affected generations; moves advance both old and new IDs.
- Truncating generation, passage or target-membership tables advances retained counters. Canonical version truncation
  cascades to referencing generations and therefore fires the generation truncate trigger.
- Counters have no generation foreign key: deletion retains the counter, and recreating the same ID advances it.
  Rollback rolls back increments too. No-op updates conservatively advance counters.

These triggers are a foundation, not a receipt or permission check. They are installed on retained source 55438 and
search pilots 55454/55455, as well as disposable source 55453 and search database 55456. PostgreSQL checks
cover rollback, source-version/passage edits, target metadata, membership/passage moves, deletion/recreation and
truncation. Evidence: `artifacts/regulatory-backfills/copy-revision-canary.ts/.json`.

## Remaining implementation

`regulatory-copy-validation` now accepts `{ preparationId, afterOrdinal?, limit? }` with at most 25 generations per
call (default ten). It compares a bounded canonical/retained inventory page, validates metadata and every passage/hash,
then atomically saves `legal_copy_validation_items` in the search database. Checkpoints bind scope, inventory,
ordinal, generation, metadata hash, passage count and both database revisions. Missing revision rows use zero as an
initial observation; subsequent tracked mutation changes it. Retrying a page replaces checkpoints after revalidation.
Changed canonical body text, invalid cursors or copy disagreement reject the page without committing checkpoints.

Preparation now also stores `legal_passage_source_provenance`, hashing the canonical body, heading, full source blocks
and parser input contract with PostgreSQL's canonical JSONB representation. The proof is written only after source
snapshot revalidation and exact passage insertion/replay checks. Copy verification compares it with the current
canonical source, so markup-only changes cannot pass on an unchanged body hash. Proof updates and removals also
advance source revisions. Unchanged replay does not rewrite the proof.

Older prepared generations without this proof fail verification. Re-run passage preparation to establish it through
exact replay; never fill the table by assuming today's source matches an old preparation. This requires no embedding
regeneration, and identical passage generations remain reusable. All 1,270 retained Title 3/23 generations were replayed
exactly to establish source proofs. Existing target counters were initialized before full page verification; counter
initialization itself was never treated as content evidence. The disposable integration database also exercised
missing-proof refusal and replay recovery.

Results include `afterOrdinal`, `exhausted` and `checkpointsWritten`, but always report `copyComplete: false`,
`acknowledged: false` and `publicSearchReady: false`. Empty terminal pages do not prove earlier pages were verified.
There is no automatic continuation. Page operations do not create search receipts or acknowledge source outboxes.

The same task accepts `{ operation: "finalize", preparationId }` explicitly. `finalizeLegalPassageCopy` checks the full
canonical and retained inventory, exact membership count and every expected membership, current rights, preparation
state, source proofs and generation metadata. It requires exactly one matching checkpoint per inventory item and
locks both revision sets in sorted generation order. Missing counters fail: an absent row cannot be locked against a
concurrent first insertion. Missing, duplicated, mismatched or stale checkpoints fail before acknowledgement.

Finalization reuses passage reconstruction, input-hash and manifest verification already performed by the saved
pages, without rereading passage bodies. It sums verified passage counts, commits the target scope receipt first,
then commits the canonical lexical acknowledgement. Retrying after a lost canonical commit reuses unchanged pages.
The operation retains its 60-second deadline; national-scale inventory and revision traversal still need measurement.
Counters alone never establish correctness. Deadlock or serialization failures abort and require retry.

Each resumed page must recheck rights and preparation identity. Revalidate a generation when either revision differs.
Changed source, missing generations, extra memberships or incomplete pages prevent new acknowledgement. Both the
page worker and finalizer still report `publicSearchReady: false`; these local operations are not deployment gates.

Acknowledgement now copies revision pairs into `legal_search_scope_revisions` in the receipt transaction. This table
is independent of replaceable page checkpoints and is removed when the scope receipt is removed. A new or repaired
validation page cannot renew an old acknowledgement. Whole-copy acknowledgement also writes these revision snapshots;
missing or zero counters cannot be promoted.

Edition-wide API search and acknowledged version/publication canaries compare complete canonical revision manifests
with the receipt snapshot and current target counters before ranking. PostgreSQL aggregates the manifests, avoiding
transfer of every revision row to the application. Exact receipt-row and membership counts are required, and counter
rows are locked through the serving transactions. A mutation anywhere in the selected scope rejects even a query
that would otherwise return zero hits. Revision manifests also bind frozen search cursors, so renewed acknowledgement
does not resume the old revision set. Anonymous or disallowed organizations still fail before database access.

Both retained search pilots now have renewed snapshots for 1,270 generations and 1,953 passages. Title 23 required
50 pages per target, taking 36.99/37.26 seconds in total; final acknowledgement took 1.39/1.58 seconds without rereading
passage bodies. These are local two-title measurements, not national-scale throughput acceptance. Evidence:
`artifacts/regulatory-backfills/retained-copy-proof-renewal.json`. Renewed HTTP/MCP canaries passed against 55455.
Generation counters do not cover edition membership, code names or publication observation metadata. Serving therefore
also reconstructs the selected live inventory in PostgreSQL, locks its source rows and requires its complete count,
ordinal/version identities and trimmed preparation context to match the retained preparation. Publication context
includes the current document number, publisher and kind. Extra unprepared source provisions cannot be omitted by
joining only expected generations. Rights checks remain independent of these inventory/revision checks. Full-corpus
latency and broader hierarchy/correction propagation still need operational validation.

`inspect:regulatory-readiness --copy <preparation-hash>` now reconciles this handoff without writing either database.
It opens repeatable-read snapshots on the canonical and isolated-search databases, verifies current source rights,
preparation counts and leases, lexical outbox state, target membership and validation-checkpoint counts, the exact scope
receipt identity/inventory/counts and every source/target revision fence through the same shared receipt verifier used by
serving. Copy traversal or a complete checkpoint count alone remains unready. `ready` requires an acknowledged source
outbox and a matching revision-bound target receipt; rights revocation fails closed. This is one-preparation evidence,
not partition-level completion or run-disposition recovery.

Do not delete counter tombstones while checkpoints or receipts can refer to them. Cleanup requires an explicit epoch
policy. National-scale write contention, correction propagation and deployed failure recovery remain unverified.
