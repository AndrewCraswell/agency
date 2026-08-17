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
  documentTypes: Array<{
    classification: string
    documents: number
    failed: number
    jurisdictionId: string
    processed: number
  }>
  documentQuality: {
    emptyText: number
    extractionFailures: number
    fallbackSegmentation: number
    lowText: number
    total: number
  }
  embeddingCoverage: {
    bills: { embedded: number; oldestMissingAt?: string; total: number }
    sections: { embedded: number; oldestMissingAt?: string; total: number }
  }
  federalBillTypes: Array<{ billType: string; bills: number; congress: string; documents: number }>
  eventCoverage: Array<{
    availability: "observed-data" | "observed-empty"
    deleted: number
    events: number
    jurisdictionId: string
    latestEventAt?: string
    latestObservedAt?: string
    latestSourceUpdatedAt?: string
    upcomingEvents: number
  }>
  generatedAt: string
  ingestionFailureCategories: Array<{
    failedRecords: number
    failedRuns: number
    operation: string
    partialRuns: number
    source: string
  }>
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
    sponsors: number
    votes: number
  }>
  supportingMaterialTypes: Array<{ classification: string; jurisdictionId: string; materials: number }>
  totals: {
    actions: number
    bills: number
    documents: number
    processedDocuments: number
    sections: number
    sponsors: number
    votes: number
  }
  version: 1
  voteCoverage: Array<{
    jurisdictionId: string
    positions: number
    sessionId: string
    votes: number
    votesWithPositions: number
    votesWithSourceUrl: number
  }>
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
  const sponsorCounts = await coverageCount(database, "bill_sponsors")
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
  const sponsorsBySession = countBySession(sponsorCounts.rows)
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
    sponsors: sponsorsBySession.get(session.session_id) ?? 0,
    votes: votesBySession.get(session.session_id) ?? 0
  }))
  const totals = rows.reduce(
    (result, row) => ({
      actions: result.actions + row.actions,
      bills: result.bills + row.bills,
      documents: result.documents + row.documents,
      processedDocuments: result.processedDocuments + row.processedDocuments,
      sections: result.sections + row.sections,
      sponsors: result.sponsors + row.sponsors,
      votes: result.votes + row.votes
    }),
    { actions: 0, bills: 0, documents: 0, processedDocuments: 0, sections: 0, sponsors: 0, votes: 0 }
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
  const failureCategories = await database.execute<{
    failed_records: number
    failed_runs: number
    operation: string
    partial_runs: number
    source: string
  }>(sql`
    select
      source,
      operation,
      coalesce(sum((counts->>'failed')::int), 0)::int as failed_records,
      count(*) filter (where status = 'partial')::int as partial_runs,
      count(*) filter (where status = 'failed')::int as failed_runs
    from legislation.ingestion_runs
    where status in ('partial', 'failed') or coalesce((counts->>'failed')::int, 0) > 0
    group by source, operation
    order by source, operation
  `)
  const [
    documentProcessing,
    documentTypes,
    eventCoverage,
    supportingMaterialTypes,
    voteCoverage,
    documentQualityResult,
    billEmbeddings,
    sectionEmbeddings,
    checkpoints
  ] = await Promise.all([
    database
      .select({ count: sql<number>`count(*)::int`, status: billDocuments.processingStatus })
      .from(billDocuments)
      .groupBy(billDocuments.processingStatus)
      .orderBy(billDocuments.processingStatus),
    database.execute<{
      classification: string
      documents: number
      failed: number
      jurisdiction_id: string
      processed: number
    }>(sql`
      select
        bills.jurisdiction_id,
        coalesce(documents.classification, 'unclassified') as classification,
        count(*)::int as documents,
        count(*) filter (where documents.processing_status = 'processed')::int as processed,
        count(*) filter (where documents.processing_status in ('failed', 'unsupported'))::int as failed
      from legislation.bill_documents documents
      join legislation.bills bills on bills.id = documents.bill_id
      group by bills.jurisdiction_id, coalesce(documents.classification, 'unclassified')
      order by bills.jurisdiction_id, classification
    `),
    database.execute<{
      deleted: number
      events: number
      jurisdiction_id: string
      latest_event_at: Date | string | null
      latest_observed_at: Date | string | null
      latest_source_updated_at: Date | string | null
      upcoming_events: number
    }>(sql`
      select
        jurisdictions.id as jurisdiction_id,
        count(events.id)::int as events,
        count(events.id) filter (where events.is_deleted)::int as deleted,
        count(events.id) filter (
          where events.start_at >= now() and not events.is_deleted
        )::int as upcoming_events,
        max(events.start_at) as latest_event_at,
        max(events.source_updated_at) as latest_source_updated_at,
        max(events.updated_at) as latest_observed_at
      from legislation.jurisdictions jurisdictions
      left join legislation.legislative_events events on events.jurisdiction_id = jurisdictions.id
      group by jurisdictions.id
      order by jurisdictions.id
    `),
    database.execute<{ classification: string; jurisdiction_id: string; materials: number }>(sql`
      select jurisdiction_id, classification, count(*)::int as materials
      from legislation.supporting_materials
      group by jurisdiction_id, classification
      order by jurisdiction_id, classification
    `),
    database.execute<{
      jurisdiction_id: string
      positions: number
      session_id: string
      votes: number
      votes_with_positions: number
      votes_with_source_url: number
    }>(sql`
      select
        bills.jurisdiction_id,
        bills.session_id,
        count(distinct votes.id)::int as votes,
        count(positions.vote_id)::int as positions,
        count(distinct votes.id) filter (where positions.vote_id is not null)::int as votes_with_positions,
        count(distinct votes.id) filter (where votes.source_url is not null)::int as votes_with_source_url
      from legislation.votes votes
      join legislation.bills bills on bills.id = votes.bill_id
      left join legislation.vote_positions positions on positions.vote_id = votes.id
      group by bills.jurisdiction_id, bills.session_id
      order by bills.jurisdiction_id, bills.session_id
    `),
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
        oldestMissingAt: sql<Date | null>`min(${bills.updatedAt}) filter (where ${bills.embedding} is null)`,
        total: sql<number>`count(*)::int`
      })
      .from(bills),
    database
      .select({
        embedded: sql<number>`count(*) filter (where ${documentSections.embedding} is not null)::int`,
        oldestMissingAt: sql<Date | null>`min(${documentSections.updatedAt}) filter (where ${documentSections.embedding} is null)`,
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
    documentTypes: documentTypes.rows.map((row) => ({
      classification: row.classification,
      documents: row.documents,
      failed: row.failed,
      jurisdictionId: row.jurisdiction_id,
      processed: row.processed
    })),
    documentQuality: {
      emptyText: documentQualityResult.rows[0]?.empty_text ?? 0,
      extractionFailures: documentQualityResult.rows[0]?.extraction_failures ?? 0,
      fallbackSegmentation: documentQualityResult.rows[0]?.fallback_segmentation ?? 0,
      lowText: documentQualityResult.rows[0]?.low_text ?? 0,
      total: documentQualityResult.rows[0]?.total ?? 0
    },
    embeddingCoverage: {
      bills: {
        embedded: billEmbeddings[0]?.embedded ?? 0,
        oldestMissingAt: timestamp(billEmbeddings[0]?.oldestMissingAt ?? null),
        total: billEmbeddings[0]?.total ?? 0
      },
      sections: {
        embedded: sectionEmbeddings[0]?.embedded ?? 0,
        oldestMissingAt: timestamp(sectionEmbeddings[0]?.oldestMissingAt ?? null),
        total: sectionEmbeddings[0]?.total ?? 0
      }
    },
    federalBillTypes: federalBillTypes.rows.map((row) => ({
      billType: row.bill_type,
      bills: row.bills,
      congress: row.congress,
      documents: row.documents
    })),
    eventCoverage: eventCoverage.rows.map((row) => ({
      availability: row.events === 0 ? "observed-empty" : "observed-data",
      deleted: row.deleted,
      events: row.events,
      jurisdictionId: row.jurisdiction_id,
      latestEventAt: timestamp(row.latest_event_at),
      latestObservedAt: timestamp(row.latest_observed_at),
      latestSourceUpdatedAt: timestamp(row.latest_source_updated_at),
      upcomingEvents: row.upcoming_events
    })),
    generatedAt: new Date().toISOString(),
    ingestionFailureCategories: failureCategories.rows.map((row) => ({
      failedRecords: row.failed_records,
      failedRuns: row.failed_runs,
      operation: row.operation,
      partialRuns: row.partial_runs,
      source: row.source
    })),
    ingestionFailures: failureResult[0]?.count ?? 0,
    scopes: rows.map((row) => ({ ...row, availability: row.bills === 0 ? "empty" : "available" })),
    supportingMaterialTypes: supportingMaterialTypes.rows.map((row) => ({
      classification: row.classification,
      jurisdictionId: row.jurisdiction_id,
      materials: row.materials
    })),
    totals,
    version: 1,
    voteCoverage: voteCoverage.rows.map((row) => ({
      jurisdictionId: row.jurisdiction_id,
      positions: row.positions,
      sessionId: row.session_id,
      votes: row.votes,
      votesWithPositions: row.votes_with_positions,
      votesWithSourceUrl: row.votes_with_source_url
    }))
  }
}

function countBySession(rows: Array<{ count: number; session_id: string }>): Map<string, number> {
  return new Map(rows.map((row) => [row.session_id, row.count]))
}

function timestamp(value: Date | string | null): string | undefined {
  return value === null ? undefined : new Date(value).toISOString()
}

function coverageCount(database: LegislationDatabase, table: "bill_actions" | "bill_sponsors" | "bills" | "votes") {
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
