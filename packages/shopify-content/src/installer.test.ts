import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import {
  applyInstallation,
  planInstallation,
  type InstalledResource,
  type ResourceAdapter,
  type InstallationProgress
} from "./installer.ts"
import { parseManifest } from "./manifest.ts"

function fixture() {
  const store = new Map<string, InstalledResource>()
  const adapter: ResourceAdapter = {
    validate: (data) => {
      z.object({ handle: z.string() }).parse(data)
    },
    identity: (data) => String(data.handle),
    find: async (data) => store.get(String(data.handle)),
    create: vi.fn<ResourceAdapter["create"]>(async (data) => {
      const resource = { id: `new-${data.handle}`, state: data }
      store.set(String(data.handle), resource)
      return resource
    }),
    replace: vi.fn<NonNullable<ResourceAdapter["replace"]>>(async (existing, data) => {
      const resource = { ...existing, state: data }
      store.set(String(data.handle), resource)
      return resource
    })
  }
  return { store, adapter, registry: { page: adapter } }
}

const resources = [
  { key: "chart", kind: "page", data: { handle: "chart", guide: { $ref: "guide" } } },
  { key: "guide", kind: "page", data: { handle: "guide", title: "Guide" } }
]

describe("content installation", () => {
  it("reports dependency-ordered progress during planning and both apply passes", async () => {
    const { registry } = fixture()
    const progress = vi.fn<(event: InstallationProgress) => void>()
    const plan = await planInstallation(resources, registry, [], progress)
    expect(progress.mock.calls.map(([event]) => event)).toEqual([
      { phase: "plan", key: "guide", position: 1, total: 2 },
      { phase: "plan", key: "chart", position: 2, total: 2 }
    ])
    progress.mockClear()
    await applyInstallation(plan, registry, undefined, progress)
    expect(progress.mock.calls.map(([event]) => event)).toEqual([
      { phase: "check", key: "guide", position: 1, total: 2 },
      { phase: "check", key: "chart", position: 2, total: 2 },
      { phase: "apply", key: "guide", position: 1, total: 2 },
      { phase: "apply", key: "chart", position: 2, total: 2 }
    ])
  })

  it("plans without writes, resolves references on apply and is idempotent", async () => {
    const { registry, adapter, store } = fixture()
    const plan = await planInstallation(resources, registry)
    expect(adapter.create).not.toHaveBeenCalled()
    expect(plan.map((item) => item.action)).toEqual(["create", "create"])
    await applyInstallation(plan, registry)
    expect(store.get("chart")?.state).toEqual({ handle: "chart", guide: "new-guide" })
    const second = await planInstallation(resources, registry)
    expect(second.map((item) => item.action)).toEqual(["keep", "keep"])
    await applyInstallation(second, registry)
    expect(adapter.create).toHaveBeenCalledTimes(2)
  })

  it("preserves merchant edits unless a specific replacement is requested", async () => {
    const { registry, adapter, store } = fixture()
    store.set("guide", { id: "original", state: { title: "Merchant text" } })
    const plan = await planInstallation(resources, registry, ["guide"])
    expect(plan[0]?.action).toBe("replace")
    await applyInstallation(plan, registry)
    expect(adapter.replace).toHaveBeenCalledOnce()
    expect(store.get("chart")?.state).toEqual({ handle: "chart", guide: "original" })
  })

  it("blocks all writes on schema conflicts and unsupported replacements", async () => {
    const { registry, adapter, store } = fixture()
    store.set("guide", { id: "original", state: {} })
    adapter.conflict = () => "Wrong field type"
    const plan = await planInstallation(resources, registry)
    await expect(applyInstallation(plan, registry)).rejects.toThrow("Resolve conflicts")
    expect(adapter.create).not.toHaveBeenCalled()
    delete adapter.conflict
    delete adapter.replace
    expect((await planInstallation(resources, registry, ["guide"]))[0]?.action).toBe("conflict")
  })

  it("rejects duplicate identities, unknown kinds and replacement keys before writes", async () => {
    const { registry } = fixture()
    await expect(planInstallation([resources[1]!, { ...resources[1]!, key: "duplicate" }], registry)).rejects.toThrow(
      "Duplicate"
    )
    await expect(planInstallation([{ key: "bad", kind: "bad", data: {} }], registry)).rejects.toThrow("Unsupported")
    await expect(planInstallation(resources, registry, ["bad"])).rejects.toThrow("replacement key")
  })

  it("refuses a stale plan before writing anything", async () => {
    const { registry, store, adapter } = fixture()
    const plan = await planInstallation(resources, registry)
    store.set("chart", { id: "someone-else", state: {} })
    await expect(applyInstallation(plan, registry)).rejects.toThrow("changed since planning")
    expect(adapter.create).not.toHaveBeenCalled()
  })

  it("retains partial progress and identifies the failed resource", async () => {
    const { registry, store, adapter } = fixture()
    const create = adapter.create
    adapter.create = async (data) => {
      if (data.handle === "chart") {
        throw new Error("API unavailable")
      }
      return create(data)
    }
    await expect(applyInstallation(await planInstallation(resources, registry), registry)).rejects.toThrow(
      "stopped at chart"
    )
    expect(store.has("guide")).toBe(true)
  })
})

describe("portable manifests", () => {
  it("accepts references but rejects embedded store IDs and malformed references", () => {
    expect(parseManifest({ name: "sizing", resources }).resources[0]?.key).toBe("guide")
    for (const data of [{ id: "gid://shopify/Product/123" }, { item: { $ref: "guide", field: "bogus" } }]) {
      expect(() => parseManifest({ name: "sizing", resources: [{ key: "bad", kind: "page", data }] })).toThrow(
        z.ZodError
      )
    }
  })
})
