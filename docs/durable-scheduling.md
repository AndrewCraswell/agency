# Durable workflow scheduling

Workflow schedules execute in the control-plane worker. Browsers only read and update schedule status.

## Persistence

Each schedule stores its identity, workflow and immutable version, trigger node, enabled state, interval or expression,
timezone, next run, last attempt, last success, lease owner and expiry, failure details, and optimistic revision.
Publishing remains the source definition. Workers synchronize active published schedule definitions into this table.

A definition has exactly one timing mode:

- an interval from 10 through 86,400 seconds; or
- a CRON expression evaluated by `cron-parser` in the persisted IANA timezone.

Publication rejects ambiguous definitions, invalid CRON syntax, and unknown timezones. CRON calculation uses the
schedule identity as its hash seed, so hashed fields remain stable across workers and restarts.

## Dispatch and leases

On each worker tick:

1. Synchronize active published definitions.
2. Atomically claim due rows whose lease is absent or expired.
3. Start the active version with a key composed from schedule identity and persisted due time.
4. On success, clear the lease and advance to the next interval or timezone-aware CRON occurrence from the current time.
5. On failure, persist the error, clear the lease, and retain the due time for retry with the same idempotency key.

The journal request digest is the final duplicate defense. Competing workers can inspect the same candidate, but only the
revision-matched lease update wins.

## Misfire policy

After downtime, one overdue occurrence is dispatched. A successful dispatch advances from the current time, so the
system does not burst every missed interval. Disabled schedules are never claimed. Expired leases are reclaimable after
a worker restart.

`GET /api/workflows/schedules` reports health and last/next run state. `PATCH /api/workflows/schedules/:scheduleId`
updates enabled state and the complete interval-or-CRON definition using `expectedRevision` optimistic concurrency.