# Database performance

Use PostgreSQL statistics to find expensive query fingerprints before inspecting application code. Sentry route spans
show user impact, while `pg_stat_statements` shows database cost and frequency.

## Read query statistics

The collector never returns SQL text or parameters. It reports PostgreSQL query IDs and numeric execution, planning,
buffer, temporary-file, I/O, row and WAL counters.

```powershell
pnpm --filter @repo/legislation-core db:query-stats -- --database=canonical --sort=total --limit=25
pnpm --filter @repo/legislation-core db:query-stats -- --database=passage-search --sort=mean --limit=25
```

Use `DATABASE_DIRECT_URL`, `DATABASE_PUBLIC_URL` or `DATABASE_URL` for the canonical database. Use
`PASSAGE_SEARCH_DATABASE_PUBLIC_URL` or `PASSAGE_SEARCH_DATABASE_URL` for the passage-search database. The generic
Railway variables remain fallbacks so the command also works with `railway run` against a database service. Run against
a direct PostgreSQL endpoint rather than PgBouncer when possible.

The supported sort modes are:

- `total`: queries consuming the most aggregate execution time.
- `mean`: queries with the highest average latency.
- `calls`: most frequently executed queries.

`statsReset` defines the beginning of the measurement window. PostgreSQL statistics are cumulative, so do not describe
them as a fixed recent interval unless the reset time establishes that interval. If `trackIoTiming` is false, block I/O
timings remain zero and must not be interpreted as evidence that no I/O occurred.

## Correlate application operations

Critical search and timeline database operations emit `db.query` spans with stable names and integer revisions. Query
spans include the pool name, result count, duration, connection-wait duration and bounded pool snapshots before, during
and after execution. Use these names to find the owning implementation:

- `bill.search.lexical` and `bill.search.semantic`
- `passage.search.lexical` and `passage.search.semantic`
- `supporting_material.search.lexical` and `supporting_material.search.semantic`
- `bill.timeline`

The Sentry privacy projection retains only these allowlisted identities and numeric measurements. It continues to remove
raw `db.statement` text and parameters.

## Enable statistics on Railway

`pg_stat_statements` must be preloaded and installed in each database. Enabling it can restart the database and briefly
interrupt traffic. The Railway database tool requires interactive confirmation and must be run by an operator:

```powershell
python "$HOME\.copilot\skills\use-railway\scripts\enable-pg-stats.py" --service pgvector
python "$HOME\.copilot\skills\use-railway\scripts\enable-pg-stats.py" --service legislation-passage-search
```

Afterward, run the collector for both databases. Do not enable `auto_explain` globally or log raw statements because
query parameters can contain private research input.

## AI investigation workflow

1. Rank fingerprints by total time, mean time and calls.
2. Correlate a fingerprint with its privacy-safe application query identity.
3. Use the guarded plan-diagnostics workflow for that registered query.
4. Compare the plan, result identity and ordering before and after a change.
5. Keep schema and index changes under human review.

Never provide an AI agent with database credentials, raw statement parameters, embeddings or unrestricted SQL access.
