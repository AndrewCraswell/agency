import { describe, expect, it, vi } from "vitest"
import { LegislationError, normalizeLegislationError } from "./errors"

describe("domain error normalization", () => {
  it.each(["not_found", "invalid_request", "payload_too_large", "dependency_unavailable"] as const)(
    "preserves %s from a reloaded module instance",
    async (category) => {
      vi.resetModules()
      const reloaded = await import("./errors")
      const original = new reloaded.LegislationError(category, "Known domain failure", { details: { retryable: true } })
      expect(original).not.toBeInstanceOf(LegislationError)
      const normalized = normalizeLegislationError(original)
      expect(normalized).toBeInstanceOf(LegislationError)
      expect(normalized).toMatchObject({
        category,
        message: "Known domain failure",
        details: { retryable: true },
        cause: original
      })
    }
  )

  it("does not accept arbitrary payloads or unknown categories as trusted domain errors", () => {
    expect(
      normalizeLegislationError({ name: "LegislationError", category: "not_found", message: "Untrusted" }).category
    ).toBe("internal")
    expect(
      normalizeLegislationError(Object.assign(new Error("Unknown"), { name: "LegislationError", category: "invented" }))
        .category
    ).toBe("internal")
  })

  it("retains native errors and classifies wrapped PostgreSQL failures", () => {
    const error = new LegislationError("not_found", "Missing")
    expect(normalizeLegislationError(error)).toBe(error)
    expect(normalizeLegislationError(new Error("query", { cause: { code: "57014" } }))).toMatchObject({
      category: "dependency_unavailable",
      details: { reason: "timeout" }
    })
  })
})
