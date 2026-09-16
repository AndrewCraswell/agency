import { z } from "zod"
import { loadConfig } from "../../src/config/config.js"
import { createDatabase } from "../../src/db/database.js"
import { billEmbeddingInputHash, sectionEmbeddingInputHash } from "../../src/ingestion/embeddings/jobs.js"
import { legislativeSessionId } from "../../src/legislation/identifiers.js"
import { embeddingRouteFor } from "../../src/models/embedding-routing.js"

const state = z.enum(["nc", "ak"]).parse(process.argv[2])
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(process.argv[3] ?? (state === "nc" ? "2025" : "34"))
const prefix = legislativeSessionId(state, session).replace("session:", "bill:") + ":%"
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
})
const { pool } = createDatabase(config.database, { statementTimeoutMs: 30_000 })
const client = await pool.connect()
const stored = z.object({ id: z.string(), input_hash: z.string().nullable(), dimensions: z.number().nullable() })
const billRow = stored.extend({ title: z.string(), summary: z.string().nullable(), subjects: z.array(z.string()) })
const sectionRow = stored.extend({ heading: z.string().nullable(), text: z.string() })
try {
  await client.query("begin transaction isolation level repeatable read read only")
  const observed = await client.query("select transaction_timestamp() as observed_at")
  const results = []
  for (const product of ["bill", "document-section"] as const) {
    const route = embeddingRouteFor(product)
    let cursor = ""
    let scanned = 0
    let missing = 0
    let stale = 0
    const issueSample: string[] = []
    for (;;) {
      // Only fixed internal query variants; all user scope and cursors are parameters.
      const query =
        product === "bill"
          ? `select b.id,b.title,b.summary,b.subjects,e.input_hash,e.dimensions
           from legislation.bills b left join legislation.bill_embeddings e
             on e.bill_id=b.id and e.model=$3 and e.input_contract=$4
           where b.id like $1 and b.id>$2 order by b.id limit 500`
          : `select s.id,s.heading,s.text,e.input_hash,e.dimensions
           from legislation.document_sections s join legislation.bill_documents d on d.id=s.document_id
           left join legislation.document_section_embeddings e
             on e.section_id=s.id and e.model=$3 and e.input_contract=$4
           where d.bill_id like $1 and s.id>$2 order by s.id limit 500`
      const page = await client.query(query, [prefix, cursor, route.model, route.embeddingInputContract])
      for (const value of page.rows) {
        const row = stored.parse(value)
        const expected =
          product === "bill"
            ? billEmbeddingInputHash(billRow.parse(value))
            : sectionEmbeddingInputHash(sectionRow.parse(value))
        scanned += 1
        cursor = row.id
        if (row.input_hash === null) {
          missing += 1
        } else if (row.input_hash.trim() !== expected || row.dimensions !== route.dimensions) {
          stale += 1
        } else {
          continue
        }
        if (issueSample.length < 20) {
          issueSample.push(row.id)
        }
      }
      if (page.rows.length < 500) {
        break
      }
    }
    results.push({ product, scanned, missing, stale, issueSample })
  }
  await client.query("commit")
  const fresh = results.every((result) => result.scanned > 0 && result.missing === 0 && result.stale === 0)
  process.stdout.write(
    `${JSON.stringify(
      {
        observedAt: observed.rows[0]?.observed_at,
        environment: "local",
        productionWrites: false,
        state,
        session,
        fresh,
        results,
        searchAcceptanceVerified: false,
        historicalCompletenessVerified: false
      },
      null,
      2
    )}\n`
  )
  if (!fresh) {
    process.exitCode = 1
  }
} finally {
  client.release()
  await pool.end()
}
