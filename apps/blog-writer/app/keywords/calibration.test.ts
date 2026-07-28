import { describe, expect, it } from "vitest"
import { calibrate, percentile } from "./calibration"
import { cluster as buildCluster } from "./fixtures/clusters"

/** A cluster reduced to the four fields calibration reads, so a fixture cannot accidentally depend on the rest. */
function cluster(overrides: {
  demand: number
  ourBestPosition?: number | null
  authority?: number | null
  difficulty?: number | null
}) {
  return buildCluster({
    clusterId: `cluster-${overrides.demand}-${overrides.ourBestPosition ?? "none"}-${overrides.authority ?? "none"}`,
    headDemand: overrides.demand,
    demand: overrides.demand,
    ourBestPosition: overrides.ourBestPosition ?? null,
    difficulty: overrides.difficulty ?? null,
    serpAverageDomainRank: overrides.authority ?? null,
    mainIntent: null
  })
}

describe("calibrate", () => {
  it("takes the ceiling from our own results once we hold enough of them", () => {
    const clusters = [
      ...[100, 200, 300, 400, 500].map((authority, index) =>
        cluster({ demand: 1000 + index, ourBestPosition: 3, authority, difficulty: 20 + index })
      ),
      cluster({ demand: 900, ourBestPosition: 40, authority: 800 })
    ]

    const calibration = calibrate(clusters, 210)

    expect(calibration.authorityConfidence).toBe("own_wins")
    expect(calibration.wonAuthorityCeiling).toBe(500)
    expect(calibration.wonDifficultyCeiling).toBe(24)
    expect(calibration.ourDomainRank).toBe(210)
    expect(calibration.clusterCount).toBe(6)
  })

  it("falls back to the weak end of the market when we hold too little to measure", () => {
    const clusters = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((authority) =>
      cluster({ demand: 500, authority })
    )

    const calibration = calibrate(clusters, null)

    expect(calibration.authorityConfidence).toBe("competitor_floor")
    expect(calibration.wonAuthorityCeiling).toBe(300)
  })

  it("refuses to invent a ceiling for a store with nothing to calibrate against", () => {
    const calibration = calibrate([cluster({ demand: 500 }), cluster({ demand: 400, authority: 200 })], null)

    expect(calibration.authorityConfidence).toBe("none")
    expect(calibration.wonAuthorityCeiling).toBeNull()
    expect(calibration.wonDifficultyCeiling).toBeNull()
  })

  it("sets the demand floor from this store's own distribution", () => {
    const calibration = calibrate(
      [100, 200, 300, 400, 500].map((demand) => cluster({ demand })),
      null
    )

    expect(calibration.demandFloor).toBe(300)
  })

  it("will not let a small market push the floor below what an article is worth", () => {
    const calibration = calibrate(
      [1, 2, 3, 4, 5].map((demand) => cluster({ demand })),
      null
    )

    expect(calibration.demandFloor).toBe(50)
  })
})

describe("percentile", () => {
  it("returns a value that was measured rather than one between two of them", () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(20)
    expect(percentile([10, 20, 30, 40], 0.9)).toBe(40)
    expect(percentile([], 0.5)).toBeNull()
  })
})
