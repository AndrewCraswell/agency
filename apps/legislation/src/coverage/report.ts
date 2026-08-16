import { eq, sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import {
  billActions,
  billDocuments,
  bills,
  documentSections,
  ingestionRuns,
  jurisdictions,
  legislativeSessions,
  syncCheckpoints,
  votes
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
  const rows = await database
    .select({
      actions: sql<number>`count(distinct ${billActions.id})::int`,
      bills: sql<number>`count(distinct ${bills.id})::int`,
      documents: sql<number>`count(distinct ${billDocuments.id})::int`,
      jurisdictionId: jurisdictions.id,
      jurisdictionType: jurisdictions.classification,
      processedDocuments: sql<number>`count(distinct ${billDocuments.id}) filter (where ${billDocuments.processingStatus} = 'processed')::int`,
      sections: sql<number>`count(distinct ${documentSections.id})::int`,
      sessionId: legislativeSessions.id,
      sessionIdentifier: legislativeSessions.identifier,
      votes: sql<number>`count(distinct ${votes.id})::int`
    })
    .from(legislativeSessions)
    .innerJoin(jurisdictions, eq(jurisdictions.id, legislativeSessions.jurisdictionId))
    .leftJoin(bills, eq(bills.sessionId, legislativeSessions.id))
    .leftJoin(billActions, eq(billActions.billId, bills.id))
    .leftJoin(votes, eq(votes.billId, bills.id))
    .leftJoin(billDocuments, eq(billDocuments.billId, bills.id))
    .leftJoin(documentSections, eq(documentSections.documentId, billDocuments.id))
    .groupBy(jurisdictions.id, jurisdictions.classification, legislativeSessions.id, legislativeSessions.identifier)
    .orderBy(jurisdictions.id, legislativeSessions.identifier)
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
