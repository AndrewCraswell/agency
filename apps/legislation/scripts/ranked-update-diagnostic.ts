import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { setTimeout } from "node:timers/promises"
import { PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { z } from "zod"
import { rankedSectionPageQuery } from "../src/search/ranked-section-search.js"
import { benchmarkMedian, nativeBenchmarkQuery, runPairedTextIndexBenchmark } from "./paired-text-index-benchmark.js"

const dialect = new PgDialect()
const planSchema = z.array(
  z.object({ "QUERY PLAN": z.array(z.object({ "Execution Time": z.number() }).passthrough()) })
)

export function diagnosticPlan(raw: unknown, engine: string) {
  const plan = planSchema.parse(raw)[0]?.["QUERY PLAN"][0]
  assert.ok(plan, "Missing diagnostic execution plan")
  if (engine === "ranked") {
    const serialized = JSON.stringify(plan)
    assert.ok(
      serialized.includes("TopKScanExecState") && !serialized.includes("heap_filter"),
      "Ranked diagnostic lost indexed top-K or filter pushdown"
    )
  }
  return plan
}

/** Caller owns the disposable schema and cleanup; every auxiliary connection verifies its database. */
export async function diagnoseRankedUpdates(
  client: pg.Client,
  connectionString: string,
  report: (line: string) => void
) {
  assert.equal((await client.query("select current_database() name")).rows[0]?.name, "legislation_search_benchmark")
  await client.query("set statement_timeout=15000")
  await client.query("set work_mem='4MB'")
  await client.query("set max_parallel_workers_per_gather=2")
  const settings = await client.query("select name,setting from pg_settings where name like 'paradedb.%' order by name")
  report(JSON.stringify({ diagnosticSettings: settings.rows }))
  const idRows = z.array(z.object({ id: z.string() }))
  const verifyUpdatedAt = async (epoch: number, phase: string, expectedCount?: number) => {
    const native = idRows.parse(
      (
        await client.query(
          `select id from legislation.document_sections
          where (search_metadata->>'updatedAt')::numeric=$1 order by id collate "C"`,
          [epoch]
        )
      ).rows
    )
    const ranked = idRows.parse(
      (
        await client.query(
          `select id from legislation.document_sections
          where id @@@ pdb.parse($1,lenient=>false,conjunction_mode=>true) order by id collate "C"`,
          [`search_metadata.updatedAt:>=${epoch} AND search_metadata.updatedAt:<=${epoch}`]
        )
      ).rows
    )
    assert.deepEqual(ranked, native, `Stale or missing updatedAt index entries in ${phase} for ${epoch}`)
    if (expectedCount !== undefined) {
      assert.equal(native.length, expectedCount, `Unexpected updatedAt eligibility in ${phase}`)
    }
    report(
      JSON.stringify({
        diagnosticEligibility: phase,
        epoch,
        nativeCount: native.length,
        rankedCount: ranked.length,
        exactIdsMatch: true
      })
    )
  }

  const measure = async (reader: pg.Client, phase: string) => {
    for (const query of ["legislation", "health", "tax", '"health insurance"']) {
      for (const engine of ["native", "ranked"]) {
        const statement = dialect.sqlToQuery(
          engine === "ranked"
            ? rankedSectionPageQuery({ query, limit: 21 })
            : nativeBenchmarkQuery({ name: query, query }, false, 21)
        )
        const observations = []
        for (let repeat = 0; repeat < 3; repeat++) {
          const started = performance.now()
          const raw = await reader.query(`explain (analyze,buffers,format json) ${statement.sql}`, statement.params)
          const plan = diagnosticPlan(raw.rows, engine)
          observations.push({ serverMs: plan["Execution Time"], explainWallMs: performance.now() - started, plan })
        }
        report(
          JSON.stringify({
            diagnosticPhase: phase,
            query,
            engine,
            medianServerMs: benchmarkMedian(observations.map((row) => row.serverMs)),
            observations
          })
        )
      }
    }
  }
  // No transaction spans these calls: distinguish the previous long RR snapshot from index state.
  await measure(client, "fresh-statement-snapshots-after-updates")
  for (let elapsed = 30; elapsed <= 120; elapsed += 30) {
    await setTimeout(30000)
    report(JSON.stringify({ backgroundMaintenanceWaitSeconds: elapsed }))
  }
  await measure(client, "after-two-minutes-no-open-snapshot")
  await client.query("vacuum (analyze) legislation.document_sections")
  await measure(client, "after-ordinary-vacuum")
  // Supported per-index reloption. No extension installation or global config mutation.
  await client.query("alter index legislation.document_sections_ranked_text_idx set (mutable_segment_rows=0)")
  // One experimental reset to compare clean configurations, never proposed as ongoing maintenance.
  await client.query("reindex index legislation.document_sections_ranked_text_idx")
  await measure(client, "buffer-disabled-clean-control")
  const updatedEpochs = [1789171200000]
  for (const [cycle, batchSize] of [500, 500, 1].entries()) {
    const started = performance.now()
    let changed = 0
    for (let batch = 0; batch < 10; batch++) {
      const result = await client.query(
        `with selected as (
        select id from legislation.document_sections order by id limit $1 offset $2)
        update legislation.document_sections s set search_metadata=jsonb_set(search_metadata,'{updatedAt}',to_jsonb($3::bigint))
        from selected where s.id=selected.id`,
        [batchSize, batch * batchSize, 1789171200001 + cycle]
      )
      changed += result.rowCount ?? 0
    }
    report(JSON.stringify({ diagnosticUpdateCycle: cycle, batchSize, changed, wallMs: performance.now() - started }))
    updatedEpochs.push(1789171200001 + cycle)
    for (const epoch of updatedEpochs) {
      await verifyUpdatedAt(
        epoch,
        `buffer-disabled-after-update-cycle-${cycle}`,
        epoch === updatedEpochs.at(-1) ? changed : undefined
      )
    }
    await measure(client, `buffer-disabled-after-update-cycle-${cycle}`)
  }

  // Autocommitted insert/delete of one copied public row; never alter an existing source key.
  const canaryId = `diagnostic-copy:${randomUUID()}`
  const canaryEpoch = 1789171300000
  await verifyUpdatedAt(canaryEpoch, "buffer-disabled-before-insert", 0)
  try {
    const inserted = await client.query(
      `insert into legislation.document_sections
      (id,document_id,heading,text,page_start,page_end,search_document_title,search_metadata)
      select $1,$1,heading,text,page_start,page_end,search_document_title,
      jsonb_set(search_metadata,'{updatedAt}',to_jsonb($2::bigint))
      from legislation.document_sections where search_metadata->>'processingStatus'='processed'
      order by id limit 1`,
      [canaryId, canaryEpoch]
    )
    assert.equal(inserted.rowCount, 1, "A processed public row is required for the insert canary")
    await verifyUpdatedAt(canaryEpoch, "buffer-disabled-committed-insert", 1)
  } finally {
    await client.query("delete from legislation.document_sections where id=$1", [canaryId])
  }
  await verifyUpdatedAt(canaryEpoch, "buffer-disabled-committed-delete", 0)

  const readers = Array.from({ length: 4 }, () => new pg.Client({ connectionString, connectionTimeoutMillis: 10000 }))
  try {
    await Promise.all(
      readers.map(async (reader) => {
        await reader.connect()
        assert.equal(
          (await reader.query("select current_database() name")).rows[0]?.name,
          "legislation_search_benchmark"
        )
        await reader.query("set statement_timeout=15000")
        await reader.query("set work_mem='4MB'")
        await reader.query("set max_parallel_workers_per_gather=2")
      })
    )
    let activeReaders = 0
    const readerTasks = readers.map(async (reader, index) => {
      activeReaders += 1
      try {
        await measure(reader, `buffer-disabled-four-readers-${index}`)
      } finally {
        activeReaders -= 1
      }
    })
    const concurrentEpoch = 1789171200100
    const writerTask = async () => {
      const started = performance.now()
      let changed = 0
      let overlappingBatches = 0
      for (let batch = 0; batch < 10; batch++) {
        const readersAtStart = activeReaders
        const batchStarted = performance.now()
        const result = await client.query(
          `with selected as (select id from legislation.document_sections order by id limit 500 offset $1)
          update legislation.document_sections s
          set search_metadata=jsonb_set(search_metadata,'{updatedAt}',to_jsonb($2::bigint))
          from selected where s.id=selected.id`,
          [batch * 500, concurrentEpoch]
        )
        changed += result.rowCount ?? 0
        if (readersAtStart > 0) {
          overlappingBatches += 1
        }
        report(
          JSON.stringify({
            diagnosticConcurrentWriteBatch: batch,
            changed: result.rowCount,
            readersAtStart,
            readersAtEnd: activeReaders,
            wallMs: performance.now() - batchStarted
          })
        )
      }
      report(
        JSON.stringify({
          diagnosticConcurrentWriter: "buffer-disabled-four-readers",
          changed,
          committedBatches: 10,
          overlappingBatches,
          wallMs: performance.now() - started
        })
      )
      assert.ok(overlappingBatches > 0, "Concurrent writer did not overlap the reader workload")
      return changed
    }
    // Settle every workload before closing connections, including when one query fails.
    const results = await Promise.allSettled([...readerTasks, writerTask()])
    const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (failures.length > 0) {
      throw new AggregateError(failures, "Concurrent reader/writer diagnostic failed")
    }
    await verifyUpdatedAt(concurrentEpoch, "buffer-disabled-after-concurrent-writer", 5000)
    for (const epoch of updatedEpochs) {
      await verifyUpdatedAt(epoch, "buffer-disabled-after-concurrent-writer")
    }
  } finally {
    await Promise.all(readers.map((reader) => reader.end()))
  }
  const count = z
    .number()
    .parse((await client.query("select count(*)::int count from legislation.document_sections")).rows[0]?.count)
  report(JSON.stringify({ measurementPhase: "buffer-disabled-final-exact-grouping" }))
  await client.query("begin isolation level repeatable read read only")
  try {
    await runPairedTextIndexBenchmark(client, count, report)
  } finally {
    await client.query("rollback")
  }
}
