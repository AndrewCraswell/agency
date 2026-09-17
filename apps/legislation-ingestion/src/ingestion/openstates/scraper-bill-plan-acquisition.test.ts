import { describe, expect, it, vi } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
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

describe("acquireStateBillPlan", () => {
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

  it("rejects an unexpected publisher response before retaining a plan", async () => {
    await expect(
      acquireStateBillPlan(new Store(), "ak", {
        fetch: async () => new Response("not html", { headers: { "content-type": "application/json" } })
      })
    ).rejects.toThrow("unexpected content type")
  })
})
