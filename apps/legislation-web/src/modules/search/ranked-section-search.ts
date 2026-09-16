import { sql, type SQL } from "drizzle-orm"
import { compileRankedTextQuery } from "./ranked-text-query"

const arrayFields = [
  "billIds",
  "jurisdictionIds",
  "sessionIds",
  "classifications",
  "statuses",
  "subjects",
  "sponsorIds"
] as const
const rangeFields = ["introducedAt", "updatedAt", "submittedAt", "documentUpdatedAt"] as const
export type RankedSectionFilters = {
  any?: Partial<Record<(typeof arrayFields)[number], readonly string[]>>
  range?: Partial<Record<(typeof rangeFields)[number], { gte?: string; lte?: string; lt?: string }>>
  documentIds?: readonly string[]
  documentClassifications?: readonly string[]
  versionCodes?: readonly string[]
  headings?: readonly string[]
  pageFrom?: number
  pageTo?: number
}

function indexedFilter(expression: string) {
  // Filters are indexed, but must not alter relevance scores.
  return sql`id @@@ pdb.parse(${expression}, lenient => false, conjunction_mode => true)::pdb.const(0)`
}

function metadataEquals(field: string, value: string) {
  return indexedFilter(`search_metadata.${field}:${JSON.stringify(value)}`)
}

/** Filters precede LIMIT. No arbitrary prefilter candidate window is used. */
export function rankedSectionPageQuery(input: {
  query: string
  amendmentsOnly?: boolean
  filters?: RankedSectionFilters
  includeHydrationFields?: boolean
  limit: number
  offset?: number
}) {
  const offset = input.offset ?? 0
  if (
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 1000 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error("Invalid ranked section page")
  }
  const body = compileRankedTextQuery(input.query, "body")
  const expression = input.amendmentsOnly ? `(${body} OR ${compileRankedTextQuery(input.query, "title")})` : body
  const predicates: SQL[] = [
    sql`id @@@ pdb.parse(${expression}, lenient => false, conjunction_mode => true)`,
    metadataEquals("processingStatus", "processed")
  ]
  if (input.amendmentsOnly) {
    predicates.push(metadataEquals("documentClassifications", "amendment"))
  }
  for (const field of arrayFields) {
    const values = input.filters?.any?.[field]
    if (values === undefined) {
      continue
    }
    predicates.push(
      values.length === 0
        ? sql`false`
        : sql`(${sql.join(
            values.map((value) => metadataEquals(field, value)),
            sql` or `
          )})`
    )
  }
  for (const [field, values] of [
    ["documentClassifications", input.filters?.documentClassifications],
    ["versionCodes", input.filters?.versionCodes]
  ] as const) {
    if (values === undefined) {
      continue
    }
    predicates.push(
      values.length === 0
        ? sql`false`
        : sql`(${sql.join(
            values.map((value) => metadataEquals(field, value)),
            sql` or `
          )})`
    )
  }
  for (const field of rangeFields) {
    const range = input.filters?.range?.[field]
    if (range === undefined) {
      continue
    }
    // Epoch milliseconds avoid lexicographic timestamp/offset ordering mistakes.
    for (const [operator, value] of [
      [">=", range.gte],
      ["<=", range.lte],
      ["<", range.lt]
    ] as const) {
      if (value === undefined) {
        continue
      }
      const epoch = Date.parse(value)
      if (!Number.isFinite(epoch)) {
        throw new Error("Invalid ranked search date")
      }
      predicates.push(indexedFilter(`search_metadata.${field}:${operator}${epoch}`))
    }
  }
  for (const [column, values] of [
    ["document_id", input.filters?.documentIds],
    ["heading", input.filters?.headings]
  ] as const) {
    if (values === undefined) {
      continue
    }
    predicates.push(
      values.length === 0
        ? sql`false`
        : sql`(${sql.join(
            values.map((value) => indexedFilter(`${column}:${JSON.stringify(value)}`)),
            sql` or `
          )})`
    )
  }
  for (const page of [input.filters?.pageFrom, input.filters?.pageTo]) {
    if (page !== undefined && (!Number.isSafeInteger(page) || page < 1)) {
      throw new Error("Invalid ranked search page bound")
    }
  }
  if (
    input.filters?.pageFrom !== undefined &&
    input.filters.pageTo !== undefined &&
    input.filters.pageFrom > input.filters.pageTo
  ) {
    throw new Error("Ranked search page bounds are reversed")
  }
  if (input.filters?.pageFrom !== undefined) {
    predicates.push(indexedFilter(`page_end:>=${input.filters.pageFrom}`))
  }
  if (input.filters?.pageTo !== undefined) {
    predicates.push(indexedFilter(`page_start:<=${input.filters.pageTo}`))
  }
  const documentOrder = input.amendmentsOnly ? sql`document_id collate "C" asc,` : sql``
  const hydrationFields = input.includeHydrationFields
    ? sql`, content_hash, heading, page_start, page_end, search_document_title`
    : sql``
  return sql`select id, document_id${hydrationFields}, pdb.score(id) as score
    from legislation.document_sections where ${sql.join(predicates, sql` and `)}
    order by pdb.score(id) desc, ${documentOrder} id collate "C" asc
    limit ${input.limit} offset ${offset}`
}

export type RankedSectionHit = {
  content_hash?: string
  document_id: string
  heading?: string | null
  id: string
  page_end?: number | null
  page_start?: number | null
  score: number
  search_document_title?: string
}

/**
 * Exact best-section grouping. The caller must hold a repeatable-read snapshot
 * across every fetch. Equal scores are ordered by bytewise document ID then section ID.
 * Deadline/cancellation errors propagate; never label a capped prefix complete.
 */
export async function collectRankedAmendments(
  fetchPage: (offset: number, limit: number) => Promise<readonly RankedSectionHit[]>,
  count: number,
  batchSize = 100
): Promise<RankedSectionHit[]> {
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 1000
  ) {
    throw new Error("Invalid amendment collection size")
  }
  const seen = new Set<string>()
  const results: RankedSectionHit[] = []
  let offset = 0
  let previous: RankedSectionHit | undefined
  for (;;) {
    const rows = await fetchPage(offset, batchSize)
    if (rows.length > batchSize) {
      throw new Error("Ranked search exceeded its requested batch")
    }
    for (const row of rows) {
      if (!Number.isFinite(row.score) || row.score < 0) {
        throw new Error("Invalid ranked search score")
      }
      if (
        previous !== undefined &&
        (row.score > previous.score ||
          (row.score === previous.score &&
            (Buffer.compare(Buffer.from(row.document_id), Buffer.from(previous.document_id)) < 0 ||
              (row.document_id === previous.document_id &&
                Buffer.compare(Buffer.from(row.id), Buffer.from(previous.id)) <= 0))))
      ) {
        throw new Error("Ranked amendment stream is not strictly ordered")
      }
      previous = row
      if (!seen.has(row.document_id)) {
        seen.add(row.document_id)
        results.push(row)
        if (results.length === count) {
          return results
        }
      }
    }
    if (rows.length < batchSize) {
      return results
    }
    offset += rows.length
    if (!Number.isSafeInteger(offset)) {
      throw new Error("Ranked search offset overflow")
    }
  }
}
