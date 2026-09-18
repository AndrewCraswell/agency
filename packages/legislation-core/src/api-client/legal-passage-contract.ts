import { z } from "zod"
import { pageSchema, resourceSchema } from "./envelopes"
import { legalSelectedTextContextSchema } from "./legal-text-contract"

const id = z.uuid()
const hash = z.string().regex(/^[a-f0-9]{64}$/)

const selection = {
  editionId: id.optional(),
  sourceObservationId: id.optional()
}

function requireExactContext(
  value: { editionId?: string | undefined; sourceObservationId?: string | undefined },
  context: z.RefinementCtx
) {
  if ((value.editionId === undefined) === (value.sourceObservationId === undefined)) {
    context.addIssue({ code: "custom", message: "Select exactly one editionId or sourceObservationId" })
  }
}

export const legalPassagesRequestSchema = z
  .strictObject({
    ...selection,
    cursor: z.string().min(1).max(2048).optional(),
    limit: z.int().min(1).max(100).default(20)
  })
  .superRefine(requireExactContext)
export type LegalPassagesRequest = z.input<typeof legalPassagesRequestSchema>

export const legalPassageRequestSchema = z.strictObject(selection).superRefine(requireExactContext)
export type LegalPassageRequest = z.input<typeof legalPassageRequestSchema>

const span = z.strictObject({ blockId: hash, start: z.int().nonnegative(), end: z.int().nonnegative() })
export const legalPassageSchema = z.strictObject({
  id: hash,
  generationId: hash,
  versionId: id,
  ordinal: z.int().nonnegative(),
  start: z.int().nonnegative(),
  end: z.int().nonnegative(),
  text: z.string().max(100_000),
  tokenCount: z.int().nonnegative(),
  readerSpans: z.array(span).max(1_000),
  contextSpans: z.array(span).max(1_000),
  inputHash: hash,
  rowContinuation: z
    .strictObject({ start: z.int().nonnegative(), end: z.int().nonnegative(), longColumn: z.int().nonnegative() })
    .nullable(),
  selectedContext: legalSelectedTextContextSchema,
  textUrl: z.string().startsWith("/api/legal/versions/")
})

export const legalPassagesResponseSchema = pageSchema.extend({ data: z.array(legalPassageSchema).max(100) })
export const legalPassageResponseSchema = resourceSchema.extend({ data: legalPassageSchema })

function matchesSelection(
  passage: z.infer<typeof legalPassageSchema>,
  versionId: string,
  input: { editionId?: string | undefined; sourceObservationId?: string | undefined }
) {
  return (
    passage.versionId === versionId &&
    (passage.selectedContext.kind === "provision"
      ? passage.selectedContext.editionId === input.editionId && input.sourceObservationId === undefined
      : passage.selectedContext.sourceObservationId === input.sourceObservationId && input.editionId === undefined)
  )
}

export function validateLegalPassagesResponse(value: unknown, versionId: string, request: LegalPassagesRequest) {
  const idValue = id.parse(versionId)
  const input = legalPassagesRequestSchema.parse(request)
  const response = legalPassagesResponseSchema.parse(value)
  if (
    response.data.length > input.limit ||
    response.data.some((passage) => !matchesSelection(passage, idValue, input)) ||
    response.data.some((passage, index) => index > 0 && passage.ordinal <= response.data[index - 1]!.ordinal) ||
    response.meta.truncated !== (response.meta.nextCursor !== null) ||
    (response.links.next === null) !== (response.meta.nextCursor === null)
  ) {
    throw new Error("legal_passages_response_mismatch")
  }
  return response
}

export function validateLegalPassageResponse(value: unknown, passageId: string, request: LegalPassageRequest) {
  const passage = hash.parse(passageId)
  const input = legalPassageRequestSchema.parse(request)
  const response = legalPassageResponseSchema.parse(value)
  if (response.data.id !== passage || !matchesSelection(response.data, response.data.versionId, input)) {
    throw new Error("legal_passage_response_mismatch")
  }
  return response
}
