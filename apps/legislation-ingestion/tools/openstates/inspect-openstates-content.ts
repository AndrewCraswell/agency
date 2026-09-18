import { createDatabase } from "@repo/legislation-core/database/database"
import { jurisdictionId, legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { embeddingRouteFor } from "@repo/legislation-core/embeddings/embedding-routing"
import { Command } from "commander"
import { z } from "zod"
import { loadConfig } from "../../src/config/config.js"

const command = new Command()
  .argument("[state]", "limit the report to one supported state")
  .argument("[session]", "limit the report to one session in the selected state")
  .option(
    "--database-env <name>",
    "read the database URL from this environment variable instead of the local test database"
  )
  .parse()
const options = command.opts<{ databaseEnv?: string }>()
const selectedState = command.args[0] === undefined ? undefined : z.enum(["nc", "ak"]).parse(command.args[0])
const selectedSession = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .optional()
  .parse(command.args[1])
if (selectedSession !== undefined && selectedState === undefined) {
  throw new Error("A state is required when selecting a session")
}

// Deliberately read-only. This report does not activate hosted work or equate
// vector existence with input-hash freshness/search acceptance.
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: options.databaseEnv
    ? z.string().url().parse(process.env[options.databaseEnv])
    : "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
})
const { pool } = createDatabase(config.database)
const client = await pool.connect()
try {
  await client.query("begin transaction isolation level repeatable read read only")
  await client.query("set local statement_timeout = '30s'")
  const billRoute = embeddingRouteFor("bill")
  const sectionRoute = embeddingRouteFor("document-section")
  const states = []
  const scopes = selectedState
    ? [
        {
          jurisdictionId: jurisdictionId(selectedState),
          sessionId: legislativeSessionId(selectedState, selectedSession ?? (selectedState === "nc" ? "2025" : "34")),
          state: selectedState
        }
      ]
    : [
        { jurisdictionId: jurisdictionId("ak"), sessionId: legislativeSessionId("ak", "34"), state: "ak" },
        { jurisdictionId: jurisdictionId("nc"), sessionId: legislativeSessionId("nc", "2025"), state: "nc" }
      ]
  for (const scope of scopes) {
    const billRows = await client.query<{ id: string }>(
      "select id from legislation.bills where jurisdiction_id=$1 and session_id=$2 order by id",
      [scope.jurisdictionId, scope.sessionId]
    )
    const report = {
      state: scope.state,
      session: scope.sessionId,
      bills: billRows.rows.length,
      bills_missing_routed_embeddings: 0,
      document_statuses: {} as Record<string, number>,
      ocr_processed: 0,
      unresolved_ocr: 0,
      processed_documents_without_sections: 0,
      sections: 0,
      sections_missing_routed_embeddings: 0
    }
    for (let offset = 0; offset < billRows.rows.length; offset += 25) {
      const billIds = billRows.rows.slice(offset, offset + 25).map((row) => row.id)
      const billEmbeddings = await client.query<{ missing: number }>(
        `select count(*) filter (where e.bill_id is null)::int as missing
           from unnest($1::text[]) as scoped(id)
           left join legislation.bill_embeddings e on e.bill_id=scoped.id
             and e.model=$2 and e.input_contract=$3 and e.dimensions=$4`,
        [billIds, billRoute.model, billRoute.embeddingInputContract, billRoute.dimensions]
      )
      const documents = await client.query<{
        ocr_processed: number
        processed_documents_without_sections: number
        statuses: Record<string, number> | null
        unresolved_ocr: number
      }>(
        `select jsonb_object_agg(status, total) as statuses,
             coalesce(sum(ocr_processed), 0)::int as ocr_processed,
             coalesce(sum(unresolved_ocr), 0)::int as unresolved_ocr,
             coalesce(sum(processed_without_sections), 0)::int as processed_documents_without_sections
           from (
             select d.processing_status as status, count(*)::int as total,
               count(*) filter (where d.ocr_status='processed')::int as ocr_processed,
               count(*) filter (where d.processing_error_category='ocr-required'
                 and d.processing_status <> 'processed')::int as unresolved_ocr,
               count(*) filter (where d.processing_status='processed' and not exists (
                 select 1 from legislation.document_sections s where s.document_id=d.id
               ))::int as processed_without_sections
             from legislation.bill_documents d where d.bill_id=any($1::text[])
             group by d.processing_status
           ) status_counts`,
        [billIds]
      )
      const sections = await client.query<{ missing: number; total: number }>(
        `select count(*)::int as total,
             count(*) filter (where e.section_id is null)::int as missing
           from legislation.bill_documents d
           join legislation.document_sections s on s.document_id=d.id
           left join legislation.document_section_embeddings e on e.section_id=s.id
             and e.model=$2 and e.input_contract=$3 and e.dimensions=$4
           where d.bill_id=any($1::text[])`,
        [billIds, sectionRoute.model, sectionRoute.embeddingInputContract, sectionRoute.dimensions]
      )
      report.bills_missing_routed_embeddings += billEmbeddings.rows[0]?.missing ?? 0
      const documentBatch = documents.rows[0]
      report.ocr_processed += documentBatch?.ocr_processed ?? 0
      report.unresolved_ocr += documentBatch?.unresolved_ocr ?? 0
      report.processed_documents_without_sections += documentBatch?.processed_documents_without_sections ?? 0
      for (const [status, total] of Object.entries(documentBatch?.statuses ?? {})) {
        report.document_statuses[status] = (report.document_statuses[status] ?? 0) + total
      }
      report.sections += sections.rows[0]?.total ?? 0
      report.sections_missing_routed_embeddings += sections.rows[0]?.missing ?? 0
    }
    states.push(report)
  }
  const indexes = await client.query(`
    select c.relname as name, i.indisvalid as valid, i.indisready as ready
    from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='legislation' and c.relname in
      ('bill_embeddings_hnsw_idx','document_section_embeddings_hnsw_idx') order by c.relname
  `)
  await client.query("commit")
  process.stdout.write(
    `${JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        databaseSelection: options.databaseEnv ? { environmentVariable: options.databaseEnv } : { localTest: true },
        productionWrites: false,
        states,
        indexes: indexes.rows,
        unverifiedGates: [
          "embedding-input-freshness",
          "lexical-projection",
          "api-mcp-acceptance",
          "hosted-recovery",
          "source-completeness"
        ],
        readyForMoreStates: false
      },
      null,
      2
    )}\n`
  )
} finally {
  client.release()
  await pool.end()
}
