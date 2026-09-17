import invariant from "tiny-invariant"
import { describe, expect, it } from "vitest"
import { createPresentationRecords } from "./compositionRecords"
import { createResultStore } from "./resultStore"

describe("run-owned presentation records", () => {
  it("resolves only current-run results owned by the same session including later-page records", () => {
    const store = createResultStore()
    const page = store.create(
      "owner",
      "search_bills",
      {
        items: Array.from({ length: 10 }, (_, index) => ({ id: `bill:${index}`, title: `Bill ${index}` }))
      },
      "education",
      async () => ({ items: [] })
    )
    invariant(page)
    const run = createPresentationRecords("owner", store)
    expect(() => run.resolve({ resultId: page.id, recordId: "bill:0" })).toThrow(/not retrieved/)
    run.register(page)
    const record = run.resolve({ resultId: page.id, recordId: "bill:9" })
    expect(record.title).toBe("Bill 9")
    record.title = "Changed client copy"
    expect(run.resolve({ resultId: page.id, recordId: "bill:9" }).title).toBe("Bill 9")
    expect(() => run.resolve({ resultId: page.id, recordId: "bill:unknown" })).toThrow(/not in this result/)
    expect(() => createPresentationRecords("owner", store).resolve({ resultId: page.id, recordId: "bill:0" })).toThrow(
      /not retrieved/
    )
    const foreign = createPresentationRecords("foreign", store)
    foreign.register(page)
    expect(() => foreign.resolve({ resultId: page.id, recordId: "bill:0" })).toThrow(/expired/)
  })

  it("reauthorizes expiry when a model selects a record", () => {
    let now = 0
    const store = createResultStore(() => now)
    const page = store.create(
      "owner",
      "search_bills",
      { items: [{ id: "bill:1", title: "Bill" }] },
      undefined,
      async () => ({ items: [] })
    )
    invariant(page)
    const run = createPresentationRecords("owner", store)
    run.register(page)
    now = 15 * 60 * 1000
    expect(() => run.resolve({ resultId: page.id, recordId: "bill:1" })).toThrow(/expired/)
  })
})
