import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  assertBillPlanState,
  openStatesBillCloudPayload,
  openStatesBillPlanPayload
} from "./openstates-bill-scraper-tasks.js"

describe("hosted Open States bill scraper task contract", () => {
  it("uses a manual receipt-driven chain without an implicit schedule", async () => {
    const source = await readFile(new URL("./openstates-bill-scraper-tasks.ts", import.meta.url), "utf8")
    expect(source).toContain('id: "openstates-bill-scraper-plan"')
    expect(source).toContain('id: "openstates-bill-scraper-dispatch"')
    expect(source).toContain('id: "openstates-bill-scraper-cloud"')
    expect(source).toContain("acquireStateBillPlan")
    expect(source).toContain("executeScraperBillBatch")
    expect(source).toContain("inspectScraperBillCycle")
    expect(source).toContain("dispatchCloudScraperAttempt")
    expect(source).toContain("after.pending[0]?.id")
    expect(source).not.toContain("schedules.task")
    expect(source).not.toContain("OPENSTATES_API_KEY")
  })

  it("accepts only the two explicitly activated current sessions", () => {
    expect(openStatesBillPlanPayload.parse({ state: "ak" })).toEqual({ state: "ak" })
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
})
