import { z } from "zod"

const actionSchema = z.object({
  id: z.string().min(1),
  ordinal: z.number().int().nonnegative(),
  description: z.string().min(1),
  classification: z.array(z.string()),
  actionDate: z.string().nullable(),
  sourceUrl: z.url({ protocol: /^https?$/ }).nullable()
})

/** Only fill provenance when the entire persisted timeline matches retained source evidence. */
export function planActionProvenance(expectedInput: unknown, storedInput: unknown) {
  const expected = z.array(actionSchema).min(1).parse(expectedInput)
  const stored = z.array(actionSchema).parse(storedInput)
  const byId = new Map(expected.map((action) => [action.id, action]))
  if (
    expected.length !== stored.length ||
    byId.size !== expected.length ||
    new Set(stored.map((action) => action.id)).size !== stored.length ||
    new Set(expected.map((action) => action.ordinal)).size !== expected.length ||
    new Set(stored.map((action) => action.ordinal)).size !== stored.length
  ) {
    throw new Error("Action timeline identity or count differs from retained evidence")
  }
  const updates: Array<{ id: string; sourceUrl: string }> = []
  for (const actual of stored) {
    const source = byId.get(actual.id)
    if (
      !source ||
      source.ordinal !== actual.ordinal ||
      source.description !== actual.description ||
      source.actionDate !== actual.actionDate ||
      JSON.stringify(source.classification) !== JSON.stringify(actual.classification)
    ) {
      throw new Error("Action timeline content differs from retained evidence")
    }
    if (source.sourceUrl === null || (actual.sourceUrl !== null && actual.sourceUrl !== source.sourceUrl)) {
      throw new Error("Action source is absent from evidence or conflicts with stored provenance")
    }
    if (actual.sourceUrl === null) {
      updates.push({ id: actual.id, sourceUrl: source.sourceUrl })
    }
  }
  return updates
}
