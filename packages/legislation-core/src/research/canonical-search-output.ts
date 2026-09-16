import { z } from "zod"

type BillSearchMode = "hybrid" | "lexical" | "semantic"

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

export type BillSearchPage = z.infer<typeof billSearchPageSchema>

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
