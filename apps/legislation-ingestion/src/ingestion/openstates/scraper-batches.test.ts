import { describe, expect, it } from "vitest"
import {
  archiveNcBillPlan,
  assertScraperBillBatchScope,
  readScraperBillPlan,
  pendingScraperBillBatches,
  planNcBillBatches as createPlan
} from "./scraper-batches.js"
const planNcBillBatches = (input: { H: string; S: string }) => createPlan(input, "cycle-1")
const xml = (ids: string[]) =>
  `<rss><channel>${ids.map((id) => `<item><bill>${id}</bill></item>`).join("")}</channel></rss>`
describe("NC frozen bill inventory", () => {
  it("requires the exact frozen batch, not a subset, another cycle or another lane", () => {
    const feeds = { H: xml(["H1"]), S: xml(["S1", "S2"]) }
    const plan = planNcBillBatches(feeds)
    const batch = plan.batches[1]!
    const request = { jurisdiction: "nc", domain: "bills", session: "2025", bill_ids: ["S2", "S1"] }
    expect(assertScraperBillBatchScope(plan, batch.id, request)).toEqual(batch)
    for (const changes of [
      { bill_ids: ["S1"] },
      { bill_ids: ["S1", "S1"] },
      { bill_ids: ["S1", "S3"] },
      { bill_ids: null },
      { session: "2023" },
      { domain: "events" },
      { jurisdiction: "sc" }
    ]) {
      expect(() => assertScraperBillBatchScope(plan, batch.id, { ...request, ...changes })).toThrow(
        "exact frozen batch"
      )
    }
    expect(() => assertScraperBillBatchScope(createPlan(feeds, "another-cycle"), batch.id, request)).toThrow("not part")
  })
  it("publishes immutable feeds before the plan and rejects changed replay bytes", async () => {
    const objects = new Map<string, Uint8Array>()
    const store = {
      exists: async (path: string) => objects.has(path),
      put: async (path: string, bytes: Uint8Array) => {
        if (objects.has(path)) {
          return false
        }
        objects.set(path, bytes)
        return true
      },
      read: async (path: string) => {
        const bytes = objects.get(path)
        if (!bytes) {
          throw new Error("Missing artifact")
        }
        return bytes
      }
    }
    const feeds = { H: xml(["H1"]), S: xml(["S1"]) }
    const result = await archiveNcBillPlan(store, feeds, "cycle-1")
    expect(await readScraperBillPlan(store, result.path)).toEqual(result.plan)
    expect(await archiveNcBillPlan(store, feeds, "cycle-1")).toEqual(result)
    await expect(archiveNcBillPlan(store, { ...feeds, H: xml(["H2"]) }, "cycle-1")).rejects.toThrow(/feed conflict/)
    objects.set(result.path.replace("plan.json", "H.xml"), Buffer.from(xml(["H2"])))
    await expect(readScraperBillPlan(store, result.path)).rejects.toThrow(/checksum mismatch/)
  })
  it("creates bounded single-chamber batches independent of feed ordering", () => {
    const ids = Array.from({ length: 12 }, (_, index) => `S${index + 1}`)
    const first = planNcBillBatches({ H: xml(["H1"]), S: xml(ids) })
    const reordered = planNcBillBatches({ H: xml(["H1"]), S: xml(ids.toReversed()) })
    expect(reordered.inventoryId).toBe(first.inventoryId)
    expect(reordered.batches).toEqual(first.batches)
    expect(first.batches.map((batch) => batch.billIds.length)).toEqual([1, 10, 2])
    expect(createPlan({ H: xml(["H1"]), S: xml(ids) }, "cycle-2").inventoryId).not.toBe(first.inventoryId)
  })
  it("resumes only missing promotions and rejects another inventory's receipts", () => {
    const plan = planNcBillBatches({ H: xml(["H1"]), S: xml(["S1"]) })
    const receipts = plan.batches.map((batch) => ({
      inventoryId: plan.inventoryId,
      batchId: batch.id,
      status: "extracted" as const
    }))
    expect(pendingScraperBillBatches(plan, receipts).complete).toBe(false)
    expect(
      pendingScraperBillBatches(
        plan,
        receipts.map((receipt) => ({ ...receipt, status: "promoted" }))
      ).complete
    ).toBe(true)
    expect(() => pendingScraperBillBatches(plan, [{ ...receipts[0]!, inventoryId: "other" }])).toThrow(
      /frozen inventory/
    )
  })
  it("rejects incomplete, duplicate, cross-chamber and entity-bearing feeds", () => {
    for (const H of [xml([]), xml(["H1", "H1"]), xml(["S1"]), "<!DOCTYPE rss>" + xml(["H1"])]) {
      expect(() => planNcBillBatches({ H, S: xml(["S1"]) })).toThrow(/Invalid|Too small|Duplicate|Unsafe/)
    }
  })
})
