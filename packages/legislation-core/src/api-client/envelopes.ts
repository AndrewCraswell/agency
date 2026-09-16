import { z } from "zod"

export const linksSchema = z.object({ self: z.string().min(1) }).strict()
export const resourceSchema = z
  .object({
    data: z.json(),
    links: linksSchema,
    meta: z.object({ correlationId: z.string().min(1), warnings: z.array(z.string()) }).strict()
  })
  .strict()
export const pageSchema = z
  .object({
    data: z.array(z.json()),
    links: linksSchema.extend({ next: z.string().min(1).nullable() }).strict(),
    meta: z
      .object({
        correlationId: z.string().min(1),
        limit: z.number().int().positive(),
        nextCursor: z.string().min(1).nullable(),
        truncated: z.boolean(),
        warnings: z.array(z.string())
      })
      .strict()
  })
  .strict()
export const searchPageSchema = pageSchema.extend({
  meta: pageSchema.shape.meta.extend({
    isReranked: z.boolean(),
    mode: z.enum(["hybrid", "lexical", "semantic"]),
    models: z.array(z.json())
  })
})
