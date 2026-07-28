import type { Candidate, Cluster, Detector, Verdict } from "../types"

/** The first result page, which is the only part of it a cluster can be said to be held on. */
export const TOP_TEN = 10

/** Where the second page starts, which is the first position a page is close enough to move from. */
export const PAGE_TWO_START = 11

/** Where the third page ends. Past here a position is not a near miss, it is a different page. */
export const PAGE_THREE_END = 30

/** Numbers inside evidence are written the way the rest of the English copy around them is. */
const demandFormat = new Intl.NumberFormat("en-US")

/** Writes a demand figure the way a sentence would. */
export function demand(value: number) {
  return demandFormat.format(Math.round(value))
}

/** Builds the finding, so that no detector can produce one without naming itself and its evidence. */
export function candidate(
  detector: Detector["name"],
  cluster: Cluster,
  verdict: Verdict,
  evidence: string[],
  scope: string | null = null
): Candidate {
  return { detector, clusterId: cluster.clusterId, verdict, scope, evidence }
}

/** Whether we are close enough that moving is a question of the page rather than of the store. */
export function isWithinStrikingDistance(position: number | null) {
  return position !== null && position >= PAGE_TWO_START && position <= PAGE_THREE_END
}

/** Whether we hold the cluster at all. */
export function holdsTopTen(cluster: Cluster) {
  return cluster.ourBestPosition !== null && cluster.ourBestPosition <= TOP_TEN
}

/** Whether the cluster carries enough demand for this store to be worth an article. */
export function clearsDemandFloor(cluster: Cluster, demandFloor: number) {
  return cluster.demand >= demandFloor
}

/** The competitor page that holds the cluster highest, which is the page a new article would have to displace. */
export function bestCompetitor(cluster: Cluster) {
  return cluster.competitorTopTen[0] ?? null
}

/** Distinct competitor domains holding the top ten anywhere in the cluster. */
export function competitorDomains(cluster: Cluster) {
  return [...new Set(cluster.competitorTopTen.map((placement) => placement.domain))]
}
