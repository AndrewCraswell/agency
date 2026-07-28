import { describe, expect, it } from "vitest"
import { compareFingerprints } from "./fingerprint"
import type { StoreFingerprint } from "./fingerprint"

describe("compareFingerprints", () => {
  const synced: StoreFingerprint = {
    product: { count: 25, latestUpdate: new Date("2026-07-27T01:40:00.000Z") },
    collection: { count: 3, latestUpdate: new Date("2026-07-20T09:00:00.000Z") },
    blog: { count: 1, latestUpdate: new Date("2026-07-01T09:00:00.000Z") },
    article: { count: null, latestUpdate: new Date("2026-07-18T09:00:00.000Z") },
    page: { count: 2, latestUpdate: new Date("2026-06-30T09:00:00.000Z") }
  }

  function live(overrides: Partial<StoreFingerprint>): StoreFingerprint {
    return { ...synced, ...overrides }
  }

  it("reports an untouched store as current", () => {
    expect(compareFingerprints(live({}), synced)).toBe("current")
  })

  it("notices content added or removed", () => {
    expect(
      compareFingerprints(live({ product: { count: 26, latestUpdate: synced.product.latestUpdate } }), synced)
    ).toBe("changed")
    expect(compareFingerprints(live({ page: { count: 1, latestUpdate: synced.page.latestUpdate } }), synced)).toBe(
      "changed"
    )
  })

  it("notices content edited in place", () => {
    // An edit leaves the count alone, which is the whole reason the newest timestamp is carried alongside it.
    const edited = live({ article: { count: null, latestUpdate: new Date("2026-07-26T11:00:00.000Z") } })

    expect(compareFingerprints(edited, synced)).toBe("changed")
  })

  it("notices an item added in the same breath as one deleted", () => {
    // The count comes back to where it started, so only the timestamp is left to give the change away.
    const swapped = live({ product: { count: 25, latestUpdate: new Date("2026-07-27T02:00:00.000Z") } })

    expect(compareFingerprints(swapped, synced)).toBe("changed")
  })

  it("ignores the sub-second disagreement of a round trip through the database", () => {
    // Shopify reports milliseconds and Postgres keeps microseconds. Comparing them exactly would report a change on
    // every load of a store where nothing had happened.
    const jittered = live({ product: { count: 25, latestUpdate: new Date("2026-07-27T01:40:00.812Z") } })

    expect(compareFingerprints(jittered, synced)).toBe("current")
  })

  it("stays quiet about halves only one side can speak to", () => {
    // Shopify stops counting exactly past ten thousand rows and never counts articles at all. Treating a missing
    // count as a disagreement would leave a large store permanently accused of having changed.
    const partial = live({ product: { count: null, latestUpdate: synced.product.latestUpdate } })

    expect(compareFingerprints(partial, synced)).toBe("current")
  })
})
