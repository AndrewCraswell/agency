import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  assertBillPlanState,
  attemptId,
  billBatchConcurrencyKey,
  openStatesBillCloudPayload,
  openStatesBillPlanPayload
} from "./openstates-bill-scraper-tasks.js"

describe("hosted Open States bill scraper task contract", () => {
  it("uses a receipt-driven chain with an explicit managed schedule", async () => {
    const source = await readFile(new URL("./openstates-bill-scraper-tasks.ts", import.meta.url), "utf8")
    expect(source).toContain('id: "openstates-bill-scraper-plan"')
    expect(source).toContain('id: "openstates-bill-scraper-dispatch"')
    expect(source).toContain('id: "openstates-bill-scraper-cloud"')
    expect(source).toContain('id: "openstates-bill-scraper-schedule"')
    expect(source).toContain("acquireStateBillPlan")
    expect(source).toContain("executeScraperBillBatch")
    expect(source).toContain("inspectScraperBillCycle")
    expect(source).toContain("dispatchCloudScraperAttempt")
    expect(source).toContain("after.available[0]?.id")
    expect(source).toContain("schedules.task")
    expect(source).toContain('"openstates-content-controller"')
    expect(source).not.toContain("OPENSTATES_API_KEY")
  })

  it("accepts only the two explicitly activated current sessions", () => {
    expect(openStatesBillPlanPayload.parse({ state: "ak" })).toEqual({ state: "ak" })
    expect(openStatesBillPlanPayload.parse({ state: "ak", refreshDate: "2026-09-17" })).toEqual({
      state: "ak",
      refreshDate: "2026-09-17"
    })
    expect(
      openStatesBillCloudPayload.parse({
        state: "nc",
        planPath: "openstates/scraper-plans/nc/2025/nc-bills-cycle/plan.json",
        batchId: "a".repeat(64)
      })
    ).toMatchObject({ state: "nc" })
    expect(() => openStatesBillPlanPayload.parse({ state: "ca" })).toThrow()
    expect(() => assertBillPlanState("ak", "openstates/scraper-plans/nc/2025/nc-bills-cycle/plan.json")).toThrow(
      "does not match"
    )
    expect(assertBillPlanState("ak", "openstates/scraper-plans/ak/34/ak-bills-cycle/plan.json")).toContain("/ak/34/")
  })

  it("uses a fresh bounded extraction identity for each task attempt", () => {
    const first = attemptId("ak", "run_06gb21pbhgpg8jqjlcjqmirb01", 1)
    const retry = attemptId("ak", "run_06gb21pbhgpg8jqjlcjqmirb01", 2)
    expect(first).toMatch(/^ak-bill-[a-f0-9]{32}$/)
    expect(retry).toMatch(/^ak-bill-[a-f0-9]{32}$/)
    expect(retry).not.toBe(first)
    expect(attemptId("ak", "run_06gb21pbhgpg8jqjlcjqmirb01", 1)).toBe(first)
    expect(() => attemptId("ak", "run_06gb21pbhgpg8jqjlcjqmirb01", 0)).toThrow()
  })

  it("isolates parallel cloud work by immutable batch identity", () => {
    const first = "a".repeat(64)
    const second = "b".repeat(64)
    expect(billBatchConcurrencyKey("nc", first)).toBe(`production:openstates-scraper:bills:nc:${first}`)
    expect(billBatchConcurrencyKey("nc", second)).not.toBe(billBatchConcurrencyKey("nc", first))
    expect(() => billBatchConcurrencyKey("nc", "not-a-digest")).toThrow()
  })
})
