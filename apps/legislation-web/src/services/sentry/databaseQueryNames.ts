import { z } from "zod"

export const databaseQueryNameSchema = z.enum([
  "bill.search.lexical",
  "bill.search.semantic",
  "bill.timeline",
  "passage.search.lexical",
  "passage.search.semantic",
  "supporting_material.search.lexical",
  "supporting_material.search.semantic"
])

export type DatabaseQueryName = z.infer<typeof databaseQueryNameSchema>
export type DatabasePoolName = "canonical" | "passage_search"
