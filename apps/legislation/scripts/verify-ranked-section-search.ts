import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { z } from "zod"
import {
  collectRankedAmendments,
  rankedSectionIndexSql,
  rankedSectionPageQuery,
  type RankedSectionFilters
} from "../src/search/ranked-section-search.js"
import { runPairedTextIndexBenchmark } from "./paired-text-index-benchmark.js"
import { textIndexSampleRanges, validateSampleStratum } from "./text-index-sample-ranges.js"

const reportLines: string[] = []
function report(line: string) {
  reportLines.push(line)
  process.stdout.write(`${line}\n`)
}

// Deliberately restricted to a disposable database. Never provisions extensions.
function connectionUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "")
    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error()
    }
    return url
  } catch {
    throw new Error("Explicit PostgreSQL source and benchmark URLs are required")
  }
}
const targetUrl = connectionUrl(process.env.TEXT_INDEX_BENCHMARK_URL)
const sourceUrl = connectionUrl(process.env.DATABASE_URL)
if (targetUrl.pathname !== "/legislation_search_benchmark") {
  throw new Error("Target must be the isolated legislation_search_benchmark")
}
if (targetUrl.host === sourceUrl.host) {
  throw new Error("Source and benchmark hosts must differ")
}
const client = new pg.Client({ connectionString: targetUrl.href, connectionTimeoutMillis: 10000 })
const dialect = new PgDialect()
const hitSchema = z.array(z.object({ id: z.string(), document_id: z.string(), score: z.number() }))
const args = process.argv.slice(2)
assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--sample"), "Only --sample is supported")
let hasCommittedSample = false

