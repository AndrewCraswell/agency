import { sql, type SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import type pg from "pg"
import { z } from "zod"
import {
  collectRankedAmendments,
  rankedSectionPageQuery,
  type RankedSectionFilters
} from "../src/search/ranked-section-search.js"

const dialect = new PgDialect()
const hits = z.array(z.object({ id: z.string(), document_id: z.string(), score: z.number() }))
const plans = z.array(z.object({ "QUERY PLAN": z.array(z.object({ "Execution Time": z.number() }).passthrough()) }))
type Scenario = { name: string; query: string; filters?: RankedSectionFilters }

/** Same eligibility and exact grouping as the ranked candidate stage, not an API benchmark. */
export function nativeBenchmarkQuery(scenario: Scenario, amendmentsOnly: boolean, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("Invalid benchmark limit")
  }
  const query = sql`websearch_to_tsquery('english', ${scenario.query})`
  const filters: SQL[] = [sql`search_metadata @> '{"processingStatus":"processed"}'::jsonb`]
  if (amendmentsOnly) {
    filters.push(sql`search_metadata @> '{"documentClassifications":["amendment"]}'::jsonb`)
  }
  // Benchmark scenarios intentionally use only this explicitly supported filter.
  if (scenario.filters !== undefined) {
    const parsed = z
      .object({ any: z.object({ jurisdictionIds: z.array(z.string()) }).strict() })
      .strict()
      .parse(scenario.filters)
    filters.push(
      parsed.any.jurisdictionIds.length === 0
        ? sql`false`
        : sql`(${sql.join(
            parsed.any.jurisdictionIds.map(
              (value) => sql`search_metadata @> ${JSON.stringify({ jurisdictionIds: [value] })}::jsonb`
            ),
            sql` or `
          )})`
    )
  }
  const bodyMatch = sql`benchmark_body_vector @@ ${query}`
  const titleMatch = sql`benchmark_title_vector @@ ${query}`
  const score = amendmentsOnly
    ? sql`ts_rank_cd(benchmark_body_vector,${query}) + ts_rank_cd(benchmark_title_vector,${query})`
    : sql`ts_rank_cd(benchmark_body_vector,${query})`
  filters.push(amendmentsOnly ? sql`(${bodyMatch} or ${titleMatch})` : bodyMatch)
  if (amendmentsOnly) {
    return sql`with best as (
      select distinct on (document_id collate "C") id,document_id,${score} as score
      from legislation.document_sections where ${sql.join(filters, sql` and `)}
      order by document_id collate "C",score desc,id collate "C"
    ) select id,document_id,score from best order by score desc,document_id collate "C",id collate "C" limit ${limit}`
  }
  return sql`select id,document_id,${score} as score from legislation.document_sections
    where ${sql.join(filters, sql` and `)} order by score desc,id collate "C" limit ${limit}`
}

export function benchmarkMedian(values: readonly number[]) {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Finite timing observations required")
  }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

