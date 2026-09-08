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

A Trigger timeout alone does not establish whether a database transaction remains active or which edition
checkpoint committed. Check PostgreSQL before dispatching a replacement. The new limits apply only to new
executions; they do not change an already-timed-out execution.

Acceptance: focused tests cover batch statement counts, deterministic events, unchanged batches, duplicate rejection,
database error propagation, and out-of-order preparation followed by ordered publication. Production acceptance
requires a measured import, unchanged rerun, and current-Congress preservation checks; these passed below.

## Release evidence

Implementation `eb2c281` is committed and pushed to main. Trigger deployment `w5qf9huj`, version `20260908.4`,
completed successfully. Focused verification passed 36 tests; legislation coverage passed 2,299 tests in 248 files
and four receiver tests. Sixty database-dependent tests remain skipped. Types and lint pass. Root `pnpm verify`
passes the check stage but fails unrelated scoring coverage thresholds; the repository-wide gate is not green.

Initial recovery was blocked by database connection timeouts. Connectivity later recovered without configuration
changes; PostgreSQL confirmed no orphan transaction and the November 2003 checkpoint. The resumed 108th import
completed in 162 seconds, advanced through August 2004 and passed a zero-write rerun. Subsequent 105th and 109th
imports completed in 82 and 88 seconds, respectively, and passed zero-write reruns. Current membership and active
organization fingerprints were preserved. See the exact run IDs in [rollout evidence](committee-membership-history.md).
These are successful live runs, not a controlled old/new benchmark or a guarantee against future network failures.

The subsequent reviewed-identity release `20260908.5` (`mts2zctp`) imported all three 106th editions in 179 seconds
wall time and both 107th editions in 90 seconds, each on its first attempt. Their unchanged reruns completed in
82 and 55 seconds with zero writes. Full historical membership-row hashes and the current-Congress hash were
preserved. This confirms the bounded pipeline on both newly reconciled Congresses; it does not guarantee
success through arbitrary upstream outages. Exact run IDs and source/database checks are in the rollout evidence.
