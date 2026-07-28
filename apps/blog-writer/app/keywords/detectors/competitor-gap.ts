import type { Detector } from "../types"
import { bestCompetitor, candidate, clearsDemandFloor, competitorDomains, demand } from "./support"

/**
 * A competitor holds the first page for a search we do not appear in at all.
 *
 * The absence has to be total. Ranking at ninety is still ranking, and calling that a gap would propose a new article
 * where the honest answer is to improve the page that already exists. Two competitors in the top ten is a materially
 * stronger claim than one, because one competitor ranking can be an accident of their authority and two is a pattern,
 * so the count travels with the finding rather than being flattened into it.
 */
export const competitorGap: Detector = {
  name: "competitor_gap",
  verdict: "new_article",
  requiresAuthority: false,
  detect: (clusters, { calibration }) =>
    clusters
      .filter((cluster) => cluster.isReachable)
      .filter((cluster) => cluster.ourBestPosition === null)
      .filter((cluster) => cluster.competitorTopTen.length > 0)
      .filter((cluster) => clearsDemandFloor(cluster, calibration.demandFloor))
      .map((cluster) => {
        const domains = competitorDomains(cluster)
        const leader = bestCompetitor(cluster)
        return candidate("competitor_gap", cluster, "new_article", [
          `We don't rank anywhere for "${cluster.headKeyword}" or the ${String(cluster.keywords.length)} terms around it.`,
          leader === null
            ? `${String(domains.length)} competitors hold the first page here.`
            : `${leader.domain} holds position ${String(leader.position)} for "${leader.keyword}".`,
          domains.length > 1
            ? `${String(domains.length)} of your competitors rank on the first page, so this isn't one store's luck.`
            : `${demand(cluster.demand)} searches a month are going to someone else.`
        ])
      })
}
