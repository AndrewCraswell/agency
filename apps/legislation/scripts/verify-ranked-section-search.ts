import assert from "node:assert/strict"
import { PgDialect } from "drizzle-orm/pg-core"
import pg from "pg"
import { z } from "zod"
import {
  collectRankedAmendments,
  rankedSectionIndexSql,
  rankedSectionPageQuery,
  type RankedSectionFilters
} from "../src/search/ranked-section-search.js"

function report(line: string) {
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
  let after = ""
  let copied = 0
  try {
    await source.query("begin isolation level repeatable read read only")
    await source.query("set local statement_timeout=15000")
    await client.query("delete from legislation.document_sections")
    while (copied < 10000) {
      const result = await source.query(
        `with sample as materialized (
        select id,document_id,heading,text,page_start,page_end from legislation.document_sections
        where id > $1 order by id limit 500
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
        [after]
      )
      const rows = z.array(z.object({ id: z.string() }).passthrough()).parse(result.rows)
      if (rows.length === 0) {
        break
      }
      await client.query(
        `insert into legislation.document_sections
        select id,document_id,heading,text,page_start,page_end,search_document_title,search_metadata
        from jsonb_to_recordset($1::jsonb) as r(id text,document_id text,heading text,text text,
          page_start integer,page_end integer,search_document_title text,search_metadata jsonb)`,
        [JSON.stringify(rows)]
      )
      copied += rows.length
      after = z.string().parse(rows.at(-1)?.id)
      report(JSON.stringify({ copiedPublicSections: copied }))
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
  await client.query("analyze legislation.document_sections")
  // Measure committed index segments, not the cost of searching our own pending writes.
  await client.query("commit")
  hasCommittedSample = true
  await client.query("begin isolation level repeatable read read only")
  await client.query("set local statement_timeout=60000")
  for (const query of ["legislation", "tax", "education", "health"]) {
    for (const amendmentsOnly of [false, true]) {
      const statement = dialect.sqlToQuery(rankedSectionPageQuery({ query, amendmentsOnly, limit: 21 }))
      const plan = await client.query(`explain (analyze,format json) ${statement.sql}`, statement.params)
      const serialized = JSON.stringify(plan.rows)
      assert.ok(serialized.includes("TopKScanExecState"))
      assert.ok(!serialized.includes("heap_filter"))
      const result = z
        .array(z.object({ "QUERY PLAN": z.array(z.object({ "Execution Time": z.number() })) }))
        .parse(plan.rows)
      report(
        JSON.stringify({
          sampleRows: copied * 10,
          query,
          amendmentsOnly,
          serverMs: result[0]?.["QUERY PLAN"][0]?.["Execution Time"]
        })
      )
      if (amendmentsOnly) {
        const started = performance.now()
        let batches = 0
        const grouped = await collectRankedAmendments(async (offset, limit) => {
          const remaining = Math.floor(15000 - (performance.now() - started))
          assert.ok(remaining > 0, "Amendment query exceeded its total 15-second budget")
          await client.query("select set_config('statement_timeout',$1,true)", [`${remaining}ms`])
          const page = dialect.sqlToQuery(rankedSectionPageQuery({ query, amendmentsOnly: true, limit, offset }))
          batches += 1
          return hitSchema.parse((await client.query(page.sql, page.params)).rows)
        }, 21)
        const elapsedMs = performance.now() - started
        assert.ok(elapsedMs < 15000)
        report(JSON.stringify({ query, groupedDocuments: grouped.length, batches, elapsedMs }))
        await client.query("set local statement_timeout=60000")
      }
    }
  }
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
  await client.query("rollback").catch(() => undefined)
  if (hasCommittedSample) {
    // This schema was created above in the verified disposable database only.
    await client.query("drop schema legislation cascade")
  }
  await client.end()
}
