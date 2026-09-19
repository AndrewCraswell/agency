import { describe, expect, it, vi } from "vitest"
import { acquireFoundationCommitteeInventory, foundationSourcesUnchanged } from "./foundation-refresh.js"

function memoryStore() {
  const values = new Map<string, Uint8Array>()
  return {
    exists: async (path: string) => values.has(path),
    put: async (path: string, bytes: Uint8Array) => {
      values.set(path, bytes)
      return true
    },
    read: async (path: string) => {
      const bytes = values.get(path)
      if (!bytes) throw new Error("missing")
      return bytes
    }
  }
}
const xml =
  "<ArrayOfCommittee><Committee><Id>34080</Id><Agency>Senate</Agency><Acronym>LGV</Acronym></Committee></ArrayOfCommittee>"
describe("foundation supplementary source refresh", () => {
  it("does not fetch or change the existing NC/AK source gates", async () => {
    const fetcher = vi.fn<typeof fetch>()
    for (const state of ["ak", "nc"] as const)
      expect(await acquireFoundationCommitteeInventory(state, memoryStore(), fetcher)).toBeUndefined()
    expect(fetcher).not.toHaveBeenCalled()
    expect(foundationSourcesUnchanged("rev", { revision: "rev" }, { revision: "rev" }, undefined)).toBe(true)
    expect(foundationSourcesUnchanged("rev", undefined, { revision: "rev" }, undefined)).toBe(false)
  })
  it("retains WA inventory and detects changes independently of the people revision", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(xml))
    const inventory = await acquireFoundationCommitteeInventory("wa", memoryStore(), fetcher)
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("biennium=2025-26"),
      expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) })
    )
    const people = { revision: "rev" }
    const committee = { revision: "rev", officialInventory: { sha256: inventory?.inventory.sha256 } }
    expect(foundationSourcesUnchanged("rev", people, committee, inventory)).toBe(true)
    expect(foundationSourcesUnchanged("new-rev", people, committee, inventory)).toBe(false)
    expect(foundationSourcesUnchanged("rev", people, people, inventory)).toBe(false)
    const changed = await acquireFoundationCommitteeInventory(
      "wa",
      memoryStore(),
      async () => new Response(xml.replace("LGV", "LGLT"))
    )
    expect(foundationSourcesUnchanged("rev", people, committee, changed)).toBe(false)
  })
  it("fails before publication on HTTP errors, oversized bodies or invalid XML", async () => {
    for (const response of [
      new Response("failure", { status: 503 }),
      new Response("broken"),
      new Response(xml, { headers: { "content-length": "3000000" } })
    ]) {
      const store = memoryStore()
      const put = vi.spyOn(store, "put")
      await expect(acquireFoundationCommitteeInventory("wa", store, async () => response)).rejects.toThrow()
      expect(put).not.toHaveBeenCalled()
    }
  })
})
