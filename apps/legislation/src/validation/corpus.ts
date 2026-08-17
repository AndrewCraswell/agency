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

const entityQualityQueries = {
  ambiguousAmendments: sql`select count(*)::int as count from (select 1 from legislation.amendments group by jurisdiction_id, session_id, lower(printed_identifier) having count(*) > 1) duplicates`,
  ambiguousOrganizationNames: sql`select count(*)::int as count from (select 1 from legislation.organizations group by jurisdiction_id, lower(name) having count(*) > 1) duplicates`,
  impossibleMembershipDates: sql`select count(*)::int as count from legislation.organization_memberships where start_date is not null and end_date is not null and start_date > end_date`,
  impossibleTermDates: sql`select count(*)::int as count from legislation.legislative_terms where start_date is not null and end_date is not null and start_date > end_date`,
  missingActiveTermDistricts: sql`select count(*)::int as count from legislation.legislative_terms where is_active is true and district is null`,
  materialsWithoutLinks: sql`select count(*)::int as count from legislation.supporting_materials material where not exists (select 1 from legislation.supporting_material_links link where link.material_id = material.id)`,
  membershipsWithoutDates: sql`select count(*)::int as count from legislation.organization_memberships where start_date is null and end_date is null`,
  overlappingTerms: sql`select count(*)::int as count from legislation.legislative_terms left_term join legislation.legislative_terms right_term on left_term.person_id = right_term.person_id and left_term.id < right_term.id where left_term.start_date is not null and right_term.start_date is not null and coalesce(left_term.end_date, 'infinity'::date) >= right_term.start_date and coalesce(right_term.end_date, 'infinity'::date) >= left_term.start_date`,
  processedMaterialsWithoutText: sql`select count(*)::int as count from legislation.supporting_materials where processing_status = 'processed' and (text is null or btrim(text) = '')`,
  unlinkedBillCommittees: sql`select count(*)::int as count from legislation.bills bill cross join lateral unnest(bill.committees) committee(name) where not exists (select 1 from legislation.organizations organization where organization.jurisdiction_id = bill.jurisdiction_id and lower(organization.name) = lower(committee.name))`,
  unlinkedSponsors: sql`select count(*)::int as count from legislation.bill_sponsors where person_id is null`,
  unsupportedSupportingMaterials: sql`select count(*)::int as count from legislation.supporting_materials where processing_status = 'unsupported'`,
  votePositionTotalMismatches: sql`select count(*)::int as count from legislation.votes vote where exists (select 1 from legislation.vote_positions position where position.vote_id = vote.id) and coalesce(vote.yes_count, 0) + coalesce(vote.no_count, 0) + coalesce(vote.other_count, 0) <> (select count(*) from legislation.vote_positions position where position.vote_id = vote.id)`,
  votesWithoutPositions: sql`select count(*)::int as count from legislation.votes vote where coalesce(vote.yes_count, 0) + coalesce(vote.no_count, 0) + coalesce(vote.other_count, 0) > 0 and not exists (select 1 from legislation.vote_positions position where position.vote_id = vote.id)`
} as const

export async function validateCorpus(database: LegislationDatabase): Promise<CorpusValidationReport> {
  const metrics: Record<string, number> = {}
  for (const [name, query] of Object.entries(validationQueries)) {
    const result = await database.execute<{ count: number }>(query)
    metrics[name] = result.rows[0]?.count ?? 0
  }
  for (const [name, query] of Object.entries(entityQualityQueries)) {
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
