import { z } from "zod"
import { resourceSchema } from "./envelopes"
import { legalProvisionContextSchema, legalProvisionVersionSchema } from "./legal-browse-contract"

export const legalVersionRequestSchema = z
  .strictObject({
    editionId: z.uuid().optional(),
    sourceObservationId: z.uuid().optional()
  })
  .superRefine((value, context) => {
    if (value.editionId !== undefined && value.sourceObservationId !== undefined) {
      context.addIssue({ code: "custom", message: "Choose editionId or sourceObservationId" })
    }
  })
export type LegalVersionRequest = z.input<typeof legalVersionRequestSchema>

export const legalPublicationVersionIdentitySchema = z.strictObject({
  id: z.uuid(),
  documentId: z.uuid(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  inputContract: z.string().min(1).max(256),
  heading: z.string().min(1).max(16_384),
  publicationKind: z.enum(["proposed_rule", "final_rule", "notice", "other"])
})
export const legalPublicationVersionContextSchema = z.strictObject({
  sourceObservationId: z.uuid(),
  documentId: z.uuid(),
  versionId: z.uuid(),
  sourceId: z.literal("federal-register"),
  jurisdictionId: z.literal("jurisdiction:us"),
  rightsProfileId: z.string().min(1),
  publishedOn: z.iso.date(),
  sourceLocator: z.string().min(1).max(4096),
  sourceUrl: z.url(),
  updatedAt: z.iso.datetime(),
  textUrl: z.string().startsWith("/api/legal/versions/")
})
export const legalVersionDetailSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("provision"),
    version: legalProvisionVersionSchema,
    selectedContext: legalProvisionContextSchema.nullable()
  }),
  z.strictObject({
    kind: z.literal("publication"),
    version: legalPublicationVersionIdentitySchema,
    selectedContext: legalPublicationVersionContextSchema.nullable()
  })
])
export const legalVersionResponseSchema = resourceSchema.extend({ data: legalVersionDetailSchema })

export function validateLegalVersionResponse(value: unknown, versionId: string, request: LegalVersionRequest) {
  const id = z.uuid().parse(versionId)
  const input = legalVersionRequestSchema.parse(request)
  const response = legalVersionResponseSchema.parse(value)
  if (response.data.version.id !== id) {
    throw new Error("legal_version_response_mismatch")
  }
  if (response.data.kind === "provision") {
    const context = response.data.selectedContext
    if (
      input.sourceObservationId !== undefined ||
      (input.editionId === undefined && context !== null) ||
      (input.editionId !== undefined &&
        (context === null ||
          context.edition.id !== input.editionId ||
          context.textUrl !== `/api/legal/versions/${id}/text?editionId=${input.editionId}`))
    ) {
      throw new Error("legal_version_response_mismatch")
    }
  } else {
    const context = response.data.selectedContext
    if (
      input.editionId !== undefined ||
      (input.sourceObservationId === undefined && context !== null) ||
      (input.sourceObservationId !== undefined &&
        (context === null || context.sourceObservationId !== input.sourceObservationId || context.versionId !== id))
    ) {
      throw new Error("legal_version_response_mismatch")
    }
  }
  return response
}