async function measureSample() {
  // A bounded public sample, not a representative production latency estimate.
  const source = new pg.Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 10000 })
  await source.connect()
  let copied = 0
  try {
    await source.query("begin isolation level repeatable read read only")
    await source.query("set local statement_timeout=15000")
    await client.query("delete from legislation.document_sections")
    await client.query("drop index legislation.document_sections_ranked_text_idx")
    for (const { jurisdiction, prefix, upperBound, target } of textIndexSampleRanges) {
      let after: string = prefix
      let stratumCopied = 0
      while (stratumCopied < target) {
        const result = await source.query(
          `with sample as materialized (
        select id,document_id,heading,text,page_start,page_end from legislation.document_sections
        where id > $1 and id < $2 order by id limit 500
      ) select s.*,coalesce(d.title,'') search_document_title,
        jsonb_build_object('processingStatus',d.processing_status,
          'billIds',jsonb_build_array(b.id),'jurisdictionIds',jsonb_build_array(b.jurisdiction_id),
          'sessionIds',jsonb_build_array(b.session_id),'classifications',b.classification,
          'statuses',jsonb_build_array(b.status),'subjects',b.subjects,
          'sponsorIds',coalesce((select jsonb_agg(sp.person_id) from legislation.bill_sponsors sp where sp.bill_id=b.id),'[]'::jsonb),
          'documentClassifications',jsonb_build_array(d.classification),'versionCodes',jsonb_build_array(d.version_code),
          'introducedAt',extract(epoch from b.introduced_at::timestamptz)*1000,
          'updatedAt',extract(epoch from b.updated_at)*1000,
          'submittedAt',extract(epoch from d.document_date::timestamptz)*1000,
          'documentUpdatedAt',extract(epoch from d.updated_at)*1000) search_metadata
        from sample s join legislation.bill_documents d on d.id=s.document_id
        join legislation.bills b on b.id=d.bill_id order by s.id`,
          [after, upperBound]
        )
        const rows = z.array(z.object({ id: z.string() }).passthrough()).parse(result.rows)
        if (rows.length === 0) {
          break
        }
        assert.ok(
          rows.every((row) => row.id.startsWith(prefix)),
          "Source range returned an unexpected jurisdiction prefix"
        )
        await client.query(
          `insert into legislation.document_sections
        select id,document_id,heading,text,page_start,page_end,search_document_title,search_metadata
        from jsonb_to_recordset($1::jsonb) as r(id text,document_id text,heading text,text text,
          page_start integer,page_end integer,search_document_title text,search_metadata jsonb)`,
          [JSON.stringify(rows)]
        )
        copied += rows.length
        stratumCopied += rows.length
        after = z.string().parse(rows.at(-1)?.id)
        report(JSON.stringify({ copiedPublicSections: copied, stratum: jurisdiction, stratumCopied }))
      }
      report(
        JSON.stringify({
          samplingStratum: jurisdiction,
          requestedRows: target,
          copiedRows: stratumCopied,
          method: "first canonical IDs inside indexed prefix range; not random or representative"
        })
      )
      validateSampleStratum(jurisdiction, stratumCopied, target)
    }
  } finally {
    await source.query("rollback").catch(() => undefined)
    await source.end()
  }
  // Duplicate only this copied sample with distinct keys. Never read another 90k source rows.
  for (let copy = 1; copy <= 9; copy++) {
    await client.query(
      `insert into legislation.document_sections
      select id || ':sample:' || $1,document_id || ':sample:' || $1,heading,text,page_start,page_end,search_document_title,search_metadata
      from legislation.document_sections where id not like '%:sample:%'`,
      [copy]
    )
  }
  const vectorStarted = performance.now()
  const beforeVectors = await client.query("select pg_table_size('legislation.document_sections')::float8 table_bytes")
  await client.query(`alter table legislation.document_sections
    add column benchmark_body_vector tsvector generated always as (to_tsvector('english',coalesce(heading,'') || ' ' || text)) stored,
    add column benchmark_title_vector tsvector generated always as (to_tsvector('english',search_document_title)) stored`)
  const nativeVectorPreparationMs = performance.now() - vectorStarted
  const nativeStarted = performance.now()
  await client.query(
    "create index benchmark_body_gin on legislation.document_sections using gin(benchmark_body_vector)"
  )
  await client.query(
    "create index benchmark_title_gin on legislation.document_sections using gin(benchmark_title_vector)"
  )
  const nativeIndexBuildMs = performance.now() - nativeStarted
  const rankedStarted = performance.now()
  await client.query(rankedSectionIndexSql)
  const rankedIndexBuildMs = performance.now() - rankedStarted
  await client.query("analyze legislation.document_sections")
  // Measure committed index segments, not the cost of searching our own pending writes.
  await client.query("commit")
  hasCommittedSample = true
  await client.query("begin isolation level repeatable read read only")
  await client.query("set local statement_timeout=60000")
  await client.query("set local work_mem='4MB'")
  await client.query("set local max_parallel_workers_per_gather=2")
  const settings = await client.query(`select name,setting,unit from pg_settings where name in
    ('shared_buffers','work_mem','maintenance_work_mem','max_parallel_workers_per_gather','max_parallel_workers','jit','random_page_cost','effective_cache_size') order by name`)
  report(
    JSON.stringify({
      measurementSettings: settings.rows,
      caveat: "Session work_mem and parallel gather match production; shared buffers and host remain benchmark-specific"
    })
  )
  const storage = await client.query(`select
    pg_relation_size('legislation.document_sections')::float8 heap_bytes,
    pg_table_size('legislation.document_sections')::float8 table_including_toast_bytes,
    (pg_relation_size('legislation.benchmark_body_gin') + pg_relation_size('legislation.benchmark_title_gin'))::float8 native_index_bytes,
    pg_relation_size('legislation.document_sections_ranked_text_idx')::float8 ranked_index_bytes,
    (select sum(octet_length(text))::float8 from legislation.document_sections) source_text_bytes`)
  report(
    JSON.stringify({
      sampleRows: copied * 10,
      originalCopiedRows: copied,
      syntheticCopies: 9,
      nativeVectorPreparationMs,
      nativeIndexBuildMs,
      rankedIndexBuildMs,
      tableBeforeNativeVectors: beforeVectors.rows[0],
      storage: storage.rows[0],
      buildTiming: "single build wall observations; native GIN built before ranked; not migration estimate"
    })
  )
  report(JSON.stringify({ measurementPhase: "fresh-bulk-index" }))
  await runPairedTextIndexBenchmark(client, copied * 10, report)
  await client.query("commit")
  // Exercise committed parent-metadata changes on the disposable sample only.
  await client.query("set statement_timeout=60000")
  const updateStarted = performance.now()
  let updatedRows = 0
  for (let batch = 0; batch < 10; batch++) {
    const updated = await client.query(
      `with selected as (select id from legislation.document_sections order by id limit 500 offset $1)
       update legislation.document_sections s
       set search_metadata=jsonb_set(s.search_metadata,'{updatedAt}',to_jsonb(1789171200000::bigint))
       from selected where s.id=selected.id`,
      [batch * 500]
    )
    updatedRows += updated.rowCount ?? 0
  }
  report(
    JSON.stringify({
      measurementPhase: "after-committed-metadata-updates",
      updatedRows,
      committedBatches: 10,
      updateWallMs: performance.now() - updateStarted,
      caveat: "Both index types coexist; this is combined update cost, not isolated engine overhead"
    })
  )
  await client.query("begin isolation level repeatable read read only")
  await client.query("set local work_mem='4MB'")
  await client.query("set local max_parallel_workers_per_gather=2")
  await runPairedTextIndexBenchmark(client, copied * 10, report)
}

