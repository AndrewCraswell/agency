import { z } from "zod"
import { pageSchema } from "./envelopes"

const id = z.string().trim().min(1).max(256)

export const legalAgenciesRequestSchema = z.strictObject({
  jurisdictionId: z
    .string()
    .regex(/^jurisdiction:[a-z0-9:-]+$/)
    .max(256)
    .optional(),
  sourceId: z.literal("federal-register").optional(),
  q: z.string().trim().min(1).max(200).optional(),
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(2048)
    .optional(),
  limit: z.int().min(1).max(100).default(20)
})
export type LegalAgenciesRequest = z.input<typeof legalAgenciesRequestSchema>

export const legalAgencyDirectoryEntrySchema = z
  .strictObject({
    status: z.enum(["resolved", "unresolved"]),
    organizationId: id.nullable(),
    sourceAgencyId: id,
    name: z.string().min(1).max(2048),
    aliases: z.array(z.string().min(1).max(2048)).max(100),
    sourceId: z.literal("federal-register"),
    nativeId: id.nullable(),
    jurisdictionId: z.literal("jurisdiction:us"),
    publicationCount: z.int().positive(),
    firstPublishedOn: z.iso.date(),
    lastPublishedOn: z.iso.date()
  })
  .superRefine((entry, context) => {
    if (
      (entry.status === "resolved") !== (entry.organizationId !== null) ||
      entry.aliases.includes(entry.name) ||
      new Set(entry.aliases).size !== entry.aliases.length
    ) {
      context.addIssue({ code: "custom", message: "Invalid legal agency directory entry" })
    }
  })

export const legalAgenciesResponseSchema = pageSchema.extend({
  data: z.array(legalAgencyDirectoryEntrySchema).max(100)
})

export function validateLegalAgenciesResponse(value: unknown, request: LegalAgenciesRequest) {
  const input = legalAgenciesRequestSchema.parse(request)
  const response = legalAgenciesResponseSchema.parse(value)
  const query = input.q?.toLocaleLowerCase("en-US")
  if (
    response.meta.limit !== input.limit ||
    response.data.length > input.limit ||
    response.meta.truncated !== (response.meta.nextCursor !== null) ||
    (response.links.next === null) !== (response.meta.nextCursor === null) ||
    new Set(response.data.map((row) => row.sourceAgencyId)).size !== response.data.length ||
    response.data.some(
      (row) =>
        (input.jurisdictionId !== undefined && row.jurisdictionId !== input.jurisdictionId) ||
        (input.sourceId !== undefined && row.sourceId !== input.sourceId) ||
        (query !== undefined &&
          ![row.name, ...row.aliases].some((name) => name.toLocaleLowerCase("en-US").includes(query)))
    )
  ) {
    throw new Error("legal_agencies_response_mismatch")
  }
  return response
}
