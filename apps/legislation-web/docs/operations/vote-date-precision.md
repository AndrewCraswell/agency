# Vote date precision

The public vote contract retains `date` and nullable `heldAt`. A reported calendar date is stored in
`votes.held_date`; it does not create an exact instant. Exact source timestamps retain `held_at` and the existing UTC
reporting date. Missing or invalid date evidence cannot satisfy canonical completeness. Source provenance, result,
counts and sequence requirements are unchanged.

## Ordering and filtering

Vote readers use an internal UTC midnight anchor for date-only rows solely to establish deterministic ordering and
opaque cursor boundaries. This anchor is not returned as `heldAt` or timeline `occurredAt`. Date-only votes sort before
known later instants on that reporting date; the order does not assert which event actually happened first.

Date bounds compare calendar days. Timestamp bounds continue exact comparisons for exact-time votes; date-only votes
are conservatively included when their reporting date overlaps the boundary's UTC reporting day. A midday query can
therefore return a date-only vote from that day with `heldAt: null`: it is a possible match, not proof of a midday vote.
Clients requiring exact-time results must exclude null `heldAt`. Bounds must not discard unknown-time votes based on
the internal midnight ordering anchor.

## Verification and rollout

`vote-occurrence.integration.test.ts` verifies real PostgreSQL mixed-precision pagination in both directions and
whole-day/midday filters. Set `VOTE_DATE_TEST_DATABASE_URL` to an explicitly isolated local database named
`legislation_vote_date_*`; the suite rejects non-local targets and rolls its inserted facts back. Apply C migrations
to the disposable database first.

The updated original migration baseline covers fresh databases, not upgrades of already-recorded migrations. Before
deploying readers or producers to an existing database, explicitly reconcile the new nullable column and completeness
constraint, verify schema readiness, and check query plans/index coverage under realistic data volume. Do not run new
readers against the old production schema. Original vote rows stay incomplete until source-verified re-ingestion.

Deployment, full-corpus performance, journal replay and authenticated API/MCP acceptance remain independent gates.