await client.connect()
try {
  const identity = await client.query("select current_database() name")
  assert.equal(identity.rows[0]?.name, "legislation_search_benchmark")
  await client.query("begin isolation level repeatable read")
  await client.query("set local statement_timeout=60000")
  await client.query("create schema legislation")
  await client.query(`create table legislation.document_sections (
    id text primary key, document_id text not null, heading text, text text not null,
    page_start integer, page_end integer, search_document_title text not null,
    search_metadata jsonb not null
  )`)
  const metadata = {
    processingStatus: "processed",
    documentClassifications: ["amendment"],
    jurisdictionIds: ["us"],
    sessionIds: ["119"],
    billIds: ["bill-1"],
    classifications: ["bill"],
    statuses: ["introduced"],
    subjects: ["health"],
    sponsorIds: ["person-1"],
    versionCodes: ["ih"],
    introducedAt: Date.parse("2025-01-01T00:00:00Z"),
    updatedAt: Date.parse("2025-02-01T00:00:00Z"),
    submittedAt: Date.parse("2025-01-02T00:00:00Z"),
    documentUpdatedAt: Date.parse("2025-02-02T00:00:00Z")
  }
  const fixtures = [
    { id: "a-1", document: "a", text: "health insurance legislation", title: "Insurance reform" },
    { id: "a-2", document: "a", text: "legislation taxation", title: "Insurance reform" },
    { id: "b-1", document: "b", text: "insurance health legislation taxation", title: "Tax reform" },
    { id: "c-1", document: "c", text: "legislation", title: "Health insurance legislation" },
    { id: "d-1", document: "d", text: "health", title: "Unrelated" },
    { id: "d-2", document: "d", text: "insurance", title: "Unrelated" }
  ]
  for (const fixture of fixtures) {
    await client.query(`insert into legislation.document_sections values ($1,$2,'Section 1',$3,2,4,$4,$5)`, [
      fixture.id,
      fixture.document,
      fixture.text,
      fixture.title,
      JSON.stringify(metadata)
    ])
  }
  await client.query(rankedSectionIndexSql)
  await client.query("analyze legislation.document_sections")
  const search = async (query: string, amendmentsOnly = false, filters?: RankedSectionFilters) => {
    const statement = dialect.sqlToQuery(rankedSectionPageQuery({ query, amendmentsOnly, filters, limit: 100 }))
    return hitSchema.parse((await client.query(statement.sql, statement.params)).rows)
  }
  const ids = (rows: z.infer<typeof hitSchema>) => rows.map((row) => row.id).sort()
  assert.deepEqual(ids(await search("health insurance")), ["a-1", "b-1"])
  assert.deepEqual(ids(await search('"health insurance"')), ["a-1"])
  assert.deepEqual(ids(await search("health -taxation")), ["a-1", "d-1"])
  assert.deepEqual(ids(await search("health OR insurance")), ["a-1", "b-1", "d-1", "d-2"])
  assert.deepEqual(ids(await search("health insurance", true)), ["a-1", "b-1", "c-1"])
  const cases: RankedSectionFilters[] = [
    { any: { jurisdictionIds: ["us"], sessionIds: ["119"], billIds: ["bill-1"] } },
    { any: { classifications: ["bill"], statuses: ["introduced"], subjects: ["health"], sponsorIds: ["person-1"] } },
    { documentClassifications: ["amendment"], versionCodes: ["ih"] },
    { range: { introducedAt: { gte: "2025-01-01T00:00:00Z" }, updatedAt: { lt: "2025-03-01T00:00:00Z" } } },
    { range: { submittedAt: { lte: "2025-01-02T00:00:00Z" }, documentUpdatedAt: { gte: "2025-02-01T00:00:00Z" } } },
    { headings: ["Section 1"], pageFrom: 3, pageTo: 3 },
    { documentIds: ["a", "b"] }
  ]
  for (const filters of cases) {
    const filtered = await search("health insurance", false, filters)
    assert.deepEqual(ids(filtered), ["a-1", "b-1"])
    assert.deepEqual(filtered, await search("health insurance"), "Filters must not alter relevance")
    const statement = dialect.sqlToQuery(
      rankedSectionPageQuery({ query: "legislation", amendmentsOnly: true, filters, limit: 2 })
    )
    const plan = await client.query(`explain (analyze,format json) ${statement.sql}`, statement.params)
    const serialized = JSON.stringify(plan.rows)
    assert.ok(serialized.includes("TopKScanExecState"), "Ranking must run in the index")
    assert.ok(!serialized.includes("heap_filter"), "Filters must run in the index")
    report(JSON.stringify({ filters, topK: true, heapFilter: false }))
  }
  assert.deepEqual(await search("health", false, { any: { sessionIds: ["118"] } }), [])
  assert.deepEqual(await search("health", false, { range: { introducedAt: { gte: "2026-01-01" } } }), [])
  assert.deepEqual(await search("health", false, { any: { billIds: ['bill-1" OR *'] } }), [])
  assert.deepEqual(await search("health", false, { any: { jurisdictionIds: ["US"] } }), [])
  assert.deepEqual(await search("health", false, { any: { billIds: ["bill"] } }), [])
  assert.deepEqual(await search("health", false, { any: { billIds: [] } }), [])
  const all = await search("legislation", true)
  const grouped = await collectRankedAmendments(
    async (offset, limit) => {
      const statement = dialect.sqlToQuery(
        rankedSectionPageQuery({ query: "legislation", amendmentsOnly: true, limit, offset })
      )
      return hitSchema.parse((await client.query(statement.sql, statement.params)).rows)
    },
    3,
    2
  )
  const firstSections = all.filter(
    (row, index) => all.findIndex((candidate) => candidate.document_id === row.document_id) === index
  )
  assert.deepEqual(grouped, firstSections)
  await client.query("savepoint mutation_checks")
  await client.query("update legislation.document_sections set text='replacement' where id='a-1'")
  assert.deepEqual(ids(await search('"health insurance"')), [])
  await client.query("delete from legislation.document_sections where id='b-1'")
  assert.deepEqual(ids(await search("taxation")), ["a-2"])
  await client.query(
    `update legislation.document_sections set search_metadata=jsonb_set(search_metadata,'{processingStatus}','"failed"') where id='a-2'`
  )
  assert.deepEqual(await search("taxation"), [])
  await client.query("rollback to savepoint mutation_checks")
  assert.deepEqual(ids(await search('"health insurance"')), ["a-1"])
  if (args[0] === "--sample") {
    await measureSample()
  }
  // Fixtures roll back; a committed sample is removed in finally.
  await client.query("rollback")
  report(
    JSON.stringify({
      status: "passed",
      grammarCases: 5,
      filterCases: cases.length + 6,
      exactGrouping: true,
      mutationsAndRollback: true
    })
  )
} finally {
  try {
    if (args[0] === "--sample") {
      await mkdir(new URL("../tmp/", import.meta.url), { recursive: true })
      const artifactName = `ranked-search-comparison-${new Date().toISOString().replaceAll(":", "-")}.json`
      report(JSON.stringify({ artifactName }))
      await writeFile(new URL(`../tmp/${artifactName}`, import.meta.url), `[\n${reportLines.join(",\n")}\n]\n`, {
        flag: "wx"
      })
    }
  } finally {
    try {
      await client.query("rollback").catch(() => undefined)
      if (hasCommittedSample) {
        // This schema was created above in the verified disposable database only.
        await client.query("drop schema legislation cascade")
      }
    } finally {
      await client.end()
    }
  }
}
