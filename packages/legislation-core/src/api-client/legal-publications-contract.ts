import { z } from "zod"
import { legalAgencyReferenceSchema } from "../legal-text/reader-contract"
import { pageSchema, resourceSchema } from "./envelopes"

const id = z.string().trim().min(1).max(256)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const publicationKind = z.enum(["proposed_rule", "final_rule", "notice", "other"])
const cursor = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(2048)
  .optional()

export const legalPublicationsRequestSchema = z
  .strictObject({
    jurisdictionId: z
      .string()
      .regex(/^jurisdiction:[a-z0-9:-]+$/)
      .max(256)
      .optional(),
    sourceId: z.literal("federal-register").optional(),
    sourceAgencyId: id.optional(),
    agencyId: id.optional(),
    kind: publicationKind.optional(),
    publishedFrom: z.iso.date().optional(),
    publishedTo: z.iso.date().optional(),
    updatedSince: z.iso.datetime().optional(),
    cursor,
    limit: z.int().min(1).max(100).default(20)
  })
  .superRefine((value, context) => {
    if (value.sourceAgencyId !== undefined && value.sourceId === undefined) {
      context.addIssue({ code: "custom", message: "sourceAgencyId requires sourceId", path: ["sourceAgencyId"] })
    }
    if (value.sourceAgencyId !== undefined && value.agencyId !== undefined) {
      context.addIssue({ code: "custom", message: "Select sourceAgencyId or agencyId", path: ["agencyId"] })
    }
    if (value.publishedFrom && value.publishedTo && value.publishedFrom > value.publishedTo) {
      context.addIssue({ code: "custom", message: "Invalid publication date range", path: ["publishedTo"] })
    }
  })
export type LegalPublicationsRequest = z.input<typeof legalPublicationsRequestSchema>

export const legalPublicationSummarySchema = z.strictObject({
  id: z.uuid(),
  versionId: z.uuid(),
  sourceObservationId: z.uuid(),
  jurisdictionId: z.literal("jurisdiction:us"),
  sourceId: z.literal("federal-register"),
  nativeNumber: id,
  title: z.string().min(1),
  citation: z.string().min(1),
  publicationKind,
  publishedOn: z.iso.date(),
  effectiveOn: z.iso.date().nullable(),
  agencies: z.array(legalAgencyReferenceSchema).max(100),
  canonicalUrl: z.string().startsWith("/api/legal/publications/"),
  textUrl: z.string().startsWith("/api/legal/versions/"),
  updatedAt: z.iso.datetime()
})

export const legalPublicationsResponseSchema = pageSchema.extend({
  data: z.array(legalPublicationSummarySchema).max(100)
})

export const legalPublicationDetailSchema = legalPublicationSummarySchema.extend({
  sourceLocator: z.string().min(1),
  sourceUrl: z.url(),
  contentHash: hash,
  attribution: z.string().nullable()
})
export const legalPublicationResponseSchema = resourceSchema.extend({ data: legalPublicationDetailSchema })

export const legalPublicationVersionsRequestSchema = z.strictObject({
  cursor,
  limit: z.int().min(1).max(100).default(20)
})
export type LegalPublicationVersionsRequest = z.input<typeof legalPublicationVersionsRequestSchema>
export const legalPublicationVersionSchema = legalPublicationDetailSchema.omit({ canonicalUrl: true }).extend({
  canonicalUrl: z.string().startsWith("/api/legal/publications/")
})
export const legalPublicationVersionsResponseSchema = pageSchema.extend({
  data: z.array(legalPublicationVersionSchema).max(100)
})

function validateSummary(row: z.infer<typeof legalPublicationSummarySchema>) {
  return (
    row.canonicalUrl === `/api/legal/publications/${row.id}` &&
    row.textUrl ===
      `/api/legal/versions/${row.versionId}/text?sourceObservationId=${encodeURIComponent(row.sourceObservationId)}`
  )
}

export function validateLegalPublicationsResponse(value: unknown, request: LegalPublicationsRequest) {
  const input = legalPublicationsRequestSchema.parse(request)
  const response = legalPublicationsResponseSchema.parse(value)
  if (
    response.meta.limit !== input.limit ||
    response.data.length > input.limit ||
    response.meta.truncated !== (response.meta.nextCursor !== null) ||
    (response.links.next === null) !== (response.meta.nextCursor === null) ||
    new Set(response.data.map((row) => row.sourceObservationId)).size !== response.data.length ||
    response.data.some(
      (row) =>
        !validateSummary(row) ||
        (input.jurisdictionId !== undefined && row.jurisdictionId !== input.jurisdictionId) ||
        (input.sourceId !== undefined && row.sourceId !== input.sourceId) ||
        (input.kind !== undefined && row.publicationKind !== input.kind) ||
        (input.publishedFrom !== undefined && row.publishedOn < input.publishedFrom) ||
        (input.publishedTo !== undefined && row.publishedOn > input.publishedTo) ||
        (input.sourceAgencyId !== undefined &&
          !row.agencies.some((agency) => agency.sourceAgencyId === input.sourceAgencyId)) ||
        (input.agencyId !== undefined && !row.agencies.some((agency) => agency.organizationId === input.agencyId)) ||
        (input.updatedSince !== undefined && Date.parse(row.updatedAt) < Date.parse(input.updatedSince))
    )
  ) {
    throw new Error("legal_publications_response_mismatch")
  }
  return response
}

export function validateLegalPublicationResponse(value: unknown, documentId: string, versionId?: string) {
  const id = z.uuid().parse(documentId)
  const version = versionId === undefined ? undefined : z.uuid().parse(versionId)
  const response = legalPublicationResponseSchema.parse(value)
  if (
    response.data.id !== id ||
    (version !== undefined && response.data.versionId !== version) ||
    !validateSummary(response.data)
  ) {
    throw new Error("legal_publication_response_mismatch")
  }
  return response
}

export function validateLegalPublicationVersionsResponse(
  value: unknown,
  documentId: string,
  request: LegalPublicationVersionsRequest
) {
  const id = z.uuid().parse(documentId)
  const input = legalPublicationVersionsRequestSchema.parse(request)
  const response = legalPublicationVersionsResponseSchema.parse(value)
  if (
    response.meta.limit !== input.limit ||
    response.data.length > input.limit ||
    response.meta.truncated !== (response.meta.nextCursor !== null) ||
    (response.links.next === null) !== (response.meta.nextCursor === null) ||
    new Set(response.data.map((row) => row.sourceObservationId)).size !== response.data.length ||
    response.data.some((row) => row.id !== id || !validateSummary(row))
  ) {
    throw new Error("legal_publication_versions_response_mismatch")
  }
  return response
}
