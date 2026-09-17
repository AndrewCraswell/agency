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

The discovery-unit and current-manifest contracts require `historical: false`; the existing acquisition/backfill
contract remains strictly `historical: true`. Keeping these schemas separate prevents recurring observations from
silently becoming completed backfill coverage. Artifact acquisition, deployed verification, completion accounting and
scheduled cadence are separate gates.
