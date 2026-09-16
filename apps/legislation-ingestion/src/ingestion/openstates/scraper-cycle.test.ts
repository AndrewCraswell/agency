import { describe, expect, it } from "vitest"
import { planNcBillBatches } from "./scraper-batches.js"
import { assessScraperBillCycle } from "./scraper-cycle.js"

const xml = (id: string) => `<rss><channel><item><bill>${id}</bill></item></channel></rss>`
const plan = planNcBillBatches({ H: xml("H1"), S: xml("S1") }, "resume-test")
const record = (batch = plan.batches[0]!) => ({
  stream: `nc-bills:2025:${plan.inventoryId}:${batch.id}`,
  cursor: {
    status: "promoted",
    inventoryId: plan.inventoryId,
    cycleId: plan.cycleId,
    batchId: batch.id,
    dispatchPath: "openstates/scraper-dispatches/nc/attempt-1.json",
    runId: "attempt-1",
    manifestPath: `openstates/scrapers/${"a".repeat(40)}/nc/bills/attempt-1/retained.json`,
    manifestSha256: "b".repeat(64),
    buildInputsSha256: "c".repeat(64),
    bills: batch.billIds.length,
    unresolvedSponsors: 2,
    unresolvedPositions: 3
  }
})

describe("committed NC cycle ledger", () => {
  it("resumes exactly unfinished batches and reports source-only references separately", () => {
    const state = assessScraperBillCycle(plan, [record()])
    expect(state).toMatchObject({
      totalBatches: 2,
      promotedBatches: 1,
      totalBills: 2,
      promotedBills: 1,
      unresolvedSponsors: 2,
      unresolvedPositions: 3,
      promotionComplete: false,
      productionReady: false
    })
    expect(state.pending).toEqual([plan.batches[1]])
  })
  it("never treats all committed batches as production or identity readiness", () => {
    expect(assessScraperBillCycle(plan, plan.batches.map(record))).toMatchObject({
      promotionComplete: true,
      pending: [],
      unresolvedSponsors: 4,
      productionReady: false
    })
  })
  it("starts all batches when no canonical receipts exist", () => {
    expect(assessScraperBillCycle(plan, []).pending).toEqual(plan.batches)
  })
  it.each([
    { status: "extracted" },
    { status: "failed" },
    { bills: 0 },
    { bills: 2 },
    { inventoryId: "d".repeat(64) },
    { cycleId: "another-cycle" },
    { batchId: "d".repeat(64) },
    { unresolvedPositions: -1 },
    { manifestSha256: "missing" },
    { dispatchPath: "another-attempt" },
    { manifestPath: "another-attempt" }
  ])("rejects incomplete or conflicting receipt fields: %j", (change) => {
    const original = record()
    expect(() => assessScraperBillCycle(plan, [{ ...original, cursor: { ...original.cursor, ...change } }])).toThrow(
      /Invalid|match|Too small/
    )
  })
  it("rejects duplicate rows and mismatched stream keys", () => {
    expect(() => assessScraperBillCycle(plan, [record(), record()])).toThrow("does not match")
    expect(() => assessScraperBillCycle(plan, [{ ...record(), stream: "another-cycle" }])).toThrow("does not match")
  })
})
