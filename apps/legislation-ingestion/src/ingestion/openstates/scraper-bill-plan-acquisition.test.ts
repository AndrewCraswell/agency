import { describe, expect, it, vi } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { assertScraperBillBatchScope, planWaBillBatches, readScraperBillPlan } from "./scraper-batches.js"
import { acquireStateBillPlan } from "./scraper-bill-plan-acquisition.js"

class Store implements ArtifactStore {
  readonly values = new Map<string, Uint8Array>()
  async exists(path: string) {
    return this.values.has(path)
  }
  async put(path: string, bytes: Uint8Array) {
    const existing = this.values.get(path)
    if (existing) return Buffer.from(existing).equals(bytes)
    this.values.set(path, bytes)
    return true
  }
  async read(path: string) {
    const value = this.values.get(path)
    if (!value) throw new Error("missing")
    return value
  }
}

const akHtml = `<table><tr><td><nobr><a href="/basis/Bill/Detail/34?Root=HB1">HB1</a></nobr></td></tr><tr><td><nobr><a href="/basis/Bill/Detail/34?Root=SB2">SB2</a></nobr></td></tr></table>`
const feed = (bill: string) => `<rss><channel><item><bill>${bill}</bill></item></channel></rss>`
const waRow = (id: string, number: number, chamber = "House", type = "B") =>
  "<LegislationInfo><Biennium>2025-26</Biennium><BillId>" +
  id +
  "</BillId><BillNumber>" +
  number +
  "</BillNumber><OriginalAgency>" +
  chamber +
  "</OriginalAgency><ShortLegislationType><ShortLegislationType>" +
  type +
  "</ShortLegislationType></ShortLegislationType></LegislationInfo>"
const waFeed = (rows: string[]) =>
  '<ArrayOfLegislationInfo xmlns="http://WSLWebServices.leg.wa.gov/">' + rows.join("") + "</ArrayOfLegislationInfo>"

