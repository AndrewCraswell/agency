import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { openStatesPersonReconciliationPayload } from "./openstates-person-reconciliation.js"

describe("Open States person reconciliation task", () => {
  it("binds one exact state session to one immutable inventory", () => {
    expect(
      openStatesPersonReconciliationPayload.parse({ state: "ak", session: "34", inventoryId: "a".repeat(64) })
    ).toEqual({ state: "ak", session: "34", inventoryId: "a".repeat(64) })
    expect(() =>
      openStatesPersonReconciliationPayload.parse({ state: "ak", session: "34", inventoryId: "not-a-digest" })
    ).toThrow()
    expect(() =>
      openStatesPersonReconciliationPayload.parse({ state: "ca", session: "2025", inventoryId: "a".repeat(64) })
    ).toThrow()
  })

  it("applies the deterministic null-only plan before dispatching content", async () => {
    const source = await readFile(new URL("./openstates-person-reconciliation.ts", import.meta.url), "utf8")
    expect(source).toContain("buildScraperPersonBackfillPlan")
    expect(source).toContain("scraperPersonBackfillPlanSha256")
    expect(source).toContain("applyScraperPersonBackfillPlan")
    expect(source.indexOf("applyScraperPersonBackfillPlan")).toBeLessThan(
      source.indexOf('"openstates-content-controller"')
    )
  })
})
