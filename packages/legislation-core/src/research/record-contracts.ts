import { z } from "zod"

const text = z.string().trim().min(1).max(512)
export const recordResolutionSchema = z
  .strictObject({
    kind: z.enum(["bill", "amendment", "person", "organization", "meeting", "vote", "document", "material"]),
    id: text.optional(),
    identifier: text.optional(),
    name: text.optional(),
    sourceUrl: z.url({ protocol: /^https?$/ }).optional(),
    jurisdictionId: text.regex(/^jurisdiction:/).optional(),
    sessionId: text.regex(/^session:/).optional(),
    organizationId: text.regex(/^organization:/).optional(),
    chamber: text.optional()
  })
  .superRefine((input, context) => {
    if (!input.id && !input.identifier && !input.name && !input.sourceUrl)
      context.addIssue({
        code: "custom",
        message: "Supply a canonical ID, exact identifier, published name or source URL."
      })
    const allowed: Record<string, readonly string[]> = {
      bill: ["identifier", "jurisdictionId", "sessionId"],
      amendment: ["identifier", "jurisdictionId", "sessionId"],
      person: ["jurisdictionId"],
      organization: ["jurisdictionId"],
      meeting: ["jurisdictionId"],
      vote: ["identifier", "sessionId", "organizationId", "chamber"],
      document: [],
      material: ["jurisdictionId"]
    }
    for (const key of ["identifier", "jurisdictionId", "sessionId", "organizationId", "chamber"] as const) {
      if (input[key] !== undefined && !allowed[input.kind]?.includes(key))
        context.addIssue({
          code: "custom",
          path: [key],
          message: `This filter does not apply to ${input.kind} resolution.`
        })
    }
  })
export type RecordResolutionInput = z.infer<typeof recordResolutionSchema>

export const recordCollectionSchema = z
  .strictObject({
    collection: z.enum([
      "bill-actions",
      "bill-sponsors",
      "bill-documents",
      "person-terms",
      "organization-children",
      "meeting-agenda",
      "meeting-documents",
      "meeting-participants",
      "meeting-bills",
      "meeting-outcomes",
      "vote-positions",
      "amendment-actions",
      "amendment-votes",
      "amendment-materials",
      "document-sections",
      "material-sections"
    ]),
    recordId: text,
    cursor: z.string().min(1).max(16384).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    sectionId: text.optional(),
    textOffset: z.number().int().min(0).max(100000000).optional()
  })
  .superRefine((input, context) => {
    if (
      (input.sectionId !== undefined || input.textOffset !== undefined) &&
      input.collection !== "document-sections" &&
      input.collection !== "material-sections"
    )
      context.addIssue({ code: "custom", message: "Text selection applies only to section collections." })
    if (input.textOffset && !input.sectionId)
      context.addIssue({ code: "custom", message: "Select one section ID when continuing its text." })
  })
export type RecordCollectionInput = z.infer<typeof recordCollectionSchema>
