# Database connection pooling

Production Trigger.dev work reaches the Railway PostgreSQL 18 and pgvector service through a dedicated PgBouncer
service. PgBouncer absorbs short-lived worker connections and multiplexes their transactions onto a bounded set of
PostgreSQL backends. The direct PostgreSQL URL remains the migration, administration, and rollback path; application
workers use the pooled URL after their deployment has passed the compatibility canary.

## Recorded Railway configuration

This is deployment/canary evidence, not a fresh live inspection. Verify `SHOW CONFIG` and current direct-worker load
before changing limits. The [embedding rebuild hold](../../../../apps/legislation-ingestion/docs/engineering/embedding-rollout-plan.md) still applies; capacity
instructions do not authorize a new paid pass.

| Setting | Value |
| --- | --- |
| Railway project | `legislation` (`2378281c-c1c7-4530-8525-5f313741d19b`) |
| Environment | `production` (`9657912c-7bf8-4ec7-a9c5-387bf3df790d`) |
| PostgreSQL service | `pgvector` |
| PgBouncer service | `pgbouncer` (`1f607930-dfe4-4f02-903e-6435efb878fd`) |
| Image | `edoburu/pgbouncer:v1.25.2-p0` |
| Pool mode | `transaction` |
| Client ceiling | 500 |
| PostgreSQL backend ceiling | 20 for initial/direct-worker coexistence; later accepted pooled stage 60 |
| Minimum warm backends | 0 |
| Idle backend release | 30 seconds |
| Prepared-statement cache | 100 statements |
| Authentication | SCRAM-SHA-256 |

The PgBouncer service connects to `${{pgvector.DATABASE_URL_PRIVATE}}` over Railway private networking. Trigger.dev
uses the PgBouncer TCP proxy. Never commit either public connection URL or its password.

## Evidence and capacity policy

The production smoke test verified ordinary queries, explicit transactions, and repeated named prepared statements.
A bounded read-only test then completed 200 concurrent client transactions through a 20-backend pool. Client p95 was
about 2.0 seconds, and PostgreSQL peaked at 86 sessions while 66 older workers were still connected directly. The
pooler released its idle backends after the test.

The original 20-backend ceiling was intentionally conservative. The pooled 68-worker baseline then showed 43 waiting
clients and a maximum wait above three seconds while PostgreSQL itself remained below 30 sessions. The controlled
canary therefore raised both `default_pool_size` and `max_db_connections` to 60. Embedding workers spend most of their
lifetime calling the model provider and hold a database transaction only while selecting or persisting a bounded batch,
so more Trigger workers still do not require one PostgreSQL backend each.

I owns the [staged concurrency procedure and measurement table](../../../../apps/legislation-ingestion/docs/operations/worker-capacity.md).
W owns [serving pools and transaction-local deadlines](../../../../apps/legislation-web/docs/operations/development.md#development-chat-research-connection).
Budget direct W clients, administration, search targets and I pooled backends together. M has no database connections.
Per-process pool limits never establish aggregate capacity across replicas or tasks.

Research pools opt into cancellable FIFO admission through `createDatabase({ ... }, { waitForConnection: true })`.
`withReadOnlyDatabase` waits for that capacity before calling the driver, so its finite connection-establishment timer
does not charge normal queueing. Other pool consumers retain their existing acquisition behavior.
`createReadOnlyDatabase` implements Drizzle's session/prepared-query boundary with the normal node-postgres driver:
each SQL execution gets a read-only transaction with local deadlines and driver row mapping; an explicit transaction
pins a single connection, including nested savepoints. Network/model work outside those transactions holds no connection.
Cancellation removes an admission waiter or discards an active client; server-side statement deadlines remain the final
execution bound after disconnect. Neither helper changes live PostgreSQL or PgBouncer capacity.

Inspect PgBouncer clients and waits, PostgreSQL sessions and locks, query latency, Trigger failures, and provider
throttling throughout each stage.
Stop or scale back when any of these conditions holds:

- PostgreSQL reaches 80 total sessions for a sustained interval;
- PgBouncer clients wait for a backend for more than five seconds at p95;
- database lock waits or transaction latency regress materially;
- OpenRouter returns sustained throttling or provider errors; or
- Trigger workers report database acquisition, lease-heartbeat, or timeout failures.

Do not run a second unpooled high-concurrency campaign during the canary. During a transition, keep PgBouncer at the
20-backend coexistence ceiling until the older direct workers are terminal.

## Operations

Use Railway deployment status and bounded logs to verify the pooler. Connect to the `pgbouncer` administrative database
with the PostgreSQL user to inspect `SHOW POOLS`, `SHOW STATS`, and `SHOW CONFIG`. The direct database URL is reserved
for migrations and emergency rollback. Before returning workers to the direct URL, stop admission, settle existing work
and reduce worker/pool fan-out to the measured direct-database allowance. The pooled 128-worker ceiling is not safe merely
because the connection URL changed. Rollback does not require deleting either Railway service.
