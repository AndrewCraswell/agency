import { z } from "zod"

const id = z.string().min(1).max(256)
const hash = z.string().regex(/^[a-f0-9]{64}$/)

/** An edition qualifies a text version's membership; it is not a competing version selector. */
export const legalSelectionSchema = z
  .strictObject({ editionId: id.optional(), versionId: id.optional(), asOf: z.iso.date().optional() })
  .superRefine((value, ctx) => {
    if (value.asOf !== undefined && (value.editionId !== undefined || value.versionId !== undefined)) {
      ctx.addIssue({ code: "custom", message: "asOf cannot be combined with an edition or version" })
    }
  })

export const legalBrowseSelectionSchema = z
  .strictObject({
    editionId: id.optional(),
    asOf: z.iso.date().optional(),
    traversal: z.enum(["children", "all"]).default("children"),
    parentId: id.optional()
  })
  .superRefine((value, ctx) => {
    if (value.editionId !== undefined && value.asOf !== undefined) {
      ctx.addIssue({ code: "custom", message: "Choose editionId or asOf" })
    }
    if (value.traversal === "all" && value.parentId !== undefined) {
      ctx.addIssue({ code: "custom", message: "All-node enumeration cannot specify a parent" })
    }
  })

export const legalAgencyReferenceSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("resolved"),
    organizationId: id,
    sourceAgencyId: id,
    name: z.string().min(1),
    sourceId: id,
    nativeId: id.nullable()
  }),
  z.strictObject({
    status: z.literal("unresolved"),
    organizationId: z.null(),
    sourceAgencyId: id,
    name: z.string().min(1),
    sourceId: id,
    nativeId: id.nullable()
  })
])

export const legalCapabilitySchema = z
  .strictObject({
    status: z.enum(["available", "not_ingested", "incomplete", "unsupported", "restricted"]),
    isStale: z.boolean(),
    reason: z.string().min(1).nullable()
  })
  .superRefine((value, ctx) => {
    if (value.status !== "available" && value.reason === null) {
      ctx.addIssue({ code: "custom", message: "Unavailable capabilities require an explicit reason" })
    }
    if (value.isStale && !["available", "incomplete"].includes(value.status)) {
      ctx.addIssue({ code: "custom", message: "Only retained available or incomplete data can be stale" })
    }
  })

export const legalEditionContextSchema = z.strictObject({
  editionId: id,
  provisionId: id,
  versionId: id,
  sourceObservationId: id,
  sourceId: id,
  rightsPolicyHash: hash,
  parentId: id.nullable(),
  sourceLocator: z.string().min(1),
  sourceCurrencyDate: z.iso.date().nullable(),
  selectedDate: z.iso.date().nullable(),
  basis: z.enum(["publisher_point_in_time", "published_edition", "observed_snapshot"]),
  legalStatus: z.literal("unknown")
})

/** Pure membership validation. Authorization and publisher-date selection happen in the read service. */
export function validateLegalEditionContext(
  value: unknown,
  expected: { provisionId: string; versionId: string; editionId: string }
) {
  const context = legalEditionContextSchema.parse(value)
  if (
    context.provisionId !== expected.provisionId ||
    context.versionId !== expected.versionId ||
    context.editionId !== expected.editionId
  ) {
    throw new Error("legal_edition_membership_mismatch")
  }
  return context
}

export const legalReaderScopeSchema = z.strictObject({
  callerKey: id,
  editionId: id.nullable(),
  sourceObservationId: id,
  rightsPolicyHash: hash
})
export type LegalReaderScope = z.infer<typeof legalReaderScopeSchema>

export const legalTextBlockSchema = z
  .strictObject({
    id,
    sourceOrdinal: z.int().nonnegative().nullable(),
    kind: z.enum(["text", "table", "authority", "heading", "footnote"]),
    tag: z.string().nullable(),
    start: z.int().nonnegative(),
    end: z.int().nonnegative(),
    text: z.string().max(16_384)
  })
  .superRefine((value, ctx) => {
    if (value.end <= value.start || value.end - value.start !== value.text.length) {
      ctx.addIssue({ code: "custom", message: "Block text must exactly cover its UTF-16 source interval" })
    }
  })
export type LegalTextBlock = z.infer<typeof legalTextBlockSchema>

export const legalTextWindowSchema = z.strictObject({
  versionId: id,
  readerContract: z.literal("legal-source-text-2026-09-14"),
  bodyHash: hash,
  blockGeneration: hash,
  format: z.literal("plain_text"),
  blocks: z.array(legalTextBlockSchema).max(100),
  totalBlocks: z.int().nonnegative(),
  startBlock: z.int().nonnegative(),
  nextCursor: z.string().nullable(),
  isStart: z.boolean(),
  isEnd: z.boolean(),
  availability: z.enum(["available", "empty"]),
  textTruncated: z.literal(false)
})
