import { describe, expect, it } from "vitest"
import { demandTrend, monthName, orderMonths, seasonalPeak } from "./demand-curve"

/** Twelve months of 2025, each carrying whatever the caller supplies for it. */
function months(volumes: number[]) {
  return volumes.map((searchVolume, index) => ({ year: 2025, month: index + 1, searchVolume }))
}

describe("orderMonths", () => {
  it("puts the provider's months in calendar order", () => {
    const ordered = orderMonths([
      { year: 2025, month: 3, searchVolume: 30 },
      { year: 2024, month: 12, searchVolume: 10 },
      { year: 2025, month: 1, searchVolume: 20 }
    ])

    expect(ordered.map((entry) => entry.searchVolume)).toEqual([10, 20, 30])
  })

  it("keeps only the most recent year, because a season is read from one", () => {
    expect(orderMonths(months(Array.from({ length: 18 }, (_unused, index) => index)))).toHaveLength(12)
  })

  it("treats a term with no history as having none rather than as having zero", () => {
    expect(orderMonths(null)).toEqual([])
  })
})

describe("demandTrend", () => {
  it("reports nothing at all when the year is incomplete", () => {
    expect(demandTrend(months([100, 100, 100]))).toEqual({ yearly: null, quarterly: null })
  })

  it("measures the last quarter against the first and against the one before it", () => {
    const trend = demandTrend(months([100, 100, 100, 100, 100, 100, 150, 150, 150, 200, 200, 200]))

    expect(trend.yearly).toBe(2)
    expect(trend.quarterly).toBeCloseTo(200 / 150)
  })

  it("separates a year that is up from a quarter that has turned over", () => {
    const trend = demandTrend(months([100, 100, 100, 100, 100, 100, 300, 300, 300, 200, 200, 200]))

    expect(trend.yearly).toBe(2)
    expect(trend.quarterly).toBeLessThan(1)
  })
})

describe("seasonalPeak", () => {
  it("measures the peak against the year's median rather than its mean", () => {
    const peak = seasonalPeak(
      months([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 900]),
      new Date("2026-01-10T00:00:00Z")
    )

    expect(peak?.month).toBe(12)
    expect(peak?.ratio).toBe(9)
  })

  it("counts the lead time forward from the current month", () => {
    const peak = seasonalPeak(
      months([100, 100, 100, 100, 100, 100, 900, 100, 100, 100, 100, 100]),
      new Date("2026-03-01T00:00:00Z")
    )

    expect(peak?.monthsAhead).toBe(4)
  })

  it("says nothing about a season it cannot see a whole year of", () => {
    expect(seasonalPeak(months([100, 900]), new Date("2026-01-10T00:00:00Z"))).toBeNull()
  })
})

describe("monthName", () => {
  it("names the month in words a merchant reads rather than in an index", () => {
    expect(monthName(11, "en-US")).toBe("November")
  })
})
