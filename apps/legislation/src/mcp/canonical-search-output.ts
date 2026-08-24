import { z } from "zod"
import {
  projectBillSearchHit,
  type BillSearchCandidateRead,
  type BillSearchExecution,
  type BillSearchHit,
  type BillSearchMode
} from "../api/canonical-search.js"

/** The canonical HTTP search envelope, retained without MCP legacy reshaping. */
export interface SearchPage<T> {
  data: T[]
  links: { next: string | null; self: string }
  meta: {
    correlationId: string
    isReranked: boolean
    limit: number
    mode: BillSearchMode
    models: Array<{ model: string; purpose: "embedding" | "reranking" }>
    nextCursor: string | null
    truncated: boolean
    warnings: string[]
  }
}

export type BillSearchPage = SearchPage<BillSearchHit>

export type DirectBillSearchPage = Readonly<{
  items: readonly BillSearchCandidateRead[]
  nextCursor?: string
  search: BillSearchExecution
  truncated: boolean
  warnings?: readonly string[]
}>

export type BillSearchNormalizationContext = Readonly<{
  apiBaseUrl: string
  correlationId: string
  limit: number
  mode: BillSearchMode
  /** The decoded incoming search cursor, used to preserve absolute ranks. */
  rankOffset: number
}>

const nonEmptyString = z.string().min(1)
const timestamp = z.string().datetime({ offset: true })
const sourceReferenceSchema = z
  .object({
    isOfficial: z.boolean(),
    provider: nonEmptyString,
    retrievedAt: timestamp,
    sourceUpdatedAt: timestamp.nullable(),
    sourceUrl: z.url()
  })
  .strict()
const billSummarySchema = z
  .object({
    canonicalUrl: z.url(),
    classification: z.array(nonEmptyString),
    id: nonEmptyString,
    identifier: nonEmptyString,
    introducedDate: z.string().date().nullable(),
    jurisdictionId: nonEmptyString,
    latestActionAt: timestamp.nullable(),
    sessionId: nonEmptyString,
    sources: z.tuple([sourceReferenceSchema]).rest(sourceReferenceSchema),
    status: z.string().nullable(),
    subjects: z.array(nonEmptyString),
    title: nonEmptyString,
    type: z.literal("bill"),
    updatedAt: timestamp
  })
  .strict()
const billSearchHitSchema = z
  .object({
    match: z
      .object({
        explanation: z.null(),
        lexicalScore: z.number().finite().nullable(),
        matchedFields: z
          .array(z.enum(["abstract", "identifier", "semantic", "sponsorNames", "subjects", "title", "versionText"]))
          .min(1),
        mode: z.enum(["hybrid", "lexical", "semantic"]),
        rerankScore: z.number().finite().nullable(),
        semanticScore: z.number().finite().nullable(),
        snippet: z.string().nullable()
      })
      .strict(),
    rank: z.number().int().positive(),
    record: billSummarySchema,
    recordId: nonEmptyString,
    recordType: z.literal("bill"),
    score: z.number().finite(),
    sources: z.tuple([sourceReferenceSchema]).rest(sourceReferenceSchema)
  })
  .strict()
const billSearchPageSchema = z
  .object({
    data: z.array(billSearchHitSchema),
    links: z.object({ next: z.string().min(1).nullable(), self: z.string().min(1) }).strict(),
    meta: z
      .object({
        correlationId: nonEmptyString,
        isReranked: z.boolean(),
        limit: z.number().int().positive(),
        mode: z.enum(["hybrid", "lexical", "semantic"]),
        models: z.array(z.object({ model: nonEmptyString, purpose: z.enum(["embedding", "reranking"]) }).strict()),
        nextCursor: z.string().min(1).nullable(),
        truncated: z.boolean(),
        warnings: z.array(z.string())
      })
      .strict()
  })
  .strict()

/**
 * Applies the one forward projection needed for an in-process bill search to
 * become the documented HTTP representation. It does not fill in missing
 * canonical fields: the projection rejects incomplete candidates.
 */
export function normalizeDirectBillSearchPage(
  page: DirectBillSearchPage,
  context: BillSearchNormalizationContext
): BillSearchPage {
  if (!Number.isSafeInteger(context.rankOffset) || context.rankOffset < 0) {
    throw new RangeError("rankOffset must be a non-negative safe integer")
  }
  const data = page.items.map((candidate, index) =>
    projectBillSearchHit(candidate, context.mode, context.rankOffset + index + 1, context.apiBaseUrl)
  )
  const nextCursor = page.nextCursor ?? null
  return parseBillSearchPage({
    data,
    links: {
      next: nextCursor === null ? null : `/api/search/bills?cursor=${encodeURIComponent(nextCursor)}`,
      self: "/api/search/bills"
    },
    meta: {
      correlationId: context.correlationId,
      isReranked: page.search.isReranked,
      limit: context.limit,
      mode: context.mode,
      models: page.search.models.map((model) => ({ model: model.model, purpose: model.purpose })),
      nextCursor,
      truncated: page.truncated,
      warnings: [...(page.warnings ?? [])]
    }
  })
}

/**
 * Accepts only the exact canonical HTTP output. This intentionally performs
 * no reverse mapping to the legacy MCP page shape, so a missing canonical
 * field blocks a future cutover instead of being concealed.
 */
export function normalizeHttpBillSearchPage(page: unknown): BillSearchPage {
  return parseBillSearchPage(page)
}

function parseBillSearchPage(value: unknown): BillSearchPage {
  return billSearchPageSchema.parse(value)
}
