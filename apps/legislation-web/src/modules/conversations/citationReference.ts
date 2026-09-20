import { z } from "zod"

export const citationReferenceSchema = z.string().regex(/^e[1-9][0-9]{0,30}$/)

export function nextCitationOrdinal(references: Iterable<string>) {
  let nextOrdinal = 1n
  for (const reference of references) {
    const parsed = citationReferenceSchema.safeParse(reference)
    if (parsed.success) {
      const next = BigInt(parsed.data.slice(1)) + 1n
      if (next > nextOrdinal) {
        nextOrdinal = next
      }
    }
  }
  return nextOrdinal
}

export function formatCitationReference(ordinal: bigint) {
  return citationReferenceSchema.parse(`e${ordinal}`)
}
