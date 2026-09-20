import { describe, expect, it } from "vitest"
import { toPublicApiError } from "./error-mapping"

describe("public API error mapping", () => {
  it("classifies an unexpectedly terminated PostgreSQL connection as unavailable", () => {
    expect(toPublicApiError(new Error("Connection terminated unexpectedly"))).toMatchObject({
      category: "dependency_unavailable",
      message: "Database is temporarily unavailable"
    })
  })

  it("finds an unexpectedly terminated PostgreSQL connection through wrapped causes", () => {
    const failure = new Error("Query failed", { cause: new Error("Connection terminated unexpectedly") })
    expect(toPublicApiError(failure)).toMatchObject({
      category: "dependency_unavailable",
      cause: failure
    })
  })

  it("preserves unknown failures", () => {
    const failure = new Error("Unknown failure")
    expect(toPublicApiError(failure)).toBe(failure)
  })
})
