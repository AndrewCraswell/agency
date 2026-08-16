import { sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"

export interface CorpusValidationReport {
  checkedAt: string
  criticalIssues: number
  metrics: Record<string, number>
  valid: boolean
}

const validationQueries = {
  billsWithoutRequiredText: sql`select count(*)::int as count from legislation.bills where btrim(identifier) = '' or btrim(title) = '' or btrim(source_url) = ''`,
  duplicateBillIdentifiers: sql`select count(*)::int as count from (select 1 from legislation.bills group by jurisdiction_id, session_id, identifier having count(*) > 1) duplicates`,
  duplicateDocumentSections: sql`select count(*)::int as count from (select 1 from legislation.document_sections group by document_id, ordinal having count(*) > 1) duplicates`,
  invalidSessionDates: sql`select count(*)::int as count from legislation.legislative_sessions where start_date is not null and end_date is not null and start_date > end_date`,
  orphanActions: sql`select count(*)::int as count from legislation.bill_actions child left join legislation.bills parent on parent.id = child.bill_id where parent.id is null`,
  orphanDocuments: sql`select count(*)::int as count from legislation.bill_documents child left join legislation.bills parent on parent.id = child.bill_id where parent.id is null`,
  orphanSponsors: sql`select count(*)::int as count from legislation.bill_sponsors child left join legislation.bills parent on parent.id = child.bill_id where parent.id is null`,
  orphanSections: sql`select count(*)::int as count from legislation.document_sections child left join legislation.bill_documents parent on parent.id = child.document_id where parent.id is null`,
  orphanVotePositions: sql`select count(*)::int as count from legislation.vote_positions child left join legislation.votes parent on parent.id = child.vote_id where parent.id is null`,
  orphanVotes: sql`select count(*)::int as count from legislation.votes child left join legislation.bills parent on parent.id = child.bill_id where parent.id is null`,
  selfRelations: sql`select count(*)::int as count from legislation.bill_relations where bill_id = related_bill_id`
} as const

export async function validateCorpus(database: LegislationDatabase): Promise<CorpusValidationReport> {
  const metrics: Record<string, number> = {}
  for (const [name, query] of Object.entries(validationQueries)) {
    const result = await database.execute<{ count: number }>(query)
    metrics[name] = result.rows[0]?.count ?? 0
  }
  const completion = await database.execute<{
    documents: number
    embedded_bills: number
    embedded_sections: number
    processed_documents: number
    sections: number
    total_bills: number
  }>(sql`
    select
      (select count(*)::int from legislation.bills) as total_bills,
      (select count(*)::int from legislation.bills where embedding is not null) as embedded_bills,
      (select count(*)::int from legislation.bill_documents) as documents,
      (select count(*)::int from legislation.bill_documents where processing_status = 'processed') as processed_documents,
      (select count(*)::int from legislation.document_sections) as sections,
      (select count(*)::int from legislation.document_sections where embedding is not null) as embedded_sections
  `)
  const row = completion.rows[0]
  if (row !== undefined) {
    Object.assign(metrics, {
      documents: row.documents,
      embeddedBills: row.embedded_bills,
      embeddedSections: row.embedded_sections,
      processedDocuments: row.processed_documents,
      sections: row.sections,
      totalBills: row.total_bills
    })
  }
  const unresolvedRelations = await database.execute<{ count: number }>(sql`
    select count(*)::int as count
    from legislation.bill_relations relation
    left join legislation.bills related on related.id = relation.related_bill_id
    where related.id is null
  `)
  metrics.unresolvedRelations = unresolvedRelations.rows[0]?.count ?? 0
  const criticalIssues = Object.entries(metrics)
    .filter(([name]) => name in validationQueries)
    .reduce((total, [, count]) => total + count, 0)
  return { checkedAt: new Date().toISOString(), criticalIssues, metrics, valid: criticalIssues === 0 }
}
