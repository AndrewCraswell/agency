import { describe, expect, it, vi } from "vitest"
import { acquireFoundationCommitteeInventory, foundationSourcesUnchanged } from "./foundation-refresh.js"
import { peopleRoleReviewDigest } from "./people-role-review.js"

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
    const people = { revision: "rev", reviewDigest: peopleRoleReviewDigest("nc", "rev") }
    expect(foundationSourcesUnchanged("nc", "rev", people, { revision: "rev" }, undefined)).toBe(true)
    expect(foundationSourcesUnchanged("nc", "rev", undefined, { revision: "rev" }, undefined)).toBe(false)
  })
  it("retains WA inventory and detects changes independently of the people revision", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(xml))
    const inventory = await acquireFoundationCommitteeInventory("wa", memoryStore(), fetcher)
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("biennium=2025-26"),
      expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) })
    )
    const people = { revision: "rev", reviewDigest: peopleRoleReviewDigest("wa", "rev") }
    const committee = { revision: "rev", officialInventory: { sha256: inventory?.inventory.sha256 } }
    expect(foundationSourcesUnchanged("wa", "rev", people, committee, inventory)).toBe(true)
    expect(foundationSourcesUnchanged("wa", "new-rev", people, committee, inventory)).toBe(false)
    expect(foundationSourcesUnchanged("wa", "rev", people, people, inventory)).toBe(false)
    const changed = await acquireFoundationCommitteeInventory(
      "wa",
      memoryStore(),
      async () => new Response(xml.replace("LGV", "LGLT"))
    )
    expect(foundationSourcesUnchanged("wa", "rev", people, committee, changed)).toBe(false)
  })
  it("refreshes missing or changed review fingerprints even when upstream sources are unchanged", () => {
    const revision = "677c6d0a566ad9bd62b6324e502af76acc3d22f3"
    const committee = { revision }
    const digest = peopleRoleReviewDigest("wa", revision)
    expect(foundationSourcesUnchanged("wa", revision, { revision }, committee, undefined)).toBe(false)
    expect(foundationSourcesUnchanged("wa", revision, { revision, reviewDigest: "stale" }, committee, undefined)).toBe(
      false
    )
    expect(foundationSourcesUnchanged("wa", revision, { revision, reviewDigest: digest }, committee, undefined)).toBe(
      true
    )
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
