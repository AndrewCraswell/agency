# Worker concurrency and pool budgets

I's worker budget is subordinate to [C's aggregate database capacity and historical PgBouncer evidence](../../../../packages/legislation-core/docs/operations/database-connection-pooling.md).
W owns serving pools/deadlines. M has no database pool. The [embedding rebuild hold](../engineering/embedding-rollout-plan.md)
still applies: this procedure does not authorize a paid pass or concurrency change.

## Pooled embedding canary

Scale only an approved embedding canary through 128, 160 and 200 tasks. The first measured stage and intended steady
state are 128. Use the same product/input contract for ten minutes per stage, discarding the first warm-up minute and
comparing the remaining nine. A safety breach ends the stage immediately.

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

Report absolute throughput, speedup from the preceding measured stage and scaling efficiency (throughput speedup
divided by concurrency increase). Promote only with at least 10 percent throughput gain, at least 60 percent scaling
efficiency and no safety regression. Below 10 percent gain is saturation even with spare task capacity.

160 and 200 are temporary benchmark stages. Restore 128 afterward even if throughput improves, reserving 72 of the
project's 200 ordinary slots for recurring Congress/state synchronization, OCR and repairs. Routine expansion requires
an explicit maintenance window or separate concurrency allocation. Task concurrency is not database connections:
128 tasks remain behind the recorded 500-client admission and 60-backend ceiling, without changing pooler settings.

Bills, amendments, document and material sections have different input/persistence costs; record a separate curve per
product. Inspect clients/waits, sessions/locks, query latency, task failures and throttling throughout. Stop or scale
back at C's session/pool-wait/transaction safety gates, sustained provider throttling/errors, or worker acquisition,
lease-heartbeat and timeout failures. Do not run a competing unpooled campaign.

## Runtime limits

Embedding shard workers reserve two local PgBouncer clients, one for batch selection/persistence and one for renewable
lease heartbeat. That does not raise the shared PostgreSQL backend ceiling. A single busy connection can lose its lease;
replacement must resume from checkpoints, not change partitioning or duplicate vectors. Full recreation uses the
sequential 128-shard product coordinator documented in the rollout plan, subject to the deferred rebuild restriction.

Before returning workers to a direct database URL, stop admission, settle in-flight work and reduce fanout to the
measured direct allowance. The pooled 128-task ceiling is not safe merely because the URL changed. C owns pooler
administration and rollback facts. No new capacity canary was run for this documentation move.