export async function runPairedTextIndexBenchmark(
  client: pg.Client,
  sampleRows: number,
  report: (line: string) => void
) {
  const scopeCounts = z
    .array(z.object({ jurisdiction: z.string(), scoped_rows: z.number(), total_rows: z.number() }))
    .parse(
      (
        await client.query(
          `select search_metadata->'jurisdictionIds'->>0 jurisdiction,count(*)::int scoped_rows,
        (sum(count(*)) over())::int total_rows from legislation.document_sections
     where search_metadata->>'processingStatus'='processed' and search_metadata->'jurisdictionIds'->>0 is not null
     group by 1 order by count(*) desc,1 limit 1`
        )
      ).rows
    )[0]
  const scope = scopeCounts?.jurisdiction
  const scenarios: Scenario[] = [
    { name: "broad-legislation", query: "legislation" },
    { name: "broad-health", query: "health" },
    { name: "broad-tax", query: "tax" },
    { name: "phrase", query: '"health insurance"' },
    ...(scope === undefined
      ? []
      : [{ name: "scoped-health", query: "health", filters: { any: { jurisdictionIds: [scope] } } }])
  ]
  report(
    JSON.stringify({
      benchmark: "paired-candidate-stage",
      sampleRows,
      repetitions: 5,
      cache: "warm; repeated alternating execution; no cache flush",
      ranking: "native ts_rank_cd versus ranked BM25, not score/result identity",
      scope: scope ?? null,
      scopeCounts: scopeCounts ?? null,
      scopedShareOfProcessedRowsWithJurisdiction:
        scopeCounts === undefined ? null : scopeCounts.scoped_rows / scopeCounts.total_rows
    })
  )
  for (const scenario of scenarios) {
    for (const amendmentsOnly of [false, true]) {
      const measurements: {
        engine: string
        repeat: number
        wallMs: number
        serverMs: number
        rows: number
        batches: number
        executionPlans?: unknown[]
        error?: string
      }[] = []
      for (let repeat = 0; repeat < 5; repeat++) {
        for (const engine of repeat % 2 === 0 ? ["native", "ranked"] : ["ranked", "native"]) {
          await client.query("savepoint paired_measurement")
          let wallMs = 0
          let serverMs = 0
          let batches = 0
          const started = performance.now()
          const statements: ReturnType<typeof dialect.sqlToQuery>[] = []
          const executionPlans: unknown[] = []
          try {
            const execute = async (statement: ReturnType<typeof dialect.sqlToQuery>) => {
              const remaining = Math.floor(15000 - (performance.now() - started))
              if (remaining <= 0) {
                throw new Error("Candidate measurement exceeded 15-second deadline")
              }
              await client.query("select set_config('statement_timeout',$1,true)", [`${remaining}ms`])
              statements.push(statement)
              batches += 1
              return hits.parse((await client.query(statement.sql, statement.params)).rows)
            }
            let result: z.infer<typeof hits>
            if (engine === "native") {
              result = await execute(dialect.sqlToQuery(nativeBenchmarkQuery(scenario, amendmentsOnly, 21)))
            } else if (amendmentsOnly) {
              result = await collectRankedAmendments(
                (offset, limit) =>
                  execute(dialect.sqlToQuery(rankedSectionPageQuery({ ...scenario, amendmentsOnly, offset, limit }))),
                21
              )
            } else {
              result = await execute(dialect.sqlToQuery(rankedSectionPageQuery({ ...scenario, limit: 21 })))
            }
            wallMs = performance.now() - started
            if (wallMs >= 15000) {
              throw new Error("Candidate measurement exceeded 15-second deadline")
            }
            // Separate diagnostic pass, not folded into actual request wall time.
            const explainStarted = performance.now()
            for (const statement of statements) {
              const remaining = Math.floor(15000 - (performance.now() - explainStarted))
              if (remaining <= 0) {
                throw new Error("Explain measurement exceeded 15-second deadline")
              }
              await client.query("select set_config('statement_timeout',$1,true)", [`${remaining}ms`])
              const raw = await client.query(`explain (analyze,buffers,format json) ${statement.sql}`, statement.params)
              const plan = plans.parse(raw.rows)[0]?.["QUERY PLAN"][0]
              if (plan === undefined) {
                throw new Error("Missing benchmark execution plan")
              }
              if (engine === "ranked") {
                const serialized = JSON.stringify(plan)
                if (!serialized.includes("TopKScanExecState") || serialized.includes("heap_filter")) {
                  throw new Error("Ranked benchmark lost indexed top-K or filter pushdown")
                }
              }
              serverMs += plan["Execution Time"]
              executionPlans.push(plan)
            }
            measurements.push({ engine, repeat, wallMs, serverMs, rows: result.length, batches, executionPlans })
          } catch (error) {
            measurements.push({
              engine,
              repeat,
              wallMs: wallMs || performance.now() - started,
              serverMs,
              rows: 0,
              batches,
              error: error instanceof Error ? error.message : "Unknown benchmark error"
            })
          } finally {
            await client.query("rollback to savepoint paired_measurement")
            await client.query("release savepoint paired_measurement")
          }
        }
      }
      report(
        JSON.stringify({
          scenario,
          amendmentsOnly,
          stage: "candidate IDs and scores only; no API hydration/network/auth",
          measurements,
          summaries: ["native", "ranked"].map((engine) => {
            const successful = measurements.filter((row) => row.engine === engine && row.error === undefined)
            return {
              engine,
              successful: successful.length,
              failures: 5 - successful.length,
              medianWallMs: successful.length === 0 ? null : benchmarkMedian(successful.map((row) => row.wallMs)),
              minWallMs: successful.length === 0 ? null : Math.min(...successful.map((row) => row.wallMs)),
              maxWallMs: successful.length === 0 ? null : Math.max(...successful.map((row) => row.wallMs)),
              medianServerMs: successful.length === 0 ? null : benchmarkMedian(successful.map((row) => row.serverMs)),
              minServerMs: successful.length === 0 ? null : Math.min(...successful.map((row) => row.serverMs)),
              maxServerMs: successful.length === 0 ? null : Math.max(...successful.map((row) => row.serverMs))
            }
          })
        })
      )
    }
  }
}
