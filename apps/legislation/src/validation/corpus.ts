import { sql } from "drizzle-orm"
import type { LegislationDatabase } from "../db/database.js"
import {
  amendmentEmbeddingInputHash,
  billEmbeddingInputHash,
  materialSectionEmbeddingInputHash,
  needsEmbeddingRefresh,
  sectionEmbeddingInputHash,
  type EmbeddingFreshnessState
} from "../ingestion/embeddings/jobs.js"
import { embeddingRouteFor, type EmbeddingRoute } from "../models/embedding-routing.js"

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
  orphanVotes: sql`select count(*)::int as count from legislation.votes child left join legislation.bills parent on parent.id = child.bill_id where child.bill_id is not null and parent.id is null`,
  selfRelations: sql`select count(*)::int as count from legislation.bill_relations where bill_id = related_bill_id`
} as const

const entityQualityQueries = {
  ambiguousAmendments: sql`select count(*)::int as count from (select 1 from legislation.amendments group by jurisdiction_id, session_id, lower(printed_identifier) having count(*) > 1) duplicates`,
  ambiguousOrganizationNames: sql`select count(*)::int as count from (select 1 from legislation.organizations group by jurisdiction_id, lower(name) having count(*) > 1) duplicates`,
  impossibleMembershipDates: sql`select count(*)::int as count from legislation.organization_memberships where (effective_start_date is not null and effective_end_date is not null and effective_start_date > effective_end_date) or (detected_start_date is not null and detected_end_date is not null and detected_start_date > detected_end_date)`,
  impossibleTermDates: sql`select count(*)::int as count from legislation.legislative_terms where start_date is not null and end_date is not null and start_date > end_date`,
  missingActiveTermDistricts: sql`select count(*)::int as count from legislation.legislative_terms where is_active is true and district is null`,
  materialsWithoutLinks: sql`select count(*)::int as count from legislation.supporting_materials material where not exists (select 1 from legislation.supporting_material_links link where link.material_id = material.id)`,
  membershipsWithoutDates: sql`select count(*)::int as count from legislation.organization_memberships where effective_start_date is null and effective_end_date is null and detected_start_date is null and detected_end_date is null`,
  overlappingTerms: sql`select count(*)::int as count from legislation.legislative_terms left_term join legislation.legislative_terms right_term on left_term.person_id = right_term.person_id and left_term.id < right_term.id where left_term.start_date is not null and right_term.start_date is not null and coalesce(left_term.end_date, 'infinity'::date) >= right_term.start_date and coalesce(right_term.end_date, 'infinity'::date) >= left_term.start_date`,
  processedMaterialsWithoutText: sql`select count(*)::int as count from legislation.supporting_materials where processing_status = 'processed' and (text is null or btrim(text) = '')`,
  unlinkedBillCommittees: sql`select count(*)::int as count from legislation.bills bill cross join lateral unnest(bill.committees) committee(name) where not exists (select 1 from legislation.organizations organization where organization.jurisdiction_id = bill.jurisdiction_id and lower(organization.name) = lower(committee.name))`,
  unlinkedSponsors: sql`select count(*)::int as count from legislation.bill_sponsors where person_id is null`,
  unsupportedSupportingMaterials: sql`select count(*)::int as count from legislation.supporting_materials where processing_status = 'unsupported'`,
  votePositionTotalMismatches: sql`select count(*)::int as count from legislation.votes vote where exists (select 1 from legislation.vote_positions position where position.vote_id = vote.id) and coalesce(vote.yes_count, 0) + coalesce(vote.no_count, 0) + coalesce(vote.other_count, 0) <> (select count(*) from legislation.vote_positions position where position.vote_id = vote.id)`,
  votesWithoutPositions: sql`select count(*)::int as count from legislation.votes vote where coalesce(vote.yes_count, 0) + coalesce(vote.no_count, 0) + coalesce(vote.other_count, 0) > 0 and not exists (select 1 from legislation.vote_positions position where position.vote_id = vote.id)`
} as const

const EMBEDDING_INTEGRITY_PAGE_SIZE = 1_000
const embeddingIntegrityMetricNames = new Set([
  "missingAmendmentEmbeddings",
  "missingBillEmbeddings",
  "missingDocumentSectionEmbeddings",
  "missingSupportingMaterialSectionEmbeddings",
  "staleAmendmentEmbeddings",
  "staleBillEmbeddings",
  "staleDocumentSectionEmbeddings",
  "staleSupportingMaterialSectionEmbeddings"
])

