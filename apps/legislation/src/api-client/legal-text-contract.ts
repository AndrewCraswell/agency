import { z } from "zod"
import { legalEditionContextSchema, legalTextWindowSchema } from "../ingestion/regulations/reader-contract.js"
import { resourceSchema } from "./envelopes.js"

const id = z.uuid()
const hash = z.string().regex(/^[a-f0-9]{64}$/)

/** Exact source selection is required; a continuation never silently selects the latest observation. */
export const legalTextRequestSchema = z
  .strictObject({
    editionId: id.optional(),
    sourceObservationId: id.optional(),
    anchor: hash.optional(),
    cursor: z.string().min(1).max(2048).optional(),
    limit: z.int().min(1).max(100).default(20)
  })
  .superRefine((value, ctx) => {
    if ((value.editionId === undefined) === (value.sourceObservationId === undefined)) {
      ctx.addIssue({ code: "custom", message: "Select exactly one editionId or sourceObservationId" })
    }
    if (value.anchor !== undefined && value.cursor !== undefined) {
      ctx.addIssue({ code: "custom", message: "Choose anchor or cursor" })
    }
  })
export type LegalTextRequest = z.input<typeof legalTextRequestSchema>

const selectedContext = z.discriminatedUnion("kind", [
  legalEditionContextSchema.extend({ kind: z.literal("provision") }),
  z.strictObject({
    kind: z.literal("publication"),
    documentId: id,
    versionId: id,
    sourceObservationId: id,
    sourceId: z.string().min(1),
    sourceLocator: z.string().min(1),
    rightsPolicyHash: hash,
    publishedOn: z.iso.date(),
    legalStatus: z.literal("unknown")
  })
])

export const legalTextResponseSchema = resourceSchema
  .extend({
    data: legalTextWindowSchema.extend({ selectedContext })
  })
  .superRefine(({ data }, ctx) => {
    const end = data.startBlock + data.blocks.length
    if (
      data.versionId !== data.selectedContext.versionId ||
      end > data.totalBlocks ||
      data.isStart !== (data.startBlock === 0) ||
      data.isEnd !== (end === data.totalBlocks) ||
      (data.nextCursor === null) !== data.isEnd ||
      (data.availability === "empty") !== (data.totalBlocks === 0) ||
      (data.blocks.length === 0 && data.totalBlocks > 0) ||
      data.blocks.reduce((sum, block) => sum + block.text.length, 0) > 100_000 ||
      data.blocks.some((block, index) => index > 0 && block.start !== data.blocks[index - 1]?.end) ||
      (data.isStart && data.blocks.length > 0 && data.blocks[0]?.start !== 0)
    ) {
      ctx.addIssue({ code: "custom", message: "Inconsistent legal text window" })
    }
  })

export function validateLegalTextResponse(value: unknown, versionId: string, request: LegalTextRequest) {
  const result = legalTextResponseSchema.parse(value)
  const input = legalTextRequestSchema.parse(request)
  const data = result.data
  const context = data.selectedContext
  if (
    data.versionId !== versionId ||
    data.blocks.length > input.limit ||
    (context.kind === "provision"
      ? context.editionId !== input.editionId
      : context.sourceObservationId !== input.sourceObservationId) ||
    (input.anchor !== undefined && data.blocks[0]?.id !== input.anchor) ||
    (input.anchor === undefined && input.cursor === undefined && !data.isStart)
  ) {
    throw new Error("legal_text_response_selection_mismatch")
  }
  return result
}
