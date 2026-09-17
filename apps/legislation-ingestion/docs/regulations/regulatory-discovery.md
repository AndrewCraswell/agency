# Regulatory source discovery checkpoints

Regulatory discovery has a durable canonical ingress before any recurring schedule is enabled. It is independent of
Trigger run retention: a source/query scope retains its committed cursor, covered window, overlap start, source cutoff,
last attempt, last success, revision and last committed page. Exact page receipts and deduplicated acquisition units
remain in PostgreSQL.

`startLegalDiscoveryAttempt` creates or resumes an immutable source/query scope and records an attempt without changing
the committed cursor. `commitLegalDiscoveryPage` accepts at most 100 units. It locks the checkpoint, verifies the
expected revision and cursor, validates every source unit and inserts the units, page receipt and new cursor in one
serializable transaction. A failure at any point rolls back the page. Replaying the exact last page returns its prior
receipt; competing or stale pages fail instead of skipping a window. Reusing a unit key with different bytes or fields
fails closed.

The first source adapter reads the official eCFR title inventory. It requires 50 unique title records, rejects
`import_in_progress`, preserves reserved titles as explicit outcomes and validates issue/currency dates against the
publisher inventory date. It compares each requested title with the stored `legal_code_heads` eCFR edition. A changed
title becomes one current acquisition unit; an unchanged title creates no new unit. Repeated discovery before a pending
unit is consumed may create another zero-new-unit page receipt but cannot duplicate the work item.

Trigger task `regulatory-ecfr-discovery` is a bounded manual entry point with a single-worker queue. Its optional title
selection is unique and limited to titles 1–50. It points only at the canonical database. No Trigger schedule is
registered here; hourly activation remains blocked until G4 and SYNC-11.

`regulatory-discovery-registration` moves at most 100 pending units into one immutable current-acquisition manifest.
Selection, manifest insertion and the pending-to-registered transition share one serializable transaction. Controllers
use row locks with `SKIP LOCKED`, so competing bounded runs cannot claim the same unit. An empty pending set produces no
manifest. Registration does not download source bytes, submit a child task or imply that acquisition succeeded.

`regulatory-discovery-acquisition` accepts one manifest ID and unit key. The worker reloads the immutable manifest,
streams the official XML through the existing bounded checksum path, validates its regulatory root, retains bytes under
their SHA-256 and commits the artifact reference plus receipt to the matching discovery row. A crash after the file is
complete but before the database commit reuses and revalidates the retained file. The artifact root comes from
`REGULATORY_ARTIFACT_DIRECTORY`; deployment still requires a verified shared durable mount or object-store adapter.

`regulatory-discovery-parsing` reloads an acquired unit and its receipt, revalidates the retained artifact, invokes the
same bounded Python parser used by historical backfills and commits the parser hash, normalized generation, locator and
summary only after every shard passes TypeScript validation. Retry revalidates and reuses the deterministic generation.
The normalized root comes from `REGULATORY_NORMALIZED_DIRECTORY`.

`regulatory-discovery-publication` accepts one parsed current eCFR identity. It revalidates the immutable current
manifest, receipt, retained source artifact and normalized shards before using the same leased canonical staging,
materialization and compare-and-swap publication transaction as historical imports. Only a published canonical
generation and edition can advance the discovery row to `published`; the row retains both identities for completion
accounting. Replay verifies the complete canonical edition and returns the same identities. Publication emits the
existing lexical outbox item but does not submit preparation, copying or embeddings. The worker is manual, limited to
two concurrent publications and has no recurring schedule.

`regulatory-discovery-controller` is the manual bounded fan-out entry point. It first registers at most 100 pending
units, then selects a keyset page of at most 100 units whose committed state is `registered`, `acquired` or `parsed`.
Those states map respectively to acquisition, parsing and publication. The controller persists every stage intent before
the first Trigger submission, submits serially to bound SDK calls, and uses a stable global idempotency key with a
seven-day retention window. Each intent retains its immutable manifest/unit payload, stage, attempt time, lease and run
ID. An uncertain submission keeps the original identity for retry or later disposition reconciliation; the controller
never assumes that a missing response means Trigger rejected the child. Re-running after workers commit state creates
only the next-stage intent. Pagination exposes the last unit key and exhaustion rather than loading a national scope.

The discovery-unit and current-manifest contracts require `historical: false`; the existing acquisition/backfill
contract remains strictly `historical: true`. Keeping these schemas separate prevents recurring observations from
silently becoming completed backfill coverage. Trigger run-disposition recovery, deployed shared artifact/normalized
storage, downstream completion accounting and scheduled cadence are separate gates.
