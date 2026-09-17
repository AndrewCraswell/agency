import { z } from "zod"
import { pageSchema, resourceSchema } from "./envelopes"

const cursor = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .max(2048)
  .optional()
const limit = z.int().min(1).max(100).default(20)
export const legalEditionsRequestSchema = z
  .strictObject({
    sourceId: z.enum(["ecfr", "govinfo-cfr"]).optional(),
    issuedFrom: z.iso.date().optional(),
    issuedTo: z.iso.date().optional(),
    cursor,
    limit
  })
  .superRefine((value, ctx) => {
    if (value.issuedFrom !== undefined && value.issuedTo !== undefined && value.issuedFrom > value.issuedTo) {
      ctx.addIssue({ code: "custom", message: "Issue date range is reversed" })
    }
  })
export type LegalEditionsRequest = z.input<typeof legalEditionsRequestSchema>
export const legalEditionSchema = z.strictObject({
  id: z.uuid(),
  codeId: z.uuid(),
  sourceId: z.enum(["ecfr", "govinfo-cfr"]),
  jurisdictionId: z.literal("jurisdiction:us"),
  rightsProfileId: z.string().min(1),
  sourceObservationId: z.string().regex(/^[a-f0-9]{64}$/),
  nativeKey: z.string().min(1).max(1024),
  sourceRevision: z.string().min(1).max(2048),
  sourceUrl: z.url(),
  issueDate: z.iso.date().nullable(),
  sourceCurrencyDate: z.iso.date().nullable(),
  publishedAt: z.iso.datetime(),
  scope: z.enum(["current_code_snapshot", "annual_volume"])
})
export const legalEditionsResponseSchema = pageSchema.extend({ data: z.array(legalEditionSchema).max(100) })
export const legalEditionDetailSchema = legalEditionSchema.extend({
  publishedMembers: z.int().positive(),
  isCurrent: z.boolean(),
  annualVolume: z
    .strictObject({
      annualEditionId: z.string().regex(/^[a-f0-9]{64}$/),
      codeId: z.uuid(),
      packageYear: z.int().min(1996).max(9999),
      revisionDate: z.iso.date(),
      volume: z.int().positive(),
      expectedVolumes: z.int().min(1).max(200),
      coverage: z.json()
    })
    .nullable()
})
export const legalEditionResponseSchema = resourceSchema.extend({ data: legalEditionDetailSchema })

export function validateLegalEditionResponse(value: unknown, editionId: string) {
  const id = z.uuid().parse(editionId)
  const response = legalEditionResponseSchema.parse(value)
  if (
    response.data.id !== id ||
    (response.data.isCurrent && response.data.sourceId !== "ecfr") ||
    (response.data.annualVolume === null) !== (response.data.sourceId === "ecfr") ||
    (response.data.annualVolume !== null &&
      (response.data.annualVolume.codeId !== response.data.codeId ||
        response.data.annualVolume.volume > response.data.annualVolume.expectedVolumes))
  ) {
    throw new Error("legal_edition_response_mismatch")
  }
  return response
}

export const legalProvisionsRequestSchema = z
  .strictObject({
    editionId: z.uuid().optional(),
    asOf: z.iso.date().optional(),
    traversal: z.enum(["children", "all"]).default("children"),
    parentId: z.uuid().optional(),
    nodeKind: z
      .string()
      .regex(/^[a-z][a-z0-9_-]*$/)
      .max(64)
      .optional(),
    cursor,
    limit
  })
  .superRefine((value, ctx) => {
    if (value.editionId !== undefined && value.asOf !== undefined) {
      ctx.addIssue({ code: "custom", message: "Choose editionId or asOf" })
    }
    if (value.traversal === "all" && value.parentId !== undefined) {
      ctx.addIssue({ code: "custom", message: "All-node enumeration cannot specify a parent" })
    }
  })
export type LegalProvisionsRequest = z.input<typeof legalProvisionsRequestSchema>
export const legalProvisionSummarySchema = z.strictObject({
  id: z.uuid(),
  codeId: z.uuid(),
  editionId: z.uuid(),
  versionId: z.uuid(),
  parentId: z.uuid().nullable(),
  ordinal: z.int().nonnegative(),
  nativeId: z.string().min(1).max(4096),
  nodeKind: z.string().min(1).max(64),
  heading: z.string().max(16384),
  sourceLocator: z.string().min(1).max(4096),
  hasChildren: z.boolean(),
  textUrl: z.string().startsWith("/api/legal/versions/")
})
export const legalProvisionsResponseSchema = pageSchema.extend({
  data: z.array(legalProvisionSummarySchema).max(100),
  meta: pageSchema.shape.meta.extend({ selectedEdition: legalEditionSchema })
})

function validPage(page: z.infer<typeof pageSchema>, count: number, requestedLimit: number) {
  return (
    page.meta.limit === requestedLimit &&
    count <= requestedLimit &&
    page.meta.truncated === (page.meta.nextCursor !== null) &&
    (page.links.next === null) === (page.meta.nextCursor === null)
  )
}
export function validateLegalEditionsResponse(value: unknown, codeId: string, query: LegalEditionsRequest) {
  const input = legalEditionsRequestSchema.parse(query)
  const page = legalEditionsResponseSchema.parse(value)
  if (
    !validPage(page, page.data.length, input.limit) ||
    new Set(page.data.map((row) => row.id)).size !== page.data.length ||
    page.data.some(
      (row) =>
        row.codeId !== codeId ||
        (input.sourceId !== undefined && row.sourceId !== input.sourceId) ||
        (input.issuedFrom !== undefined && (row.issueDate === null || row.issueDate < input.issuedFrom)) ||
        (input.issuedTo !== undefined && (row.issueDate === null || row.issueDate > input.issuedTo))
    )
  ) {
    throw new Error("legal_editions_response_mismatch")
  }
  return page
}
export function validateLegalProvisionsResponse(value: unknown, codeId: string, query: LegalProvisionsRequest) {
  const input = legalProvisionsRequestSchema.parse(query)
  const page = legalProvisionsResponseSchema.parse(value)
  const edition = page.meta.selectedEdition
  if (
    !validPage(page, page.data.length, input.limit) ||
    edition.codeId !== codeId ||
    (input.editionId !== undefined && edition.id !== input.editionId) ||
    new Set(page.data.map((row) => row.id)).size !== page.data.length ||
    page.data.some(
      (row, index) =>
        row.codeId !== codeId ||
        row.editionId !== edition.id ||
        (input.traversal === "children" && row.parentId !== (input.parentId ?? null)) ||
        (input.nodeKind !== undefined && row.nodeKind !== input.nodeKind) ||
        (index > 0 && row.ordinal <= page.data[index - 1]!.ordinal) ||
        row.textUrl !== `/api/legal/versions/${row.versionId}/text?editionId=${edition.id}`
    )
  ) {
    throw new Error("legal_provisions_response_mismatch")
  }
  return page
}
