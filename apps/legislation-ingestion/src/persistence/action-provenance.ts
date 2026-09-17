import { z } from "zod"

export function parseActionProvenanceSessionScope(input: { state: string; session: string }) {
  const state = z.enum(["ak", "nc", "ca"]).parse(input.state)
  const session = z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .parse(input.session)
  const names = { ak: "Alaska", nc: "North Carolina", ca: "California" }
  return { state, session, jurisdictionName: names[state] }
}

export function parseActionProvenanceScope(input: { state: string; session: string; billId: string }) {
  const scope = parseActionProvenanceSessionScope(input)
  const { state, session } = scope
  if (!input.billId.startsWith(`bill:${state}:${session}:`)) {
    throw new Error("Bill must belong to the explicitly selected state and session")
  }
  if (state === "ca" && input.billId !== "bill:ca:20232024:ab:2652") {
    throw new Error("California action provenance repair is limited to AB 2652 in the 2023-2024 session")
  }
  return scope
}

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
