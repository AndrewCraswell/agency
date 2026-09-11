import { mkdir, writeFile } from "node:fs/promises"
import pg from "pg"

// This experiment never writes to the application database. Use a disposable
// database with this exact name; neither migrations nor extensions are installed.
function connectionUrl(value) {
  try {
    const url = new URL(value ?? "")
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      throw new Error()
    }
    return url
  } catch {
    throw new Error("Explicit PostgreSQL source and benchmark URLs are required")
  }
}
const targetUrl = connectionUrl(process.env.TEXT_INDEX_BENCHMARK_URL)
if (targetUrl.pathname !== "/legislation_search_benchmark") {
  throw new Error("The target must be the isolated legislation_search_benchmark database")
}
const sourceUrl = connectionUrl(process.env.DATABASE_URL)
if (targetUrl.host === sourceUrl.host) {
  throw new Error("Source and benchmark hosts must differ")
}
const args = process.argv.slice(2)
if (
  args.length > 1 ||
  (args.length === 1 && !["--measure-only", "--scale-synthetic", "--rebuild-ranked"].includes(args[0]))
) {
  throw new Error("Only --measure-only, --scale-synthetic or --rebuild-ranked is supported")
}
const measureOnly = args.length === 1
const target = new pg.Client({ connectionString: targetUrl.href, connectionTimeoutMillis: 10000 })
const source = new pg.Client({ connectionString: sourceUrl.href, connectionTimeoutMillis: 10000 })
await target.connect()
try {
  const identity = await target.query("select current_database() name")
  if (identity.rows[0]?.name !== "legislation_search_benchmark") {
    throw new Error("Wrong benchmark database")
  }
  await target.query("set statement_timeout=60000")
  let loaded = 0
  if (!measureOnly) {
    await target.query(`create table benchmark_passages (
    id bigint generated always as identity primary key,
    section_id text not null unique, document_id text not null,
    body text not null, title text not null, jurisdiction_id text not null,
    is_amendment boolean not null, search_vector tsvector not null
  )`)
    await source.connect()
    let after = ""
    try {
      // One bounded read-only snapshot avoids mixing source versions between pages.
      await source.query("begin isolation level repeatable read read only")
      await source.query("set local statement_timeout=15000")
      while (loaded < 10000) {
        const result = await source.query(
          `
        with sample as materialized (
          select id,document_id,heading,text,search_vector
          from legislation.document_sections where id > $1 order by id limit 500
        )
        select s.id section_id,s.document_id,
          concat_ws(' ',s.heading,s.text) body,coalesce(d.title,'') title,
          b.jurisdiction_id,d.classification = 'amendment' is_amendment,
          s.search_vector::text search_vector
        from sample s join legislation.bill_documents d on d.id=s.document_id
        join legislation.bills b on b.id=d.bill_id order by s.id`,
          [after]
        )
        if (!result.rows.length) {
          break
        }
        await target.query(
          `insert into benchmark_passages
        (section_id,document_id,body,title,jurisdiction_id,is_amendment,search_vector)
        select section_id,document_id,body,title,jurisdiction_id,is_amendment,search_vector::tsvector
        from jsonb_to_recordset($1::jsonb) as x(section_id text,document_id text,body text,title text,
          jurisdiction_id text,is_amendment boolean,search_vector text)`,
          [JSON.stringify(result.rows)]
        )
        loaded += result.rows.length
        after = result.rows.at(-1).section_id
        process.stderr.write(`Copied ${loaded} public sections\n`)
      }
    } finally {
      await source.query("rollback")
      await source.end()
    }
    await target.query("create index benchmark_passages_gin on benchmark_passages using gin(search_vector)")
    await target.query("analyze benchmark_passages")
  } else {
    if (args[0] === "--scale-synthetic") {
      // Fixed upper bound: reuse the already copied sample, never read more source data.
      for (let copy = 1; copy <= 9; copy++) {
        await target.query(
          `insert into benchmark_passages
          (section_id,document_id,body,title,jurisdiction_id,is_amendment,search_vector)
          select section_id || ':benchmark-copy:' || $1, document_id || ':benchmark-copy:' || $1,
            body,title,jurisdiction_id,is_amendment,search_vector
          from benchmark_passages where id <= 10000
          on conflict (section_id) do nothing`,
          [String(copy)]
        )
        process.stderr.write(`Synthetic copy ${copy}/9 complete\n`)
      }
      await target.query("analyze benchmark_passages")
    }
    loaded = Number((await target.query("select count(*) count from benchmark_passages")).rows[0].count)
  }
  if (!measureOnly || args[0] === "--rebuild-ranked") {
    if (args[0] === "--rebuild-ranked") {
      await target.query("drop index benchmark_passages_ranked")
    }
    await target.query(`create index benchmark_passages_ranked on benchmark_passages
      using paradedb (id,(document_id::pdb.literal),(section_id::pdb.literal),
        (body::pdb.simple('stemmer=english')),(title::pdb.simple('stemmer=english')),
        (jurisdiction_id::pdb.literal),is_amendment) with (key_field='id')`)
  }
  const report = {
    capturedAt: new Date().toISOString(),
    sample:
      "First 10,000 sections by canonical ID; rows beyond 10,000 are synthetic copies, not representative full-corpus data",
    loaded,
    measurements: []
  }
  const queries = {
    passageGin: `select section_id,ts_rank_cd(search_vector,websearch_to_tsquery('english',$1)) score
      from benchmark_passages where search_vector @@ websearch_to_tsquery('english',$1)
      order by score desc,section_id limit 20`,
    passageRanked: `select section_id,pdb.score(id) score from benchmark_passages
      where body ||| $1 order by score desc,section_id limit 20`,
    passageRankedNumericTie: `select section_id,pdb.score(id) score from benchmark_passages
      where body ||| $1 order by score desc,id limit 20`,
    passageRankedBytewiseTie: `select section_id,pdb.score(id) score from benchmark_passages
      where body ||| $1 order by score desc,section_id collate "C" limit 20`,
    amendmentGin: `select document_id,max(ts_rank_cd(search_vector,websearch_to_tsquery('english',$1))) score
      from benchmark_passages where is_amendment and search_vector @@ websearch_to_tsquery('english',$1)
      group by document_id order by score desc,document_id limit 20`,
    amendmentRanked: `select document_id,max(pdb.score(id)) score from benchmark_passages
      where is_amendment and body ||| $1 group by document_id order by score desc,document_id limit 20`
  }
  for (const term of ["legislation", "tax", "education", "health"]) {
    for (const [name, query] of Object.entries(queries)) {
      const start = performance.now()
      try {
        const result = await target.query(query, [term])
        const milliseconds = performance.now() - start
        const explained = await target.query(`explain (analyze,buffers,format json) ${query}`, [term])
        const plan = explained.rows[0]["QUERY PLAN"][0]
        report.measurements.push({
          name,
          term,
          milliseconds,
          serverMilliseconds: plan["Execution Time"],
          rows: result.rows,
          plan
        })
      } catch (error) {
        report.measurements.push({ name, term, milliseconds: performance.now() - start, error: error.message })
      }
    }
  }
  const directory = new URL("../tmp/", import.meta.url)
  await mkdir(directory, { recursive: true })
  await writeFile(new URL("text-index-benchmark.json", directory), `${JSON.stringify(report, null, 2)}\n`)
  if (report.measurements.some((measurement) => measurement.error)) {
    process.exitCode = 1
  }
  process.stdout.write(
    `${JSON.stringify({ loaded, measurements: report.measurements.map(({ rows, plan: _plan, ...measurement }) => ({ ...measurement, count: rows?.length })) }, null, 2)}\n`
  )
} finally {
  await target.end()
}
