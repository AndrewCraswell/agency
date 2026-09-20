import { describe, expect, it } from "vitest"
import { z } from "zod"
import { citationReferenceSchema, formatCitationReference, nextCitationOrdinal } from "./citationReference"

describe("citation reference policy", () => {
  it("starts at one and advances past the highest marker without number coercion", () => {
    expect(nextCitationOrdinal([])).toBe(1n)
    expect(nextCitationOrdinal(["e7", "e2", "e7"])).toBe(8n)
    expect(nextCitationOrdinal(["e9007199254740993", "e1"])).toBe(9007199254740994n)
  })

  it.each(["", "e", "e0", "e01", "e-1", "e+2", "E3", " e4", "e5 ", "e1.5", "e1e3", `e${"9".repeat(32)}`])(
    "ignores malformed previous marker %j",
    (reference) => {
      expect(citationReferenceSchema.safeParse(reference).success).toBe(false)
      expect(nextCitationOrdinal([reference])).toBe(1n)
      expect(nextCitationOrdinal(["e7", reference])).toBe(8n)
    }
  )

  it("formats exact positive ordinals through the existing 31-digit bound", () => {
    const maximum = 10n ** 31n - 1n
    for (const ordinal of [1n, 9007199254740993n, maximum]) {
      const reference = formatCitationReference(ordinal)
      expect(reference).toBe(`e${ordinal}`)
      expect(citationReferenceSchema.parse(reference)).toBe(reference)
      expect(nextCitationOrdinal([reference])).toBe(ordinal + 1n)
    }
  })

  it("fails explicitly rather than formatting zero, negative or exhausted ordinals", () => {
    for (const ordinal of [0n, -1n, nextCitationOrdinal([`e${"9".repeat(31)}`])]) {
      expect(() => formatCitationReference(ordinal)).toThrow(z.ZodError)
    }
  })
})
