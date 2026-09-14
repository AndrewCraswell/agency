# Database connection pooling

Production Trigger.dev work reaches the Railway PostgreSQL 18 and pgvector service through a dedicated PgBouncer
service. PgBouncer absorbs short-lived worker connections and multiplexes their transactions onto a bounded set of
PostgreSQL backends. The direct PostgreSQL URL remains the migration, administration, and rollback path; application
workers use the pooled URL after their deployment has passed the compatibility canary.

## Live Railway contract

| Setting | Value |
| --- | --- |
| Railway project | `legislation` (`2378281c-c1c7-4530-8525-5f313741d19b`) |
| Environment | `production` (`9657912c-7bf8-4ec7-a9c5-387bf3df790d`) |
| PostgreSQL service | `pgvector` |
| PgBouncer service | `pgbouncer` (`1f607930-dfe4-4f02-903e-6435efb878fd`) |
| Image | `edoburu/pgbouncer:v1.25.2-p0` |
| Pool mode | `transaction` |
| Client ceiling | 500 |
| PostgreSQL backend ceiling | 20 |
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

Scale the pooled embedding deployment through 128, 160, and 200 workers. The 128-worker stage is both the first measured
stage and the intended steady state. Run each stage against the same embedding product and input contract for 10
minutes. Treat the first minute as warm-up and calculate comparative throughput from the remaining nine minutes. A
safety-gate breach ends the stage immediately. Capture the following measurements for every stage:

| Measurement | Why it matters |
| --- | --- |
| Completed vectors per minute | Primary end-to-end speed measurement |
| Scanned and skipped records per minute | Separates database traversal from paid model work |
| Trigger task starts, successes, retries, and failures | Detects orchestration overhead and instability |
| Embedding-request p50 and p95 latency | Identifies provider saturation |
| PgBouncer active clients, waiting clients, and maximum wait | Identifies pool saturation |
| PostgreSQL total and active sessions, lock waits, and query latency | Protects database health |
| Provider 429, 5xx, and timeout counts | Prevents apparent speedups caused by retry churn |
| Input tokens and estimated cost per 1,000 successful vectors | Confirms concurrency does not change unit economics |

For each stage, report absolute throughput, speedup versus the preceding measured stage, and scaling efficiency:
`throughput speedup / concurrency increase`. Promote when completed-vector throughput improves by at least 10 percent,
scaling efficiency remains at least 60 percent, and none of the safety gates below regress. Stop increasing when a
stage improves throughput by less than 10 percent; that is the measured saturation point even if Trigger still has
unused task capacity.

The 160- and 200-worker stages are temporary benchmark stages only. After the curve is measured, restore the embedding
queue to a steady-state ceiling of 128 Trigger tasks even if throughput continues to improve at 160 or 200. This leaves
72 of the project's 200 ordinary concurrency slots available for recurring Congress and state synchronization, OCR,
and operational repairs. A future decision to exceed 128 for routine embedding work requires an explicit maintenance
window or a separate Trigger concurrency allocation; it is not implied by a successful benchmark.

Do not confuse Trigger task concurrency with PostgreSQL connections. The steady-state 128-task ceiling remains behind
PgBouncer's 500-client admission limit and 60-backend database ceiling. Returning from the benchmark to 128 tasks does
not require changing either PgBouncer setting.

Do not compare different products directly. Bills, amendments, document sections, and supporting-material sections use
different input lengths, model routes, and persistence costs. Record a separate concurrency curve for every product
that is expected to run at the higher ceiling.

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
for migrations and emergency rollback. A rollback changes the Trigger.dev `DATABASE_URL` back to the direct URL and
does not require changing or deleting either Railway service.
