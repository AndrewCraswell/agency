import { z } from "zod"
import { legalCapabilitySchema } from "../legal-text/reader-contract"
import { pageSchema } from "./envelopes"

const cursorSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(2048)
  .optional()

export const legalCoverageRequestSchema = z.strictObject({
  jurisdictionId: z
    .string()
    .regex(/^jurisdiction:[a-z0-9:-]+$/)
    .max(256)
    .optional(),
  codeId: z.uuid().optional(),
  corpus: z.enum(["regulation", "statute"]).optional(),
  sourceId: z.enum(["ecfr", "govinfo-cfr"]).optional(),
  cursor: cursorSchema,
  limit: z.int().min(1).max(100).default(20)
})
export type LegalCoverageRequest = z.input<typeof legalCoverageRequestSchema>

const stageSchema = legalCapabilitySchema.extend({
  availableEditions: z.int().min(0).max(1),
  requestedEditions: z.literal(1),
  excludedEditions: z.int().min(0).max(1)
})

const sourceStageSchema = stageSchema.extend({
  lastAttemptAt: z.iso.datetime().nullable(),
  lastSuccessAt: z.iso.datetime().nullable()
})

const canonicalStageSchema = stageSchema.extend({ recordCount: z.int().nonnegative() })

const lexicalStageSchema = stageSchema.extend({
  passageCount: z.int().nonnegative(),
  verifiedAt: z.iso.datetime().nullable()
})

const semanticStageSchema = stageSchema.extend({
  dimensions: z.int().positive().nullable(),
  model: z.string().min(1).nullable(),
  passageCount: z.int().nonnegative(),
  readyAt: z.iso.datetime().nullable()
})

export const regulatoryCoverageSchema = z.strictObject({
  id: z.uuid(),
  jurisdictionId: z.string().min(1).max(256),
  code: z.strictObject({ id: z.uuid(), name: z.string().min(1).max(2048) }),
  corpus: z.enum(["regulation", "statute"]),
  source: z.strictObject({
    id: z.enum(["ecfr", "govinfo-cfr"]),
    publisher: z.string().min(1).max(2048),
    authority: z.enum(["official", "licensed"])
  }),
  edition: z.strictObject({
    id: z.uuid(),
    issueDate: z.iso.date().nullable(),
    sourceCurrencyDate: z.iso.date().nullable(),
    publishedAt: z.iso.datetime(),
    isCurrent: z.boolean()
  }),
  stages: z.strictObject({
    sourceCollection: sourceStageSchema,
    canonical: canonicalStageSchema,
    lexical: lexicalStageSchema,
    semantic: semanticStageSchema
  })
})

export const legalCoverageResponseSchema = pageSchema.extend({
  data: z.array(regulatoryCoverageSchema).max(100)
})

export function validateLegalCoverageResponse(value: unknown, request: LegalCoverageRequest) {
  const input = legalCoverageRequestSchema.parse(request)
  const response = legalCoverageResponseSchema.parse(value)
  if (
    response.meta.limit !== input.limit ||
    response.data.length > input.limit ||
    response.meta.truncated !== (response.meta.nextCursor !== null) ||
    (response.links.next === null) !== (response.meta.nextCursor === null) ||
    new Set(response.data.map((row) => row.id)).size !== response.data.length ||
    response.data.some(
      (row) =>
        row.edition.id !== row.id ||
        (input.jurisdictionId !== undefined && row.jurisdictionId !== input.jurisdictionId) ||
        (input.codeId !== undefined && row.code.id !== input.codeId) ||
        (input.corpus !== undefined && row.corpus !== input.corpus) ||
        (input.sourceId !== undefined && row.source.id !== input.sourceId) ||
        Object.values(row.stages).some(
          (stage) =>
            stage.requestedEditions !== stage.availableEditions + stage.excludedEditions ||
            (stage.status === "available" && stage.availableEditions !== 1) ||
            (stage.status !== "available" && stage.excludedEditions !== 1)
        )
    )
  ) {
    throw new Error("legal_coverage_response_mismatch")
  }
  return response
}
