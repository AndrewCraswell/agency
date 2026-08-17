import { sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import {
  billDocuments,
  bills,
  documentSections,
  ingestionRuns,
  syncCheckpoints
} from "../db/schema/schema.js"

export interface CoverageReport {
  checkpoints: Array<{
    cursor: Readonly<Record<string, unknown>>
    source: string
    stream: string
    updatedAt: string
    watermark?: string
  }>
  documentProcessing: Array<{ count: number; status: string }>
  documentQuality: {
    emptyText: number
    extractionFailures: number
    fallbackSegmentation: number
    lowText: number
    total: number
  }
  embeddingCoverage: {
    bills: { embedded: number; total: number }
    sections: { embedded: number; total: number }
  }
  federalBillTypes: Array<{ billType: string; bills: number; congress: string; documents: number }>
  generatedAt: string
  ingestionFailures: number
  scopes: Array<{
    actions: number
    availability: "available" | "empty"
    bills: number
    documents: number
    jurisdictionId: string
    jurisdictionType: string
    processedDocuments: number
    sections: number
    sessionId: string
    sessionIdentifier: string
    votes: number
  }>
  totals: { actions: number; bills: number; documents: number; processedDocuments: number; sections: number; votes: number }
  version: 1
}

export interface CoverageComparison {
  federalBillChanges: Array<{ billType: string; congress: string; delta: number }>
  regressions: string[]
  scopeBillChanges: Array<{ delta: number; sessionId: string }>
  totalChanges: { bills: number; documents: number; sections: number }
}

export function isCoverageReport(value: unknown): value is CoverageReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "scopes" in value &&
    Array.isArray(value.scopes) &&
    "federalBillTypes" in value &&
    Array.isArray(value.federalBillTypes) &&
    "totals" in value &&
    typeof value.totals === "object" &&
    value.totals !== null
  )
}

export function compareCoverageReports(previous: CoverageReport, current: CoverageReport): CoverageComparison {
  const currentScopes = new Map(current.scopes.map((scope) => [scope.sessionId, scope.bills]))
  const scopeBillChanges = previous.scopes.map((scope) => ({
    delta: (currentScopes.get(scope.sessionId) ?? 0) - scope.bills,
    sessionId: scope.sessionId
  }))
  const currentFederal = new Map(
    current.federalBillTypes.map((row) => [`${row.congress}:${row.billType}`, row.bills])
  )
  const federalBillChanges = previous.federalBillTypes.map((row) => ({
    billType: row.billType,
    congress: row.congress,
    delta: (currentFederal.get(`${row.congress}:${row.billType}`) ?? 0) - row.bills
  }))
  const regressions = [
    ...scopeBillChanges.filter((change) => change.delta < 0).map((change) => `scope:${change.sessionId}`),
    ...federalBillChanges
      .filter((change) => change.delta < 0)
      .map((change) => `federal:${change.congress}:${change.billType}`)
  ]
  return {
    federalBillChanges,
    regressions,
    scopeBillChanges,
    totalChanges: {
      bills: current.totals.bills - previous.totals.bills,
      documents: current.totals.documents - previous.totals.documents,
      sections: current.totals.sections - previous.totals.sections
    }
  }
}

