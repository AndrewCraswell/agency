import type { Cluster, DetectorContext, Detector } from "../types"
import { candidate } from "./support"

/**
 * Two of our own pages are competing for one search, or the wrong one of ours is answering it.
 *
 * The two cases need different words. A split is two pages dividing the evidence a search engine uses to pick one of
 * them, and the fix is to consolidate. A misdirect is one page ranking where a different page was written to rank,
 * and the fix is to retarget. Neither is answered by writing anything new, which is the point of having the rule: a
 * blog tool that responds to every finding with another article makes this problem worse every time it runs.
 */
export const cannibalization: Detector = {
  name: "cannibalization",
  verdict: "no_action",
  requiresAuthority: false,
  detect: (clusters, context) =>
    clusters.flatMap((cluster) => {
      if (cluster.ourRankingUrls.length > 1) {
        return [
          candidate("cannibalization", cluster, "no_action", [
            `Two of our pages rank for "${cluster.headKeyword}": ${cluster.ourRankingUrls.slice(0, 2).join(" and ")}.`,
            "They're splitting the evidence a search engine uses to choose between them.",
            "Consolidate them into one page rather than writing a third."
          ])
        ]
      }
      const misdirect = findMisdirect(cluster, context.articleTargets)
      if (misdirect === null) {
        return []
      }
      return [
        candidate("cannibalization", cluster, "no_action", [
          `"${misdirect.keyword}" was written for ${misdirect.intended ?? "another page"}.`,
          `${misdirect.actual} is the page ranking for it instead.`,
          "Retarget the article rather than writing a second one for the same search."
        ])
      ]
    })
}

/** A term one of our articles was written for, where a different page of ours is the one ranking. */
function findMisdirect(cluster: Cluster, articleTargets: DetectorContext["articleTargets"]) {
  const [actual] = cluster.ourRankingUrls
  if (actual === undefined) {
    return null
  }
  const target = articleTargets.find(
    (entry) => cluster.keywords.includes(entry.keyword) && entry.url !== null && entry.url !== actual
  )
  if (target === undefined) {
    return null
  }
  return { keyword: target.keyword, intended: target.url, actual }
}
