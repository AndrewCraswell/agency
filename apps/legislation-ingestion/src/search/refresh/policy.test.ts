import { describe, expect, it } from "vitest"
import { classifyRefreshTables, refreshPolicy } from "./policy.js"

describe("refresh policy", () => {
  it("assigns every declared table exactly one action", () => {
    const tables = Object.values(refreshPolicy).flat()
    const classified = classifyRefreshTables(tables)
    expect(classified.size).toBe(tables.length)
    expect(classified.get("bills")).toBe("copy")
    expect(classified.get("subscriptions")).toBe("clear")
    expect(classified.get("webhook_signing_keys")).toBe("exclude")
    expect(classified.get("document_section_embeddings")).toBe("rebuild")
  })

  it("fails closed for catalog drift in either direction", () => {
    const tables = Object.values(refreshPolicy).flat()
    expect(() => classifyRefreshTables([...tables, "new_unreviewed_table"])).toThrow("unknown: new_unreviewed_table")
    expect(() => classifyRefreshTables(tables.slice(1))).toThrow("missing: jurisdictions")
  })
})
