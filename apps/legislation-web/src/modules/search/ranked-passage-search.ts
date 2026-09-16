import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { SQL } from "drizzle-orm"
import { z } from "zod"
import { rankedSectionPageQuery, type RankedSectionFilters } from "./ranked-section-search.js"
import {
  hydrateRankedPassageSearch,
  RankedPassageHydrationError,
  type PassageSearchInput,
  type PassageSearchResultPage,
  validatePassageSearchInput
} from "./search.js"

const rankedRowsSchema = z.array(
  z.object({
    content_hash: z.string().min(1),
    document_id: z.string().min(1),
    heading: z.string().nullable(),
    id: z.string().min(1),
    page_end: z.number().int().nullable(),
    page_start: z.number().int().nullable(),
    score: z.coerce.number().finite().nonnegative(),
    search_document_title: z.string()
  })
)

export interface RankedPassageSearch {
  readonly generation: string
  search(input: PassageSearchInput): Promise<PassageSearchResultPage>
}

/** The ranked store supplies scores plus private freshness facts; canonical hydration supplies every public field. */
export function createRankedPassageSearch(
  options: Readonly<{
    canonicalDatabase: LegislationDatabase
    executeRankedQuery?: (query: SQL) => Promise<unknown>
    generation: string
    hydrate?: typeof hydrateRankedPassageSearch
    searchDatabase: LegislationDatabase
  }>
): RankedPassageSearch {
  return {
    generation: options.generation,
    search: async (input) => {
      const rankedInput: PassageSearchInput = {
        ...input,
        rankingGeneration: options.generation
      }
      let rankedQuery: ReturnType<typeof rankedSectionPageQuery>
      try {
        const { limit, offset, query } = validateRankedInput(rankedInput)
        rankedQuery = rankedSectionPageQuery({
          filters: rankedFilters(rankedInput),
          includeHydrationFields: true,
          limit: limit + 1,
          offset,
          query
        })
      } catch (error) {
        throw new LegislationError("invalid_request", "Invalid ranked passage search request", { cause: error })
      }
      try {
        const rawRows =
          options.executeRankedQuery === undefined
            ? (await options.searchDatabase.execute(rankedQuery)).rows
            : await options.executeRankedQuery(rankedQuery)
        const rows = rankedRowsSchema.parse(rawRows)
        assertRankedOrder(rows)
        const page = await (options.hydrate ?? hydrateRankedPassageSearch)(
          options.canonicalDatabase,
          rankedInput,
          rows.map((row) => ({
            contentHash: row.content_hash,
            documentId: row.document_id,
            documentTitle: row.search_document_title,
            heading: row.heading,
            pageEnd: row.page_end,
            pageStart: row.page_start,
            score: row.score,
            sectionId: row.id
          }))
        )
        return { ...page, search: { isReranked: false, models: [] } }
      } catch (error) {
        if (error instanceof RankedPassageHydrationError) {
          throw new LegislationError(
            "dependency_unavailable",
            "Ranked passage results are newer or older than the canonical record; retry after synchronization",
            {
              cause: error,
              details: {
                dependency: "passage_search_database",
                reason: error.reason,
                retryAfterSynchronization: true
              }
            }
          )
        }
        if (error instanceof LegislationError) {
          throw error
        }
        throw new LegislationError("dependency_unavailable", "Ranked passage search is temporarily unavailable", {
          cause: error,
          details: { dependency: "passage_search_database" }
        })
      }
    }
  }
}

function assertRankedOrder(rows: readonly z.infer<typeof rankedRowsSchema>[number][]): void {
  let previous: z.infer<typeof rankedRowsSchema>[number] | undefined
  for (const row of rows) {
    if (
      previous !== undefined &&
      (row.score > previous.score ||
        (row.score === previous.score && Buffer.compare(Buffer.from(row.id), Buffer.from(previous.id)) <= 0))
    ) {
      throw new Error("Ranked passage search returned an unstable order")
    }
    previous = row
  }
}

function validateRankedInput(input: PassageSearchInput) {
  return validatePassageSearchInput(input)
}

export function rankedFilters(input: PassageSearchInput): RankedSectionFilters {
  return {
    any: {
      billIds: input.billIds,
      classifications: input.classifications,
      jurisdictionIds: input.jurisdictionIds,
      sessionIds: input.sessionIds,
      sponsorIds: input.sponsorIds,
      statuses: input.statuses,
      subjects: input.subjects
    },
    documentClassifications: input.documentClassifications,
    documentIds: input.documentIds,
    headings: input.headings,
    pageFrom: input.pageFrom,
    pageTo: input.pageTo,
    range: {
      introducedAt: { gte: input.introducedFrom, lte: input.introducedTo },
      updatedAt: {
        gte: input.updatedFrom?.toISOString(),
        lt: input.updatedToExclusive?.toISOString(),
        lte: input.updatedTo?.toISOString()
      }
    },
    versionCodes: input.versionCodes
  }
}
