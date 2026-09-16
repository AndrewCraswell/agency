import { describe, expect, it } from "vitest"
import {
  archiveAkBillPlan,
  assertScraperBillBatchScope,
  planAkBillBatches,
  readScraperBillPlan
} from "./scraper-batches.js"
import { assessScraperBillCycle } from "./scraper-cycle.js"
import { archiveScraperBillDispatch, readScraperBillDispatch } from "./scraper-dispatch.js"
import { scraperBillBatchOwnership, scraperBillPromotionOwnership } from "./scraper-promotion.js"

const html = (ids: string[]) =>
  `<table>${ids.map((id) => `<tr><td><nobr><a href="/basis/Bill/Detail/34?Root=${id}">${id}</a></nobr></td></tr>`).join("")}</table>`
function storeFixture() {
  const objects = new Map<string, Uint8Array>()
  return {
    objects,
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
        throw new Error("Missing fixture")
      }
      return bytes
    }
  }
}

describe("Alaska frozen batches use shared dispatch and ownership", () => {
  it("partitions every discovered bill deterministically and separates chambers", () => {
    const ids = [...Array.from({ length: 13 }, (_, index) => `HB${index + 1}`), "HJR1", "SB1"]
    const plan = planAkBillBatches(html(ids), "cycle-1")
    expect(plan.batches.map((batch) => batch.billIds.length)).toEqual([10, 4, 1])
    expect(planAkBillBatches(html(ids.toReversed()), "cycle-1").batches).toEqual(plan.batches)
    expect(planAkBillBatches(html(ids), "cycle-2").inventoryId).not.toBe(plan.inventoryId)
    const batch = plan.batches[0]!
    expect(
      assertScraperBillBatchScope(plan, batch.id, {
        jurisdiction: "ak",
        session: "34",
        domain: "bills",
        bill_ids: batch.billIds
      })
    ).toEqual(batch)
    expect(() =>
      assertScraperBillBatchScope(plan, batch.id, {
        jurisdiction: "nc",
        session: "34",
        domain: "bills",
        bill_ids: batch.billIds
      })
    ).toThrow("exact frozen batch")
    const scope = scraperBillPromotionOwnership(plan)
    expect(scraperBillBatchOwnership(plan.inventoryId, batch.id, "run-1", scope).stream).toBe(
      `ownership:ak-bills:34:${plan.inventoryId}:${batch.id}`
    )
  })

  it("rejects missing chambers, duplicate identities and misleading source links", () => {
    for (const page of [
      html(["HB1"]),
      html(["HB1", "HB1", "SB1"]),
      html(["HB1", "SB1"]).replace("Root=HB1", "Root=HB2"),
      html(["HB1", "SB1"]).replace("/basis/Bill/Detail/34?Root=HB1", "https://untrusted.example/?Root=HB1")
    ]) {
      expect(() => planAkBillBatches(page, "cycle-1")).toThrow(/Missing Alaska|Duplicate|identity mismatch/)
    }
  })

  it("retains the full source, verifies readback, and refuses relabelled dispatches", async () => {
    const store = storeFixture()
    const frozen = await archiveAkBillPlan(store, html(["HB1", "SB1"]), "cycle-1")
    expect(await readScraperBillPlan(store, frozen.path)).toEqual(frozen.plan)
    const now = new Date("2026-09-15T00:00:00Z")
    const issued = await archiveScraperBillDispatch(store, {
      planPath: frozen.path,
      batchId: frozen.plan.batches[0]!.id,
      runId: "run-1",
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 60_000)
    })
    expect(await readScraperBillDispatch(store, issued.path, now)).toEqual(issued.dispatch)
    store.objects.set(issued.path.replace("/ak/", "/nc/"), await store.read(issued.path))
    await expect(readScraperBillDispatch(store, issued.path.replace("/ak/", "/nc/"), now)).rejects.toThrow(
      "identity mismatch"
    )
    store.objects.set(frozen.path.replace("plan.json", "range.html"), Buffer.from(html(["HB2", "SB1"])))
    await expect(readScraperBillPlan(store, frozen.path)).rejects.toThrow("checksum mismatch")
  })

  it("counts only Alaska promotion receipts matching the frozen cycle", () => {
    const plan = planAkBillBatches(html(["HB1", "SB1"]), "cycle-1")
    const batch = plan.batches[0]!
    const receipt = {
      stream: `ak-bills:34:${plan.inventoryId}:${batch.id}`,
      cursor: {
        status: "promoted",
        cycleId: plan.cycleId,
        inventoryId: plan.inventoryId,
        batchId: batch.id,
        runId: "run-1",
        dispatchPath: "openstates/scraper-dispatches/ak/run-1.json",
        manifestPath: `openstates/scrapers/${"a".repeat(40)}/ak/bills/run-1/retained.json`,
        manifestSha256: "b".repeat(64),
        buildInputsSha256: "c".repeat(64),
        bills: 1,
        unresolvedSponsors: 0,
        unresolvedPositions: 0
      }
    }
    expect(assessScraperBillCycle(plan, [receipt])).toMatchObject({ promotedBills: 1, promotionComplete: false })
    expect(() =>
      assessScraperBillCycle(plan, [{ ...receipt, stream: receipt.stream.replace("ak-bills:34", "nc-bills:2025") }])
    ).toThrow("does not match")
  })
})
