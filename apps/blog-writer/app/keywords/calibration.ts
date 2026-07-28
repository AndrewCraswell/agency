import type { Calibration, Cluster } from "./types"

/** The first page, which is the only part of the result page a cluster can be said to be held on. */
const TOP_TEN = 10

/**
 * How many clusters we hold before our own results can set the bar.
 *
 * A percentile taken over one or two clusters is that cluster's number wearing a percentile's name. Below this the
 * store has not been shown to be able to do anything repeatably, and the bar comes from the competition instead.
 */
const MINIMUM_WON_CLUSTERS = 5

/** How many measured result pages are needed before their distribution says anything about the market. */
const MINIMUM_CALIBRATION_CLUSTERS = 10

/**
 * The share of our won clusters the ceiling has to cover.
 *
 * Taking the strongest result page we have ever beaten would calibrate the whole store against one lucky page, and
 * taking the median would refuse half of what we have already proven we can do.
 */
const WON_CEILING_PERCENTILE = 0.9

/**
 * Where in the market's own distribution the bar sits when we have won nothing.
 *
 * A store with no rankings has to start somewhere, and the weakest quarter of the result pages its competitors are
 * measured on is the part of the market where a new page has a chance. It is deliberately pessimistic: the cost of
 * being wrong here is a merchant writing an article that cannot rank.
 */
const COMPETITOR_FLOOR_PERCENTILE = 0.25

/**
 * The share of the tenant's clusters that fall below the demand floor.
 *
 * The floor is a percentile of this tenant's own distribution rather than a fixed number of searches, because the
 * demand that makes an article worth writing for a national retailer would leave a specialist store with nothing to
 * write about at all.
 */
const DEMAND_FLOOR_PERCENTILE = 0.6

/**
 * The demand no percentile is allowed to fall below.
 *
 * A store whose entire measured market is tiny would otherwise calibrate itself into recommending single-search
 * phrases, and an article nobody searches for is not worth writing however favourably it compares to its neighbours.
 */
const ABSOLUTE_DEMAND_FLOOR = 50

/**
 * Works out what this store can be measured against, using only what this store was measured at.
 *
 * Every bar the detectors use is derived here, once, so that a threshold cannot be quietly hard-coded inside a rule.
 * The confidence field is the important output: it says whether an authority ceiling means anything at all, and the
 * registry uses it to skip the rules that would otherwise be guessing.
 */
export function calibrate(clusters: Cluster[], ourDomainRank: number | null): Calibration {
  const wonClusters = clusters.filter(
    (cluster) => cluster.ourBestPosition !== null && cluster.ourBestPosition <= TOP_TEN
  )
  const wonAuthorities = wonClusters.flatMap((cluster) =>
    cluster.serpAverageDomainRank === null ? [] : [cluster.serpAverageDomainRank]
  )
  const marketAuthorities = clusters.flatMap((cluster) =>
    cluster.serpAverageDomainRank === null ? [] : [cluster.serpAverageDomainRank]
  )

  const authority = readAuthorityCeiling(wonClusters.length, wonAuthorities, marketAuthorities)

  return {
    ourDomainRank,
    demandFloor: Math.max(
      ABSOLUTE_DEMAND_FLOOR,
      percentile(
        clusters.map((cluster) => cluster.demand),
        DEMAND_FLOOR_PERCENTILE
      ) ?? ABSOLUTE_DEMAND_FLOOR
    ),
    wonAuthorityCeiling: authority.ceiling,
    wonDifficultyCeiling: percentile(
      wonClusters.flatMap((cluster) => (cluster.difficulty === null ? [] : [cluster.difficulty])),
      WON_CEILING_PERCENTILE
    ),
    authorityConfidence: authority.confidence,
    clusterCount: clusters.length
  }
}

/**
 * The strongest result page we can claim to be able to hold, and how much that claim is worth.
 *
 * Three tiers, and the third one is the point. A store that ranks for nothing has no evidence about its own reach,
 * and inventing a ceiling for it would turn every authority-dependent rule into a coin toss dressed as a measurement.
 */
function readAuthorityCeiling(
  wonClusterCount: number,
  wonAuthorities: number[],
  marketAuthorities: number[]
): { ceiling: number | null; confidence: Calibration["authorityConfidence"] } {
  if (wonClusterCount >= MINIMUM_WON_CLUSTERS && wonAuthorities.length >= MINIMUM_WON_CLUSTERS) {
    return { ceiling: percentile(wonAuthorities, WON_CEILING_PERCENTILE), confidence: "own_wins" }
  }
  if (marketAuthorities.length >= MINIMUM_CALIBRATION_CLUSTERS) {
    return { ceiling: percentile(marketAuthorities, COMPETITOR_FLOOR_PERCENTILE), confidence: "competitor_floor" }
  }
  return { ceiling: null, confidence: "none" }
}

/** The nearest-rank percentile, which returns a value that was actually measured rather than an interpolation. */
export function percentile(values: number[], fraction: number) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[index] ?? null
}
