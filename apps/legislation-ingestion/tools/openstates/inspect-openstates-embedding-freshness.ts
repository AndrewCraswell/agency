import { createDatabase } from "@repo/legislation-core/database/database"
import { legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { embeddingRouteFor } from "@repo/legislation-core/embeddings/embedding-routing"
import { Command } from "commander"
import { z } from "zod"
import { loadConfig } from "../../src/config/config.js"
import { billEmbeddingInputHash, sectionEmbeddingInputHash } from "../../src/ingestion/embeddings/jobs.js"
import { stateContentScope, stateContentSession } from "../../src/ingestion/openstates/state-content-scope.js"

const command = new Command()
  .argument("<state>")
  .argument("[session]")
  .option(
    "--database-env <name>",
    "read the database URL from this environment variable instead of the local test database"
  )
  .parse()
const options = command.opts<{ databaseEnv?: string }>()
const state = stateContentScope.parse(command.args[0])
const session = stateContentSession(state, command.args[1])
const prefix = legislativeSessionId(state, session).replace("session:", "bill:") + ":%"
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: options.databaseEnv
    ? z.string().min(1).parse(process.env[options.databaseEnv])
    : "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
})
const { pool } = createDatabase(config.database)
const client = await pool.connect()
const stored = z.object({ id: z.string(), input_hash: z.string().nullable(), dimensions: z.number().nullable() })
const billRow = stored.extend({ title: z.string(), summary: z.string().nullable(), subjects: z.array(z.string()) })
const sectionRow = stored.extend({ heading: z.string().nullable(), text: z.string() })
try {
  await client.query("begin transaction isolation level repeatable read read only")
  await client.query("set local statement_timeout='30s'")
  const observed = await client.query("select transaction_timestamp() as observed_at")
  const scopeRows = await client.query("select id from legislation.bills where id like $1 order by id", [prefix])
  const scopedBillIds = z
    .array(z.object({ id: z.string() }))
    .parse(scopeRows.rows)
    .map((row) => row.id)
  const sectionScopes: string[][] = []
  for (let index = 0; index < scopedBillIds.length; index += 25) {
    sectionScopes.push(scopedBillIds.slice(index, index + 25))
  }
  const results = []
  for (const product of ["bill", "document-section"] as const) {
    const route = embeddingRouteFor(product)
    let scanned = 0
    let missing = 0
    let stale = 0
    const issueSample: string[] = []
    for (const scope of product === "bill" ? [prefix] : sectionScopes) {
      let cursor = ""
      for (;;) {
        // Only fixed internal query variants; all user scope and cursors are parameters.
        const query =
          product === "bill"
            ? `select b.id,b.title,b.summary,b.subjects,e.input_hash,e.dimensions
           from legislation.bills b left join legislation.bill_embeddings e
             on e.bill_id=b.id and e.model=$3 and e.input_contract=$4
           where b.id like $1 and b.id>$2 order by b.id limit 500`
            : `with scoped_documents as materialized (
             select id from legislation.bill_documents where bill_id=any($1::text[])
           ), page as materialized (
             select s.id,s.heading,s.text from scoped_documents d
             join legislation.document_sections s on s.document_id=d.id
             where s.id>$2 order by s.id limit 500
           )
           select s.id,s.heading,s.text,e.input_hash,e.dimensions from page s
           left join legislation.document_section_embeddings e
             on e.section_id=s.id and e.model=$3 and e.input_contract=$4
           order by s.id`
        const page = await client.query(query, [scope, cursor, route.model, route.embeddingInputContract])
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
    }
    results.push({ product, scanned, missing, stale, issueSample })
  }
  await client.query("commit")
  const fresh = results.every((result) => result.scanned > 0 && result.missing === 0 && result.stale === 0)
  process.stdout.write(
    `${JSON.stringify(
      {
        observedAt: observed.rows[0]?.observed_at,
        databaseSelection: options.databaseEnv ? { environmentVariable: options.databaseEnv } : { localTest: true },
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
