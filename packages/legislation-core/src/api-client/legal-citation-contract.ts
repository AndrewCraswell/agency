import { z } from "zod"
import { resourceSchema } from "./envelopes"

const jurisdictionId = z
  .string()
  .regex(/^jurisdiction:[a-z0-9-]+$/)
  .max(128)

export const legalCitationRequestSchema = z
  .strictObject({
    citation: z.string().trim().min(1).max(4096),
    jurisdictionId,
    codeId: z.uuid().optional(),
    editionId: z.uuid().optional(),
    asOf: z.iso.date().optional()
  })
  .superRefine((value, context) => {
    if (value.editionId !== undefined && value.asOf !== undefined) {
      context.addIssue({ code: "custom", message: "Choose editionId or asOf" })
    }
  })

export type LegalCitationRequest = z.input<typeof legalCitationRequestSchema>

export const legalCitationCandidateSchema = z.strictObject({
  provisionId: z.uuid(),
  versionId: z.uuid(),
  codeId: z.uuid(),
  editionId: z.uuid(),
  jurisdictionId,
  codeKey: z.string().min(1).max(256),
  codeName: z.string().min(1).max(4096),
  citation: z.string().min(1).max(4096),
  identityKey: z.string().min(1).max(4096),
  nodeKind: z.string().min(1).max(64),
  heading: z.string().max(16384),
  sourceLocator: z.string().min(1).max(4096),
  textUrl: z.string().startsWith("/api/legal/versions/")
})

const base = {
  input: z.string().min(1).max(4096),
  normalizedInput: z.string().min(1).max(4096)
} as const

export const legalCitationResolutionSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...base,
    status: z.literal("resolved"),
    match: legalCitationCandidateSchema,
    candidates: z.tuple([]),
    truncated: z.literal(false),
    refinement: z.null()
  }),
  z.strictObject({
    ...base,
    status: z.literal("ambiguous"),
    match: z.null(),
    candidates: z.array(legalCitationCandidateSchema).min(1).max(25),
    truncated: z.boolean(),
    refinement: z.enum(["code_or_edition_required", "more_specific_citation_required"])
  }),
  z.strictObject({
    ...base,
    status: z.literal("not_found"),
    match: z.null(),
    candidates: z.tuple([]),
    truncated: z.literal(false),
    refinement: z.null()
  })
])

export const legalCitationResponseSchema = resourceSchema.extend({ data: legalCitationResolutionSchema })

export function validateLegalCitationResponse(value: unknown, request: LegalCitationRequest) {
  const input = legalCitationRequestSchema.parse(request)
  const response = legalCitationResponseSchema.parse(value)
  const result = response.data
  const returned = result.status === "resolved" ? [result.match] : result.candidates
  if (
    result.input !== input.citation ||
    returned.some(
      (candidate) =>
        candidate.jurisdictionId !== input.jurisdictionId ||
        (input.codeId !== undefined && candidate.codeId !== input.codeId) ||
        (input.editionId !== undefined && candidate.editionId !== input.editionId) ||
        candidate.textUrl !== `/api/legal/versions/${candidate.versionId}/text?editionId=${candidate.editionId}`
    )
  ) {
    throw new Error("legal_citation_response_mismatch")
  }
  return response
}
