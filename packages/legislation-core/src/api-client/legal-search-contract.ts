import { z } from "zod"
import { legalAgencyReferenceSchema, legalEditionContextSchema } from "../legal-text/reader-contract.js"
import { searchPageSchema } from "./envelopes.js"

const id = z.string().trim().min(1).max(256)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const mode = z.enum(["lexical", "semantic", "hybrid"])
const corpus = z.enum(["regulation", "regulatory_publication", "statute"])
const publicationKind = z.enum(["proposed_rule", "final_rule", "notice", "other"])
const ids = z
  .array(id)
  .min(1)
  .max(100)
  .refine((values) => new Set(values).size === values.length, "Duplicate IDs")

/** Shared transport contract; supported datasets and caller rights are service decisions. */
export const legalSearchRequestSchema = z
  .strictObject({
    query: z.string().trim().min(1).max(500),
    mode: mode.default("lexical"),
    jurisdictionIds: ids.optional(),
    codeIds: ids.optional(),
    agencyIds: ids.optional(),
    corpora: z
      .array(corpus)
      .min(1)
      .max(3)
      .refine((values) => new Set(values).size === values.length, "Duplicate corpora")
      .default(["regulation", "regulatory_publication"]),
    publicationKinds: z
      .array(publicationKind)
      .min(1)
      .max(4)
      .refine((values) => new Set(values).size === values.length, "Duplicate publication kinds")
      .optional(),
    publishedFrom: z.iso.date().optional(),
    publishedTo: z.iso.date().optional(),
    editionIds: ids.optional(),
    asOf: z.iso.date().optional(),
    allowDegraded: z.boolean().default(false),
    cursor: z.string().min(1).max(8192).optional(),
    limit: z.number().int().positive().max(100).optional()
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message })
    if (value.asOf !== undefined && value.editionIds !== undefined) {
      issue("asOf", "Choose asOf or editionIds")
    }
    if (
      (value.asOf !== undefined || value.editionIds !== undefined || value.codeIds !== undefined) &&
      value.corpora.includes("regulatory_publication")
    ) {
      issue("corpora", "Code and historical selection require code-only corpora")
    }
    if (
      (value.publicationKinds !== undefined || value.publishedFrom !== undefined || value.publishedTo !== undefined) &&
      (value.corpora.length !== 1 || value.corpora[0] !== "regulatory_publication")
    ) {
      issue("corpora", "Publication filters require publication-only corpora")
    }
    if (
      value.publishedFrom !== undefined &&
      value.publishedTo !== undefined &&
      value.publishedFrom > value.publishedTo
    ) {
      issue("publishedTo", "Publication date range is reversed")
    }
    if (value.mode !== "lexical" && value.limit !== undefined && value.limit > 25) {
      issue("limit", "Semantic and hybrid limits cannot exceed 25")
    }
  })
  .transform((value) => ({ ...value, limit: value.limit ?? (value.mode === "lexical" ? 20 : 10) }))

const reference = z.strictObject({ id, name: z.string().min(1) })
const source = z.strictObject({
  provider: id,
  sourceUrl: z.url(),
  sourceUpdatedAt: z.iso.datetime().nullable(),
  retrievedAt: z.iso.datetime(),
  isOfficial: z.boolean(),
  publisher: z.string().min(1),
  supplier: z.string().min(1),
  attribution: z.string().min(1).nullable()
})
const hitFields = {
  id,
  canonicalUrl: z.url(),
  sources: z.array(source).min(1),
  updatedAt: z.iso.datetime(),
  versionId: id,
  passageId: id,
  title: z.string().min(1),
  heading: z.string().nullable(),
  citation: z.string().min(1),
  jurisdiction: reference,
  agencies: z.array(legalAgencyReferenceSchema),
  snippet: z.string().max(500),
  matchMode: mode,
  sourceLocator: z.string().min(1),
  versionHash: hash,
  coverageWarnings: z.array(z.string())
}
const hit = z
  .discriminatedUnion("kind", [
    z.strictObject({
      ...hitFields,
      kind: z.literal("provision"),
      corpus: z.enum(["regulation", "statute"]),
      code: reference,
      selectedContext: legalEditionContextSchema
    }),
    z.strictObject({
      ...hitFields,
      kind: z.literal("publication"),
      corpus: z.literal("regulatory_publication"),
      publicationKind,
      publishedOn: z.iso.date(),
      effectiveOn: z.iso.date().nullable(),
      sourceObservationId: id
    })
  ])
  .superRefine((value, ctx) => {
    if (
      value.kind === "provision" &&
      (value.id !== value.selectedContext.provisionId ||
        value.versionId !== value.selectedContext.versionId ||
        value.sourceLocator !== value.selectedContext.sourceLocator)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["selectedContext"],
        message: "Selected context must identify the exact hit owner, version and locator"
      })
    }
  })

