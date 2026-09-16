import { mkdir, writeFile } from "node:fs/promises"
import pg from "pg"
import { z } from "zod"

if (process.argv.slice(2).join(" ") !== "--apply") {
  throw new Error("Use --apply after applying the amendment search projection migration")
}
const connectionString = process.env.DATABASE_URL
if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString)) {
  throw new Error("An explicit PostgreSQL DATABASE_URL is required")
}
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 })
const records: unknown[] = []
const batchSize = 250
function report(record: unknown) {
  records.push(record)
  process.stdout.write(`${JSON.stringify(record)}\n`)
}
const started = performance.now()
await client.connect()
try {
  await client.query("begin read only")
  await client.query("set local statement_timeout=15000")
  const documents = z.array(z.object({ id: z.string() })).parse(
    (
      await client.query(`
    select id from legislation.bill_documents where classification='amendment'
    order by (document_date is null),document_date desc nulls first,id`)
    ).rows
  )
  await client.query("rollback")
  documents.sort((a, b) => Buffer.compare(Buffer.from(a.id), Buffer.from(b.id)))
  report({
    phase: "inventory",
    documents: documents.length,
    consistency: "parent locks; fresh READ COMMITTED statements; idempotent upsert"
  })
  for (let offset = 0; offset < documents.length; offset += batchSize) {
    const ids = documents.slice(offset, offset + batchSize).map(({ id }) => id)
    for (let attempt = 1; ; attempt++) {
      await client.query("begin isolation level read committed")
      try {
        await client.query("set local statement_timeout=15000")
        await client.query("set local lock_timeout=1000")
        // Existing extraction writers lock parents before replacing sections.
        // Use a subsequent statement snapshot after any wait for those writers.
        await client.query(
          'select id from legislation.bill_documents where id=any($1::text[]) order by id collate "C" for update',
          [ids]
        )
        await client.query(
          `delete from legislation.amendment_section_search p
          where p.document_id=any($1::text[]) and not exists (
            select 1 from legislation.bill_documents d join legislation.document_sections s on s.document_id=d.id
            where d.id=p.document_id and s.id=p.section_id and d.classification='amendment')`,
          [ids]
        )
        const changed = await client.query(
          `insert into legislation.amendment_section_search
          (section_id,document_id,section_vector,title_vector)
          select s.id,d.id,s.search_vector,to_tsvector('english',coalesce(d.title,''))
          from legislation.bill_documents d
          join legislation.document_sections s on s.document_id=d.id
          where d.id=any($1::text[]) and d.classification='amendment'
          on conflict(section_id) do update set document_id=excluded.document_id,
            section_vector=excluded.section_vector,title_vector=excluded.title_vector
          where (amendment_section_search.document_id,amendment_section_search.section_vector,amendment_section_search.title_vector)
            is distinct from (excluded.document_id,excluded.section_vector,excluded.title_vector)`,
          [ids]
        )
        const integrity = z.object({ mismatches: z.number() }).parse(
          (
            await client.query(
              `
          select count(*)::int mismatches from legislation.bill_documents d
          join legislation.document_sections s on s.document_id=d.id
          left join legislation.amendment_section_search p on p.section_id=s.id
          where d.id=any($1::text[]) and d.classification='amendment' and
            (p.section_id is null or (p.document_id,p.section_vector,p.title_vector) is distinct from
             (d.id,s.search_vector,to_tsvector('english',coalesce(d.title,''))))`,
              [ids]
            )
          ).rows[0]
        )
        if (integrity.mismatches !== 0) {
          throw new Error("Projection integrity mismatch; batch rolled back")
        }
        await client.query("commit")
        report({
          phase: "batch",
          completedDocuments: Math.min(offset + batchSize, documents.length),
          totalDocuments: documents.length,
          changedRows: changed.rowCount,
          mismatches: integrity.mismatches,
          attempt,
          elapsedMs: performance.now() - started
        })
        break
      } catch (error) {
        await client.query("rollback")
        if (
          attempt >= 3 ||
          !(error instanceof pg.DatabaseError) ||
          !["40P01", "55P03", "57014"].includes(error.code ?? "")
        ) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      }
    }
  }
  await client.query("begin")
  await client.query("set local statement_timeout=60000")
  await client.query("analyze legislation.amendment_section_search")
  await client.query("commit")
  report({ phase: "completed", verifiedDocuments: documents.length, elapsedMs: performance.now() - started })
} finally {
  await client.query("rollback").catch(() => undefined)
  await client.end()
  await mkdir("tmp", { recursive: true })
  await writeFile(
    `tmp/amendment-search-backfill-${new Date().toISOString().replaceAll(":", "-")}.json`,
    JSON.stringify(records),
    { flag: "wx" }
  )
}
