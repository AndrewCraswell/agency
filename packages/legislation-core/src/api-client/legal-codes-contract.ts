import { z } from "zod"
import { pageSchema } from "./envelopes"

export const legalCodesRequestSchema = z.strictObject({
  jurisdictionId: z
    .string()
    .regex(/^jurisdiction:[a-z0-9:-]+$/)
    .max(256)
    .optional(),
  kind: z.enum(["statute", "regulation"]).optional(),
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(1024)
    .optional(),
  limit: z.int().min(1).max(100).default(20)
})
export type LegalCodesRequest = z.input<typeof legalCodesRequestSchema>

export const legalCodeSchema = z.strictObject({
  id: z.uuid(),
  jurisdictionId: z.string().min(1).max(256),
  codeKey: z.string().min(1).max(256),
  name: z.string().min(1).max(2048),
  kind: z.enum(["statute", "regulation"]),
  canonicalUrl: z.string().startsWith("/api/legal/codes/"),
  updatedAt: z.iso.datetime(),
  sources: z
    .array(z.strictObject({ sourceId: z.string().min(1), rightsProfileId: z.string().min(1) }))
    .min(1)
    .max(1000)
})
export const legalCodesResponseSchema = pageSchema.extend({ data: z.array(legalCodeSchema).max(100) })

export function validateLegalCodesResponse(value: unknown, request: LegalCodesRequest) {
  const input = legalCodesRequestSchema.parse(request)
  const response = legalCodesResponseSchema.parse(value)
  if (
    response.meta.limit !== input.limit ||
    response.data.length > input.limit ||
    response.meta.truncated !== (response.meta.nextCursor !== null) ||
    (response.links.next === null) !== (response.meta.nextCursor === null) ||
    new Set(response.data.map((row) => row.id)).size !== response.data.length ||
    response.data.some(
      (row) =>
        row.canonicalUrl !== `/api/legal/codes/${row.id}` ||
        (input.jurisdictionId !== undefined && row.jurisdictionId !== input.jurisdictionId) ||
        (input.kind !== undefined && row.kind !== input.kind)
    )
  ) {
    throw new Error("legal_codes_response_mismatch")
  }
  return response
}
