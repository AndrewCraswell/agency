import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  assertCompletedPersonReconciliationCycle,
  openStatesPersonReconciliationPayload
} from "./openstates-person-reconciliation.js"

describe("Open States person reconciliation task", () => {
  it("continues Washington through the same exact-cycle reconciliation contract", () => {
    const payload = openStatesPersonReconciliationPayload.parse({
      state: "wa",
      session: "2025-2026",
      inventoryId: "a".repeat(64),
      planPath: "openstates/scraper-plans/wa/2025-2026/wa-bills-cycle/plan.json"
    })
    expect(() =>
      assertCompletedPersonReconciliationCycle(payload, {
        inventoryId: payload.inventoryId,
        promotionComplete: true
      })
    ).not.toThrow()
    expect(() =>
      assertCompletedPersonReconciliationCycle(
        { ...payload, session: "2023-2024" },
        {
          inventoryId: payload.inventoryId,
          promotionComplete: true
        }
      )
    ).toThrow(/state and session/)
  })
  it("binds one exact state session to one immutable inventory", () => {
    expect(
      openStatesPersonReconciliationPayload.parse({
        state: "ak",
        session: "34",
        inventoryId: "a".repeat(64),
        planPath: "openstates/scraper-plans/ak/34/ak-bills-cycle/plan.json"
      })
    ).toEqual({
      state: "ak",
      session: "34",
      inventoryId: "a".repeat(64),
      planPath: "openstates/scraper-plans/ak/34/ak-bills-cycle/plan.json"
    })
    expect(() =>
      openStatesPersonReconciliationPayload.parse({
        state: "ak",
        session: "34",
        inventoryId: "not-a-digest",
        planPath: "openstates/scraper-plans/ak/34/ak-bills-cycle/plan.json"
      })
    ).toThrow()
    expect(() =>
      openStatesPersonReconciliationPayload.parse({
        state: "ca",
        session: "2025",
        inventoryId: "a".repeat(64),
        planPath: "openstates/scraper-plans/nc/2025/nc-bills-cycle/plan.json"
      })
    ).toThrow()
  })

  it("requires receipt-ledger completion for the exact frozen plan", () => {
    const payload = openStatesPersonReconciliationPayload.parse({
      state: "nc",
      session: "2025",
      inventoryId: "a".repeat(64),
      planPath: "openstates/scraper-plans/nc/2025/nc-bills-cycle/plan.json"
    })
    expect(() =>
      assertCompletedPersonReconciliationCycle(payload, {
        inventoryId: payload.inventoryId,
        promotionComplete: false
      })
    ).toThrow("fully promoted")
    expect(() =>
      assertCompletedPersonReconciliationCycle(payload, {
        inventoryId: "b".repeat(64),
        promotionComplete: true
      })
    ).toThrow("inventory")
    expect(() =>
      assertCompletedPersonReconciliationCycle(
        { ...payload, state: "ak" },
        { inventoryId: payload.inventoryId, promotionComplete: true }
      )
    ).toThrow("state and session")
    expect(() =>
      assertCompletedPersonReconciliationCycle(payload, {
        inventoryId: payload.inventoryId,
        promotionComplete: true
      })
    ).not.toThrow()
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