export async function generateCoverageReport(database: LegislationDatabase): Promise<CoverageReport> {
  const sessions = await database.execute<{
    jurisdiction_id: string
    jurisdiction_type: string
    session_id: string
    session_identifier: string
  }>(sql`
    select
      jurisdictions.id as jurisdiction_id,
      jurisdictions.classification as jurisdiction_type,
      sessions.id as session_id,
      sessions.identifier as session_identifier
    from legislation.legislative_sessions sessions
    join legislation.jurisdictions jurisdictions on jurisdictions.id = sessions.jurisdiction_id
    order by jurisdictions.id, sessions.identifier
  `)
  // Run the full-table aggregates sequentially so reporting does not contend with ingestion on the development database.
  const billCounts = await coverageCount(database, "bills")
  const actionCounts = await coverageCount(database, "bill_actions")
  const voteCounts = await coverageCount(database, "votes")
  const documentCounts = await database.execute<{ count: number; processed: number; session_id: string }>(sql`
    select
      bills.session_id,
      count(*)::int as count,
      count(*) filter (where documents.processing_status = 'processed')::int as processed
    from legislation.bill_documents documents
    join legislation.bills bills on bills.id = documents.bill_id
    group by bills.session_id
  `)
  const sectionCounts = await database.execute<{ count: number; session_id: string }>(sql`
    select bills.session_id, count(*)::int as count
    from legislation.document_sections sections
    join legislation.bill_documents documents on documents.id = sections.document_id
    join legislation.bills bills on bills.id = documents.bill_id
    group by bills.session_id
  `)
  const billsBySession = countBySession(billCounts.rows)
  const actionsBySession = countBySession(actionCounts.rows)
  const votesBySession = countBySession(voteCounts.rows)
  const documentsBySession = countBySession(documentCounts.rows)
  const processedBySession = new Map(documentCounts.rows.map((row) => [row.session_id, row.processed]))
  const sectionsBySession = countBySession(sectionCounts.rows)
  const rows = sessions.rows.map((session) => ({
    actions: actionsBySession.get(session.session_id) ?? 0,
    bills: billsBySession.get(session.session_id) ?? 0,
    documents: documentsBySession.get(session.session_id) ?? 0,
    jurisdictionId: session.jurisdiction_id,
    jurisdictionType: session.jurisdiction_type,
    processedDocuments: processedBySession.get(session.session_id) ?? 0,
    sections: sectionsBySession.get(session.session_id) ?? 0,
    sessionId: session.session_id,
    sessionIdentifier: session.session_identifier,
    votes: votesBySession.get(session.session_id) ?? 0
  }))
  const totals = rows.reduce(
    (result, row) => ({
      actions: result.actions + row.actions,
      bills: result.bills + row.bills,
      documents: result.documents + row.documents,
      processedDocuments: result.processedDocuments + row.processedDocuments,
      sections: result.sections + row.sections,
      votes: result.votes + row.votes
    }),
    { actions: 0, bills: 0, documents: 0, processedDocuments: 0, sections: 0, votes: 0 }
  )
  const federalBillTypes = await database.execute<{
    bill_type: string
    bills: number
    congress: string
    documents: number
  }>(sql`
    select
      sessions.identifier as congress,
      lower(btrim((regexp_match(bills.identifier, '^([A-Za-z. -]+?)\\s*[0-9]'))[1])) as bill_type,
      count(distinct bills.id)::int as bills,
      count(distinct documents.id)::int as documents
    from legislation.bills bills
    join legislation.legislative_sessions sessions on sessions.id = bills.session_id
    left join legislation.bill_documents documents on documents.bill_id = bills.id
    where bills.jurisdiction_id = 'jurisdiction:us'
    group by sessions.identifier, bill_type
    order by sessions.identifier, bill_type
  `)
  const failureResult = await database
    .select({ count: sql<number>`coalesce(sum((${ingestionRuns.counts}->>'failed')::int), 0)::int` })
    .from(ingestionRuns)
  const [documentProcessing, documentQualityResult, billEmbeddings, sectionEmbeddings, checkpoints] = await Promise.all([
    database
      .select({ count: sql<number>`count(*)::int`, status: billDocuments.processingStatus })
      .from(billDocuments)
      .groupBy(billDocuments.processingStatus)
      .orderBy(billDocuments.processingStatus),
    database.execute<{
      empty_text: number
      extraction_failures: number
      fallback_segmentation: number
      low_text: number
      total: number
    }>(sql`
      select
        count(*)::int as total,
        count(*) filter (where processing_error ilike '%empty%' or processing_error ilike '%no usable text%')::int as empty_text,
        count(*) filter (where processing_error ilike '%image-only%' or processing_error ilike '%too little usable text%')::int as low_text,
        count(*) filter (where processing_status in ('failed', 'unsupported'))::int as extraction_failures,
        count(*) filter (
          where processing_status = 'processed'
          and exists (select 1 from legislation.document_sections sections where sections.document_id = bill_documents.id)
          and not exists (
            select 1 from legislation.document_sections sections
            where sections.document_id = bill_documents.id and sections.heading is not null
          )
        )::int as fallback_segmentation
      from legislation.bill_documents
    `),
    database
      .select({
        embedded: sql<number>`count(*) filter (where ${bills.embedding} is not null)::int`,
        total: sql<number>`count(*)::int`
      })
      .from(bills),
    database
      .select({
        embedded: sql<number>`count(*) filter (where ${documentSections.embedding} is not null)::int`,
        total: sql<number>`count(*)::int`
      })
      .from(documentSections),
    database.select().from(syncCheckpoints).orderBy(syncCheckpoints.source, syncCheckpoints.stream)
  ])
  return {
    checkpoints: checkpoints.map((checkpoint) => ({
      cursor: checkpoint.cursor,
      source: checkpoint.source,
      stream: checkpoint.stream,
      updatedAt: checkpoint.updatedAt.toISOString(),
      watermark: checkpoint.watermark?.toISOString()
    })),
    documentProcessing,
    documentQuality: {
      emptyText: documentQualityResult.rows[0]?.empty_text ?? 0,
      extractionFailures: documentQualityResult.rows[0]?.extraction_failures ?? 0,
      fallbackSegmentation: documentQualityResult.rows[0]?.fallback_segmentation ?? 0,
      lowText: documentQualityResult.rows[0]?.low_text ?? 0,
      total: documentQualityResult.rows[0]?.total ?? 0
    },
    embeddingCoverage: {
      bills: billEmbeddings[0] ?? { embedded: 0, total: 0 },
      sections: sectionEmbeddings[0] ?? { embedded: 0, total: 0 }
    },
    federalBillTypes: federalBillTypes.rows.map((row) => ({
      billType: row.bill_type,
      bills: row.bills,
      congress: row.congress,
      documents: row.documents
    })),
    generatedAt: new Date().toISOString(),
    ingestionFailures: failureResult[0]?.count ?? 0,
    scopes: rows.map((row) => ({ ...row, availability: row.bills === 0 ? "empty" : "available" })),
    totals,
    version: 1
  }
}

function countBySession(rows: Array<{ count: number; session_id: string }>): Map<string, number> {
  return new Map(rows.map((row) => [row.session_id, row.count]))
}

function coverageCount(database: LegislationDatabase, table: "bill_actions" | "bills" | "votes") {
  if (table === "bills") {
    return database.execute<{ count: number; session_id: string }>(sql`
      select session_id, count(*)::int as count from legislation.bills group by session_id
    `)
  }
  const identifier = sql.identifier(table)
  return database.execute<{ count: number; session_id: string }>(sql`
    select bills.session_id, count(*)::int as count
    from legislation.${identifier} records
    join legislation.bills bills on bills.id = records.bill_id
    group by bills.session_id
  `)
}
