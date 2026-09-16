import { describe, expect, it, vi } from "vitest"
import { ResultExpiredError } from "../lib/entityResults"
import { createResultStore } from "./resultStore"

describe("result recovery", () => {
  function setup() {
    let time = 0
    const store = createResultStore(() => time)
    const load = vi.fn<() => Promise<{ items: { id: string; title: string }[] }>>(async () => ({
      items: [{ id: "bill:2", title: "Second bill" }]
    }))
    const first = store.create(
      "owner",
      "search_bills",
      { items: [{ id: "bill:1", title: "First bill" }], nextCursor: "next" },
      undefined,
      load
    )
    if (!first) {
      throw new Error("Expected a result snapshot")
    }
    return {
      store,
      first,
      load,
      expire: () => {
        time = 900000
      }
    }
  }

  it("rejects expired and foreign snapshots without fetching", async () => {
    const { store, first, load, expire } = setup()
    await expect(store.page("other", first.id, 1, new AbortController().signal)).rejects.toBeInstanceOf(
      ResultExpiredError
    )
    expire()
    await expect(store.page("owner", first.id, 0, new AbortController().signal)).rejects.toBeInstanceOf(
      ResultExpiredError
    )
    expect(load).not.toHaveBeenCalled()
  })

  it("retains the loaded page after a temporary failure and permits retry", async () => {
    const { store, first, load } = setup()
    const failure = new Error("Temporary dependency failure")
    load.mockRejectedValueOnce(failure)
    await expect(store.page("owner", first.id, 1, new AbortController().signal)).rejects.toBe(failure)
    await expect(store.page("owner", first.id, 0, new AbortController().signal)).resolves.toEqual(first)
    const next = await store.page("owner", first.id, 1, new AbortController().signal)
    expect(next.items.map((record) => record.id)).toEqual(["bill:2"])
    expect(next.hasNext).toBe(false)
    expect(next.hasPrevious).toBe(true)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("does not return cached results for an aborted request", async () => {
    const { store, first, load } = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(store.page("owner", first.id, 0, controller.signal)).rejects.toMatchObject({ name: "AbortError" })
    expect(load).not.toHaveBeenCalled()
  })
})
