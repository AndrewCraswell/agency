# Database performance

Use PostgreSQL statistics to find expensive query fingerprints before inspecting application code. Sentry route spans
show user impact, while `pg_stat_statements` shows database cost and frequency.

## Read query statistics

The collector never returns SQL text or parameters. It reports PostgreSQL query IDs and numeric execution, planning,
buffer, temporary-file, I/O, row and WAL counters.

```powershell
pnpm --filter @repo/legislation-core db:query-stats --database=canonical --sort=total --limit=25
pnpm --filter @repo/legislation-core db:query-stats --database=passage-search --sort=mean --limit=25
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

### Guarded plan diagnostics

The plan command accepts only repository-registered query names and sanitized fixtures. It does not accept SQL or
free-form parameter values. Each run uses a read-only transaction, a one-second lock timeout, a statement timeout from
1 through 30 seconds, a 200-node plan limit and a 256 KB sanitized report limit. Reports exclude SQL text, parameters,
filter expressions and result rows. The plan runs before result hashing so the digest query does not warm the plan's
cache. An ordered SHA-256 result digest supports before-and-after equivalence checks.

The initial registry entry maps observed PostgreSQL query ID `1328274108816803535` to
`supporting_material.search.lexical` and its source query builder. Run its approved fixture locally through Railway's
public database endpoint:

```powershell
railway run --service pgvector pnpm --filter legislation-web db:query-plan --query=supporting_material.search.lexical --fixture=student-data --timeout-ms=20000 --allow-production
```

`--allow-production` is required when Railway reports the environment as production. It authorizes only the registered,
bounded, read-only diagnostic; it does not enable arbitrary SQL or schema changes.

The `bill.search.lexical` query also accepts the `career-technical-california` fixture: the public phrase
`work-based learning`, California, introductions from January 1, 2025 through September 18, 2026. It exercises
the exact bounded bill-candidate builder without embedding or reranking calls. Use the same `db:query-plan`
command with those query and fixture names. A successful warm-cache plan does not disprove a timeout through
the application path; compare connection wait, database settings, and cold-cache behavior separately.

The `school-vouchers-federal` fixture uses `education savings account`, Congress 119, and an introduction
cutoff of September 18, 2026. Lexical candidate selection retains section vectors instead of rereading them
for ranking. Result hydration selects one highest-ranked matching section per bill before generating its
headline, rather than generating headlines for every match and retaining the lexicographically smallest.
Candidate IDs and ranking are unchanged; preview snippets may differ. Neither change increases query deadlines
or removes scope filters. Compare the candidate digest separately from snippet content and end-to-end latency.

Supporting-material lexical searches with explicit bill IDs materialize the eligible parent materials first,
including all relationship, session, date, status and jurisdiction filters. Their section lookup is constrained
to those parents before the existing deterministic section sample and ranking. Unscoped searches retain the
original indexed corpus path; both paths retain the same coverage flags and page limits.

### Supporting-material title-search baseline

The `student-data` fixture exposed a parallel sequential scan over supporting-material titles. Its baseline plan took
854.7 ms and read 34,439 shared blocks; cumulative query statistics showed a 4,045.9 ms mean and 13,264.3 ms maximum
over seven calls. A matching expression GIN index replaced the title scan with a bitmap index scan. The guarded
post-change plan took 371.8 ms and read 4,325 shared blocks. Both plans returned six rows with ordered digest
`sha256:a92d57092737b7f84be848aa8311c1e926caf610082d114309cf0d6da72cb6fa`.
