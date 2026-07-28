import type { Detector } from "../types"
import { candidate, holdsTopTen } from "./support"

/**
 * We already hold the first page here with the article that was written for it.
 *
 * Both halves matter. Holding the position by accident, with a page nobody aimed at the search, is a different and
 * more fragile situation than holding it deliberately, and only the second is settled. Saying so keeps the cluster
 * out of the writing list without hiding it: the row remains queryable with the rule that suppressed it, so "why
 * isn't this in my list" has an answer other than silence.
 */
export const adequatelyCovered: Detector = {
  name: "adequately_covered",
  verdict: "no_action",
  requiresAuthority: false,
  detect: (clusters, { articleTargets }) =>
    clusters.flatMap((cluster) => {
      if (!holdsTopTen(cluster)) {
        return []
      }
      const target = articleTargets.find((entry) => cluster.keywords.includes(entry.keyword))
      if (target === undefined) {
        return []
      }
      return [
        candidate("adequately_covered", cluster, "no_action", [
          `We hold position ${String(cluster.ourBestPosition)} for "${cluster.ourBestKeyword ?? cluster.headKeyword}".`,
          `An article of ours already targets "${target.keyword}".`,
          "There's nothing to write here. Protect it instead."
        ])
      ]
    })
}
