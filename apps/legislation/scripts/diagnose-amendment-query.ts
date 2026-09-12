import { mkdir, writeFile } from "node:fs/promises"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { z } from "zod"
import * as schema from "../src/db/schema/schema.js"
import { buildDocumentAmendmentLexicalQuery } from "../src/legislation/query-service.js"

// Read-only, sequential diagnostics. Every statement has a database-enforced deadline.
const connectionString = z.url().parse(process.env.DATABASE_URL)
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 })
const observations: unknown[] = []
await client.connect()
try {
  const database = drizzle(client, { schema })
  for (const query of ["health", "tax", '"health insurance"']) {
    const baseline = buildDocumentAmendmentLexicalQuery(database, { query, mode: "lexical", limit: 20 }, 21).toSQL()
    const candidate = {
      params: [query],
      sql: `with page as materialized (
        select d.id document_id, s.id section_id,
          ts_rank_cd(to_tsvector('english', coalesce(d.title,'')), websearch_to_tsquery('english',$1)) + s.rank rank
        from legislation.bill_documents d
        join legislation.bills b on b.id=d.bill_id
        cross join lateral (
          select s.id, case when s.search_vector @@ websearch_to_tsquery('english',$1)
            then ts_rank_cd(s.search_vector,websearch_to_tsquery('english',$1)) else 0 end rank
          from legislation.document_sections s
          where s.document_id=d.id and s.search_vector is not null and (
            s.search_vector @@ websearch_to_tsquery('english',$1) or
            to_tsvector('english',coalesce(d.title,'')) @@ websearch_to_tsquery('english',$1))
          order by rank desc,s.id asc limit 1
        ) s
        where d.classification='amendment' and d.processing_status='processed'
        order by rank desc,d.id asc limit 21
      ) select p.*,d.*,b.*,
        left(ts_headline('english',s.text,websearch_to_tsquery('english',$1),
          'MaxWords=35, MinWords=10, MaxFragments=1'),1000) snippet
      from page p join legislation.bill_documents d on d.id=p.document_id
      join legislation.bills b on b.id=d.bill_id
      join legislation.document_sections s on s.id=p.section_id
      order by p.rank desc,p.document_id asc`
    }
    for (const [variant, statement] of [
      ["current-application", baseline],
      ["amendment-first", candidate]
    ] as const) {
      await client.query("begin read only")
      try {
        await client.query("set local statement_timeout=15000")
        await client.query("set local lock_timeout=1000")
        const started = performance.now()
        const result = await client.query(`explain (analyze, buffers, format json) ${statement.sql}`, statement.params)
        const plan = z
          .array(z.object({ "Execution Time": z.number() }).passthrough())
          .parse(result.rows[0]["QUERY PLAN"])
        observations.push({ query, variant, wallMs: performance.now() - started, plan })
        process.stdout.write(`${JSON.stringify({ query, variant, executionMs: plan[0]?.["Execution Time"] })}\n`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        observations.push({ query, variant, error: message })
        process.stdout.write(`${JSON.stringify({ query, variant, error: message })}\n`)
      } finally {
        await client.query("rollback")
      }
    }
  }
} finally {
  await client.end()
  await mkdir("tmp", { recursive: true })
  const path = `tmp/amendment-query-diagnostic-${new Date().toISOString().replaceAll(":", "-")}.json`
  await writeFile(path, JSON.stringify(observations, null, 2), { flag: "wx" })
  process.stdout.write(`${path}\n`)
}