describe("acquireStateBillPlan", () => {
  it("freezes and replays both Washington years with deduplicated carryovers and bounded chamber batches", async () => {
    const store = new Store()
    const house = Array.from({ length: 12 }, (_, index) => waRow("HB " + (1000 + index), 1000 + index))
    const first = waFeed([...house, waRow("SB 5000", 5000, "Senate")])
    const second = waFeed([
      waRow("E2SHB 1000", 1000),
      waRow("2ESSB 5000", 5000, "Senate"),
      waRow("HJR 4000", 4000, "House", "JR"),
      waRow("SGA 9000", 9000, "Senate", "GA"),
      waRow("HI IL26-001", 26001, "House", "I")
    ])
    const request = vi.fn<typeof fetch>(
      async (input) =>
        new Response(String(input).endsWith("2025") ? first : second, { headers: { "content-type": "text/xml" } })
    )
    const result = await acquireStateBillPlan(store, "wa", { fetch: request, refreshDate: "2026-09-19" })
    expect(result).toMatchObject({ bills: 14, batches: 3, state: "wa", session: "2025-2026" })
    expect(request).toHaveBeenCalledTimes(2)
    const plan = await readScraperBillPlan(store, result.planPath)
    expect(plan.batches.map((batch) => batch.billIds.length)).toEqual([10, 3, 1])
    expect(plan.inventories[0]?.ids).toContain("HB 1000")
    const batch = plan.batches[0]!
    expect(
      assertScraperBillBatchScope(plan, batch.id, {
        jurisdiction: "wa",
        session: "2025-2026",
        domain: "bills",
        bill_ids: batch.billIds
      })
    ).toEqual(batch)
    expect(await acquireStateBillPlan(store, "wa", { fetch: request, refreshDate: "2026-09-19" })).toEqual(result)
    store.values.set(
      result.planPath.replace("plan.json", "2026.xml"),
      Buffer.from(second.replace("HJR 4000", "HJR 4001").replace("<BillNumber>4000", "<BillNumber>4001"))
    )
    await expect(readScraperBillPlan(store, result.planPath)).rejects.toThrow("checksum mismatch")
  })

  it("rejects Washington source mismatches and incomplete or unsafe inventories", () => {
    const valid = waFeed([waRow("HB 1000", 1000), waRow("SB 5000", 5000, "Senate")])
    for (const invalid of [
      valid.replace("2025-26", "2023-24"),
      valid.replace("HB 1000", "HB 1001"),
      valid.replace("House", "Senate"),
      valid.replace("HB 1000", "UNKNOWN 1000"),
      valid.replace("http://WSLWebServices.leg.wa.gov/", "https://example.org/"),
      "<!DOCTYPE test>" + valid,
      waFeed([]),
      waFeed([waRow("SGA 1234", 1234, "Senate", "GA")]),
      waFeed([waRow("HI 2", 1, "House", "I")])
    ]) {
      expect(() => planWaBillBatches({ "2025": invalid, "2026": valid }, "cycle")).toThrow()
    }
    const houseOnly = waFeed([waRow("HB 1000", 1000)])
    expect(() => planWaBillBatches({ "2025": houseOnly, "2026": houseOnly }, "cycle")).toThrow(
      "Missing Washington chamber"
    )
    const reordered = waFeed([waRow("SB 5000", 5000, "Senate"), waRow("SHB 1000", 1000)])
    const first = planWaBillBatches({ "2025": valid, "2026": valid }, "cycle")
    const second = planWaBillBatches({ "2025": reordered, "2026": valid }, "cycle")
    expect(second.batches).toEqual(first.batches)
    expect(second.inventoryId).toBe(first.inventoryId)
  })
  it("freezes Alaska publisher discovery before returning a batch plan", async () => {
    const store = new Store()
    const request = vi.fn<typeof fetch>(
      async () => new Response(akHtml, { headers: { "content-type": "text/html; charset=utf-8" } })
    )
    const result = await acquireStateBillPlan(store, "ak", { fetch: request })
    expect(result).toMatchObject({ batches: 2, bills: 2, session: "34", state: "ak" })
    expect(result.planPath).toMatch(/^openstates\/scraper-plans\/ak\/34\/ak-bills-[a-f0-9]{32}\/plan\.json$/)
    expect(request).toHaveBeenCalledWith(
      "https://www.akleg.gov/basis/Bill/Range/34",
      expect.objectContaining({ redirect: "error" })
    )
    expect(store.values.has(result.planPath.replace("plan.json", "range.html"))).toBe(true)
  })

  it("freezes both North Carolina chamber feeds as one inventory", async () => {
    const store = new Store()
    const request = vi.fn<typeof fetch>(
      async (input) =>
        new Response(String(input).endsWith("/H") ? feed("H1") : feed("S2"), {
          headers: { "content-type": "application/rss+xml" }
        })
    )
    const result = await acquireStateBillPlan(store, "nc", { fetch: request })
    expect(result).toMatchObject({ batches: 2, bills: 2, session: "2025", state: "nc" })
    expect(result.planPath).toMatch(/^openstates\/scraper-plans\/nc\/2025\/nc-bills-[a-f0-9]{32}\/plan\.json$/)
    expect(request).toHaveBeenCalledTimes(2)
    expect(store.values.has(result.planPath.replace("plan.json", "H.xml"))).toBe(true)
    expect(store.values.has(result.planPath.replace("plan.json", "S.xml"))).toBe(true)
  })

  it("creates one stable frozen cycle per UTC refresh date", async () => {
    const store = new Store()
    const request = vi.fn<typeof fetch>(
      async () => new Response(akHtml, { headers: { "content-type": "text/html; charset=utf-8" } })
    )
    const first = await acquireStateBillPlan(store, "ak", { fetch: request, refreshDate: "2026-09-17" })
    const replay = await acquireStateBillPlan(store, "ak", { fetch: request, refreshDate: "2026-09-17" })
    const nextDay = await acquireStateBillPlan(store, "ak", { fetch: request, refreshDate: "2026-09-18" })
    expect(replay.inventoryId).toBe(first.inventoryId)
    expect(nextDay.inventoryId).not.toBe(first.inventoryId)
    await expect(acquireStateBillPlan(store, "ak", { fetch: request, refreshDate: "09/18/2026" })).rejects.toThrow(
      "YYYY-MM-DD"
    )
  })

  it("rejects an unexpected publisher response before retaining a plan", async () => {
    await expect(
      acquireStateBillPlan(new Store(), "ak", {
        fetch: async () => new Response("not html", { headers: { "content-type": "application/json" } })
      })
    ).rejects.toThrow("unexpected content type")
  })
})