export const legalSearchPageSchema = searchPageSchema
  .extend({
    data: z.array(hit),
    meta: searchPageSchema.shape.meta.extend({
      models: z.array(
        z.strictObject({
          provider: z.enum(["openai", "voyageai", "cohere"]),
          model: z.string().min(1),
          purpose: z.enum(["embedding", "reranking", "generation"]),
          dimensions: z.number().int().positive().nullable()
        })
      ),
      legal: z.strictObject({
        lexicalGeneration: hash,
        embeddingGeneration: hash.nullable(),
        effectiveMode: mode,
        degraded: z.boolean(),
        candidateSetTruncated: z.boolean()
      })
    })
  })
  .superRefine((value, ctx) => {
    const { meta, data } = value
    const effective = meta.legal.effectiveMode
    const issue = (message: string) => ctx.addIssue({ code: "custom", message })
    if (data.length > meta.limit || meta.limit > (effective === "lexical" && meta.mode === "lexical" ? 100 : 25)) {
      issue("Response exceeds the requested mode's limit")
    }
    if ((meta.nextCursor === null) !== (value.links.next === null)) {
      issue("Next cursor and link must agree")
    }
    if (meta.legal.degraded !== (meta.mode !== effective)) {
      issue("Degradation must reflect a mode change")
    }
    if (meta.legal.degraded && (meta.mode === "lexical" || effective !== "lexical")) {
      issue("Only explicit lexical fallback is supported")
    }
    if ((effective === "lexical") !== (meta.legal.embeddingGeneration === null)) {
      issue("Embedding generation must match effective mode")
    }
    if (data.some((item) => item.matchMode !== effective)) {
      issue("Hit match mode must match effective mode")
    }
    if (meta.models.some((model) => model.purpose === "generation")) {
      issue("Search does not generate answers")
    }
    if (meta.isReranked !== meta.models.some((model) => model.purpose === "reranking")) {
      issue("Reranking metadata must agree")
    }
    if ((effective !== "lexical") !== meta.models.some((model) => model.purpose === "embedding")) {
      issue("Embedding model metadata must match effective mode")
    }
    if (new Set(data.map((item) => item.passageId)).size !== data.length) {
      issue("Duplicate search passages")
    }
    if (new Set(data.map((item) => JSON.stringify([item.kind, item.id, item.versionId]))).size !== data.length) {
      issue("Duplicate exact search versions")
    }
    if (meta.truncated !== (meta.nextCursor !== null || meta.legal.candidateSetTruncated)) {
      issue("Truncation must reflect continuation or a capped candidate window")
    }
    if (meta.nextCursor !== null && data.length !== meta.limit) {
      issue("Continuation requires a full result page")
    }
  })

export type LegalSearchRequest = z.input<typeof legalSearchRequestSchema>

/** Validate the response against the normalized request, in addition to its standalone wire shape. */
export function validateLegalSearchResponse(value: unknown, request: LegalSearchRequest) {
  const input = legalSearchRequestSchema.parse(request)
  const page = legalSearchPageSchema.parse(value)
  const agencyIds = input.agencyIds
  if (
    page.meta.limit !== input.limit ||
    page.meta.mode !== input.mode ||
    (page.meta.legal.degraded && !input.allowDegraded) ||
    (input.cursor !== undefined && page.meta.nextCursor === input.cursor) ||
    page.data.some((row) => {
      if (
        !input.corpora.includes(row.corpus) ||
        (input.jurisdictionIds !== undefined && !input.jurisdictionIds.includes(row.jurisdiction.id)) ||
        (agencyIds !== undefined && !row.agencies.some((agency) => agencyIds.includes(agency.sourceAgencyId)))
      ) {
        return true
      }
      if (row.kind === "provision") {
        return (
          (input.codeIds !== undefined && !input.codeIds.includes(row.code.id)) ||
          (input.editionIds !== undefined && !input.editionIds.includes(row.selectedContext.editionId)) ||
          (input.asOf !== undefined &&
            (row.selectedContext.selectedDate !== input.asOf ||
              row.selectedContext.basis !== "publisher_point_in_time"))
        )
      }
      return (
        (input.publicationKinds !== undefined && !input.publicationKinds.includes(row.publicationKind)) ||
        (input.publishedFrom !== undefined && row.publishedOn < input.publishedFrom) ||
        (input.publishedTo !== undefined && row.publishedOn > input.publishedTo)
      )
    })
  ) {
    throw new Error("legal_search_response_mismatch")
  }
  return page
}
