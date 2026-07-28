import { demandTrend } from "../demand-curve"
import type { Detector } from "../types"
import { candidate, clearsDemandFloor, demand } from "./support"

/**
 * How much the year has to have grown before growth is the reason to write.
 *
 * A quarter more demand than a year ago is a real move rather than the drift a small sample produces on its own.
 */
const YEARLY_GROWTH = 1.25

/**
 * The last quarter is allowed to be flat, but not to have turned over.
 *
 * A term whose year is up and whose last three months are falling is a term whose moment has passed, and the single
 * yearly figure that would sell it as rising cannot tell the two apart.
 */
const QUARTERLY_FLOOR = 0.95

/** More than this many competitors on the first page and the subject is established rather than opening up. */
const ESTABLISHED_COMPETITORS = 1

/**
 * Demand is growing, the growth has not already stopped, and nobody has taken the subject yet.
 *
 * Rising and merely large are different claims. This one is worth acting on early precisely because the competition
 * is thin, so a cluster several competitors already hold is left to the detectors that argue from position instead.
 */
export const risingDemand: Detector = {
  name: "rising_demand",
  verdict: "new_article",
  requiresAuthority: false,
  detect: (clusters, { calibration }) =>
    clusters.flatMap((cluster) => {
      if (!cluster.isReachable || !clearsDemandFloor(cluster, calibration.demandFloor)) {
        return []
      }
      if (cluster.competitorTopTen.length > ESTABLISHED_COMPETITORS) {
        return []
      }
      const trend = demandTrend(cluster.headMonthlySearches)
      if (trend.yearly === null || trend.quarterly === null) {
        return []
      }
      if (trend.yearly < YEARLY_GROWTH || trend.quarterly < QUARTERLY_FLOOR) {
        return []
      }
      return [
        candidate("rising_demand", cluster, "new_article", [
          `Demand for "${cluster.headKeyword}" is up ${formatGrowth(trend.yearly)} on a year ago.`,
          `The last quarter hasn't turned over, so the rise is still going.`,
          `${demand(cluster.demand)} searches a month, and no competitor has taken the first page yet.`
        ])
      ]
    })
}

/** Growth written as the percentage a sentence would use rather than as the ratio it is computed from. */
function formatGrowth(yearly: number) {
  return `${String(Math.round((yearly - 1) * 100))}%`
}
