import { describe, expect, it } from "vitest"
import { ingestionErrorSummary, sanitizeIngestionMessage } from "./errors.js"

describe("ingestion diagnostics", () => {
  it("retains nested database identities without query text or parameters", () => {
    const cause = Object.assign(new Error('new row violates check constraint "people_provenance_complete_check"'), {
      code: "23514",
      constraint: "people_provenance_complete_check",
      detail: "private row data"
    })
    const message = ingestionErrorSummary(
      new Error("Failed query: insert into people values ($1)\nparams: secret-value", { cause })
    )
    expect(message).toContain("Database query failed")
    expect(message).toContain("SQLSTATE 23514")
    expect(message).toContain("constraint people_provenance_complete_check")
    expect(message).not.toMatch(/insert into|secret-value|private row/)
  })
  it("redacts credential URLs, headers and quoted credential fields", () => {
    const message = sanitizeIngestionMessage(
      'https://host/path?api_key=abc postgres://user:password@host/db Bearer xyz {"api_key":"sensitive"} password=hidden token:abc'
    )
    expect(message).not.toMatch(/abc|xyz|sensitive|hidden|user:password/)
    expect(message).toContain("[REDACTED]")
  })
  it("bounds cyclic and oversized cause chains without losing the database cause", () => {
    const root = new Error("x".repeat(10000))
    const cause = Object.assign(new Error("constraint rejected"), { code: "23514", cause: root })
    root.cause = cause
    const message = ingestionErrorSummary(root)
    expect(message.length).toBeLessThanOrEqual(2000)
    expect(message).toContain("SQLSTATE 23514")
  })
})
