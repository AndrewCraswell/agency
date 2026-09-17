import { z } from "zod"

export const researchSuggestionsSchema = z.strictObject({
  suggestions: z
    .array(
      z.strictObject({
        text: z
          .string()
          .trim()
          .min(1)
          .max(110)
          .regex(/^[^\r\n\u00b7\u2022]+$/),
        description: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .regex(/^[^\r\n\u00b7\u2022]+$/),
        kind: z.enum(["sponsors", "actions", "comparison", "hearings"])
      })
    )
    .length(6)
    .refine((items) => new Set(items.map((item) => item.text.toLowerCase())).size === 6, "Questions must be distinct")
    .refine((items) => new Set(items.map((item) => item.kind)).size === 4, "Research approaches must be varied")
})

export type ResearchSuggestion = z.infer<typeof researchSuggestionsSchema>["suggestions"][number]