interface AmendmentEmbeddingRow extends EmbeddingFreshnessState, Record<string, unknown> {
  description: null | string
  id: string
  printedIdentifier: string
  purpose: null | string
}

interface BillEmbeddingRow extends EmbeddingFreshnessState, Record<string, unknown> {
  id: string
  subjects: string[]
  summary: null | string
  title: string
}

interface SectionEmbeddingRow extends EmbeddingFreshnessState, Record<string, unknown> {
  heading: null | string
  id: string
  text: string
}

interface EmbeddingIntegrityCounts {
  missing: number
  stale: number
}

export function countEmbeddingIntegrity(
  records: readonly Readonly<{ inputHash: string } & EmbeddingFreshnessState>[],
  route: EmbeddingRoute
): EmbeddingIntegrityCounts {
  return records.reduce(
    (counts, record) => {
      if (!needsEmbeddingRefresh(record.inputHash, record, route)) {
        return counts
      }
      if (record.embedding === null) {
        counts.missing += 1
      } else {
        counts.stale += 1
      }
      return counts
    },
    { missing: 0, stale: 0 }
  )
}

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
  const amendmentEmbeddingIntegrity = await scanEmbeddingIntegrity(
    database,
    loadAmendmentEmbeddingRows,
    (row) => ({ ...row, inputHash: amendmentEmbeddingInputHash(row) }),
    embeddingRouteFor("structured-amendment")
  )
  const billEmbeddingIntegrity = await scanEmbeddingIntegrity(
    database,
    loadBillEmbeddingRows,
    (row) => ({
      ...row,
      inputHash: billEmbeddingInputHash(row)
    }),
    embeddingRouteFor("bill")
  )
  const documentSectionEmbeddingIntegrity = await scanEmbeddingIntegrity(
    database,
    loadDocumentSectionEmbeddingRows,
    (row) => ({ ...row, inputHash: sectionEmbeddingInputHash(row) }),
    embeddingRouteFor("document-section")
  )
  const supportingMaterialSectionEmbeddingIntegrity = await scanEmbeddingIntegrity(
    database,
    loadSupportingMaterialSectionEmbeddingRows,
    (row) => ({ ...row, inputHash: materialSectionEmbeddingInputHash(row) }),
    embeddingRouteFor("supporting-material-section")
  )
  Object.assign(metrics, {
    missingAmendmentEmbeddings: amendmentEmbeddingIntegrity.missing,
    missingBillEmbeddings: billEmbeddingIntegrity.missing,
    missingDocumentSectionEmbeddings: documentSectionEmbeddingIntegrity.missing,
    missingSupportingMaterialSectionEmbeddings: supportingMaterialSectionEmbeddingIntegrity.missing,
    staleAmendmentEmbeddings: amendmentEmbeddingIntegrity.stale,
    staleBillEmbeddings: billEmbeddingIntegrity.stale,
    staleDocumentSectionEmbeddings: documentSectionEmbeddingIntegrity.stale,
    staleSupportingMaterialSectionEmbeddings: supportingMaterialSectionEmbeddingIntegrity.stale
  })
  const completion = await database.execute<{
    amendments: number
    documents: number
    embedded_amendments: number
    embedded_bills: number
    embedded_sections: number
    processed_documents: number
    sections: number
    total_bills: number
  }>(sql`
    select
      (select count(*)::int from legislation.bills) as total_bills,
      (select count(*)::int from legislation.bill_embeddings) as embedded_bills,
      (select count(*)::int from legislation.amendments) as amendments,
      (select count(*)::int from legislation.amendment_embeddings) as embedded_amendments,
      (select count(*)::int from legislation.bill_documents) as documents,
      (select count(*)::int from legislation.bill_documents where processing_status = 'processed') as processed_documents,
      (select count(*)::int from legislation.document_sections) as sections,
      (select count(*)::int from legislation.document_section_embeddings) as embedded_sections
  `)
  const row = completion.rows[0]
  if (row !== undefined) {
    Object.assign(metrics, {
      amendments: row.amendments,
      documents: row.documents,
      embeddedAmendments: row.embedded_amendments,
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
    .filter(([name]) => name in validationQueries || embeddingIntegrityMetricNames.has(name))
    .reduce((total, [, count]) => total + count, 0)
  return { checkedAt: new Date().toISOString(), criticalIssues, metrics, valid: criticalIssues === 0 }
}

async function scanEmbeddingIntegrity<Row extends Readonly<{ id: string }>>(
  database: LegislationDatabase,
  load: (database: LegislationDatabase, afterId: string) => Promise<Row[]>,
  toFreshnessState: (row: Row) => Readonly<{ inputHash: string } & EmbeddingFreshnessState>,
  route: EmbeddingRoute
): Promise<EmbeddingIntegrityCounts> {
  const counts: EmbeddingIntegrityCounts = { missing: 0, stale: 0 }
  let afterId = ""
  while (true) {
    const rows = await load(database, afterId)
    const pageCounts = countEmbeddingIntegrity(rows.map(toFreshnessState), route)
    counts.missing += pageCounts.missing
    counts.stale += pageCounts.stale
    if (rows.length < EMBEDDING_INTEGRITY_PAGE_SIZE) {
      return counts
    }
    const lastRow = rows.at(-1)
    if (lastRow === undefined) {
      return counts
    }
    afterId = lastRow.id
  }
}

async function loadAmendmentEmbeddingRows(
  database: LegislationDatabase,
  afterId: string
): Promise<AmendmentEmbeddingRow[]> {
  const route = embeddingRouteFor("structured-amendment")
  const result = await database.execute<AmendmentEmbeddingRow>(sql`
    select
      source.id,
      source.purpose,
      source.description,
      source.printed_identifier as "printedIdentifier",
      stored.embedding,
      stored.input_hash as "embeddingInputHash",
      stored.input_contract as "embeddingInputContract",
      stored.model as "embeddingModel"
    from legislation.amendments source
    left join legislation.amendment_embeddings stored
      on stored.amendment_id = source.id
      and stored.model = ${route.model}
      and stored.input_contract = ${route.embeddingInputContract}
    where source.id > ${afterId}
    order by source.id
    limit ${EMBEDDING_INTEGRITY_PAGE_SIZE}
  `)
  return result.rows
}

async function loadBillEmbeddingRows(database: LegislationDatabase, afterId: string): Promise<BillEmbeddingRow[]> {
  const route = embeddingRouteFor("bill")
  const result = await database.execute<BillEmbeddingRow>(sql`
    select
      source.id,
      source.title,
      source.summary,
      source.subjects,
      stored.embedding,
      stored.input_hash as "embeddingInputHash",
      stored.input_contract as "embeddingInputContract",
      stored.model as "embeddingModel"
    from legislation.bills source
    left join legislation.bill_embeddings stored
      on stored.bill_id = source.id
      and stored.model = ${route.model}
      and stored.input_contract = ${route.embeddingInputContract}
    where source.id > ${afterId}
    order by source.id
    limit ${EMBEDDING_INTEGRITY_PAGE_SIZE}
  `)
  return result.rows
}

async function loadDocumentSectionEmbeddingRows(
  database: LegislationDatabase,
  afterId: string
): Promise<SectionEmbeddingRow[]> {
  const route = embeddingRouteFor("document-section")
  const result = await database.execute<SectionEmbeddingRow>(sql`
    select
      source.id,
      source.heading,
      source.text,
      stored.embedding,
      stored.input_hash as "embeddingInputHash",
      stored.input_contract as "embeddingInputContract",
      stored.model as "embeddingModel"
    from legislation.document_sections source
    left join legislation.document_section_embeddings stored
      on stored.section_id = source.id
      and stored.model = ${route.model}
      and stored.input_contract = ${route.embeddingInputContract}
    where source.id > ${afterId}
    order by source.id
    limit ${EMBEDDING_INTEGRITY_PAGE_SIZE}
  `)
  return result.rows
}

async function loadSupportingMaterialSectionEmbeddingRows(
  database: LegislationDatabase,
  afterId: string
): Promise<SectionEmbeddingRow[]> {
  const route = embeddingRouteFor("supporting-material-section")
  const result = await database.execute<SectionEmbeddingRow>(sql`
    select
      source.id,
      source.heading,
      source.text,
      stored.embedding,
      stored.input_hash as "embeddingInputHash",
      stored.input_contract as "embeddingInputContract",
      stored.model as "embeddingModel"
    from legislation.supporting_material_sections source
    left join legislation.supporting_material_section_embeddings stored
      on stored.section_id = source.id
      and stored.model = ${route.model}
      and stored.input_contract = ${route.embeddingInputContract}
    where source.id > ${afterId}
    order by source.id
    limit ${EMBEDDING_INTEGRITY_PAGE_SIZE}
  `)
  return result.rows
}
