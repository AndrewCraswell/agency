import { createDatabase } from "@repo/legislation-core/database/database"
import { embeddingRouteFor } from "@repo/legislation-core/embeddings/embedding-routing"
import { loadConfig } from "../../src/config/config.js"

// Deliberately local and read-only. This report does not activate hosted work or
// equate vector existence with input-hash freshness/search acceptance.
const config = loadConfig({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
})
const { pool } = createDatabase(config.database, { statementTimeoutMs: 30_000 })
const client = await pool.connect()
try {
  await client.query("begin transaction isolation level repeatable read read only")
  const billRoute = embeddingRouteFor("bill")
  const sectionRoute = embeddingRouteFor("document-section")
  const report = await client.query(
    `
    with scope(state, prefix) as (values ('nc', 'bill:nc:2025:%'), ('ak', 'bill:ak:34:%'))
    select scope.state,
      (select count(*)::int from legislation.bills b where b.id like scope.prefix) as bills,
      (select count(*)::int from legislation.bills b where b.id like scope.prefix and not exists (
        select 1 from legislation.bill_embeddings e where e.bill_id=b.id
          and e.model=$1 and e.input_contract=$2 and e.dimensions=$3
      )) as bills_missing_routed_embeddings,
      (select jsonb_object_agg(status, total) from (
        select d.processing_status as status, count(*)::int as total
        from legislation.bill_documents d where d.bill_id like scope.prefix group by d.processing_status
      ) statuses) as document_statuses,
      (select count(*)::int from legislation.bill_documents d where d.bill_id like scope.prefix
        and d.ocr_status='processed') as ocr_processed,
      (select count(*)::int from legislation.bill_documents d where d.bill_id like scope.prefix
        and d.processing_error_category='ocr-required' and d.processing_status <> 'processed') as unresolved_ocr,
      (select count(*)::int from legislation.bill_documents d where d.bill_id like scope.prefix
        and d.processing_status='processed' and not exists (
          select 1 from legislation.document_sections s where s.document_id=d.id
        )) as processed_documents_without_sections,
      (select count(*)::int from legislation.document_sections s join legislation.bill_documents d on d.id=s.document_id
        where d.bill_id like scope.prefix) as sections,
      (select count(*)::int from legislation.document_sections s join legislation.bill_documents d on d.id=s.document_id
        where d.bill_id like scope.prefix and not exists (
          select 1 from legislation.document_section_embeddings e where e.section_id=s.id
            and e.model=$4 and e.input_contract=$5 and e.dimensions=$6
        )) as sections_missing_routed_embeddings
    from scope order by scope.state
  `,
    [
      billRoute.model,
      billRoute.embeddingInputContract,
      billRoute.dimensions,
      sectionRoute.model,
      sectionRoute.embeddingInputContract,
      sectionRoute.dimensions
    ]
  )
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
        environment: "local",
        productionWrites: false,
        states: report.rows,
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
