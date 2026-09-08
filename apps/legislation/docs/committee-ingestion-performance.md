# Committee ingestion performance and timeout policy

The committee snapshot writer batches change tracking in groups of 250 records. Each changed batch performs
one fingerprint read and two bulk writes, using the source fields already supplied to the snapshot writer.
Event identity, before/after planning, unchanged detection and checkpoint atomicity remain unchanged.
For 3,856 new memberships, tracking now requires 48 statements rather than approximately 15,424.
This is a statement-count reduction, not a measured production speedup.

Two pending editions may download/normalize concurrently. All pending editions must pass validation before
publication begins, and results are applied in issue order regardless of preparation completion order.
Current sync and historical backfill share the `govinfo-committee-publication` queue at concurrency one.
Cross-Congress publication fan-out remains disabled until live timings and shared-record safety are validated.

Both committee Trigger tasks have a 24-hour outer limit instead of one hour. Each snapshot transaction sets
PostgreSQL-local limits: 60 seconds per statement, 10 seconds waiting on a lock, and 120 seconds idle in transaction.
These settings do not leak into pooled connections. Database errors propagate and roll back the snapshot and
its checkpoint together. A retry resumes from committed edition checkpoints; no destructive restart is used.
No finite timeout guarantees arbitrary outages will succeed: the goal is bounded failure with safe recovery,
not leaving a stalled database operation running for 24 hours.

The existing 108th timeout must be inspected in PostgreSQL before another run is dispatched. A Trigger timeout
alone does not establish whether a database transaction remains active or which edition checkpoint committed.
The new limits apply only to new executions; they do not change the already-timed-out execution.

Acceptance: focused tests cover batch statement counts, deterministic events, unchanged batches, duplicate rejection,
database error propagation, and out-of-order preparation followed by ordered publication. Production acceptance
still requires database access, a measured import, unchanged rerun, and current-Congress preservation checks.
