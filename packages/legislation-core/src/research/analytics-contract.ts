import { z } from "zod"

const fieldSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*){0,4}$/)
  .max(180)
const nameSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,47}$/)
const valueSchema = z.union([z.string().max(500), z.number().finite(), z.boolean()])
export const analyticsFilterSchema = z.strictObject({
  field: fieldSchema,
  op: z.enum(["eq", "in", "notIn", "gte", "lte", "contains", "isNull", "notNull"]),
  values: z.array(valueSchema).max(50).default([])
})
export const analyticsCatalogSchema = z.strictObject({ datasets: z.array(nameSchema).max(6).optional() })
export const analyticsQuerySchema = z.strictObject({
  dataset: nameSchema.describe(
    "The starting record grain. For people with recorded votes, start from positions and group person.id/name; for people with sponsorships, start from sponsorships. This avoids scanning unrelated history and preserves explicit existence requirements. Start from parents when zero-child parents must remain eligible. The displayed group need not be the starting dataset."
  ),
  select: z
    .array(fieldSchema)
    .max(12)
    .default([])
    .describe(
      "Exact fields requested for output and grouping. id is the canonical identity; identifier is a printed bill label and is not a substitute. Preserve all requested identity fields."
    ),
  filters: z
    .array(analyticsFilterSchema)
    .max(16)
    .default([])
    .describe(
      "Restrictions on the population, including explicit existence ('people who sponsored bills') and jurisdiction/session of the fact named. For 119th-Congress bills use bill.sessionId or root bills.sessionId, even when counting amendments. For amendments from a Congress use amendments.sessionId instead. Scope IDs refer to the stored fact, not an inferred date. Put child classification predicates in metrics[].filters only when zero-count parents remain eligible."
    ),
  metrics: z
    .array(
      z.strictObject({
        name: nameSchema,
        operation: z.enum(["countDistinct", "min", "max"]),
        field: fieldSchema.describe(
          "Count grain: _key counts distinct dataset records, including composite position identities. positions.personId counts people, not position records. voteId counts votes. Use the exact requested grain."
        ),
        filters: z
          .array(analyticsFilterSchema)
          .max(4)
          .default([])
          .describe(
            "Restrictions only on this measure, preserving every group in the population. To rank bills by amendment-classified documents, count documents.id with documents.classification=amendment here, NOT in top-level filters. Bills with no matching documents then have count 0."
          )
      })
    )
    .max(8)
    .default([]),
  rates: z
    .array(z.strictObject({ name: nameSchema, numerator: nameSchema, denominator: nameSchema }))
    .max(4)
    .default([]),
  having: z
    .array(z.strictObject({ field: nameSchema, op: z.enum(["gte", "lte", "eq"]), value: z.number().finite() }))
    .max(4)
    .default([])
    .describe(
      "Only an explicitly requested minimum/maximum or existence requirement, such as at least five actions or bills that have amendments. For most/highest/top rankings alone use []: never invent count >= 1. Zero counts remain eligible, with unknown upstream coverage disclosed."
    ),
  orderBy: z
    .array(z.strictObject({ field: fieldSchema, direction: z.enum(["asc", "desc"]) }))
    .max(4)
    .default([]),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(10000).default(0)
})
export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>
