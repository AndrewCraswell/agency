import type { Detector } from "../types"
import { candidate, demand } from "./support"

/**
 * How far a position has to fall before the fall is the story.
 *
 * Results move a place or two on their own. Five is far enough that something changed, either on our page or on the
 * ones around it.
 */
const MEANINGFUL_FALL = 5

/**
 * One of our pages has slipped on a term that is still being searched for.
 *
 * The demand condition is what separates our page getting worse from the subject getting smaller, and only the first
 * of those is worth a refresh. The interval belongs to the provider rather than to us: the previous rank is from
 * whenever it last checked that result page, not from our last import, and the wording says so rather than implying
 * a measurement we did not take.
 */
export const decay: Detector = {
  name: "decay",
  verdict: "refresh",
  requiresAuthority: false,
  detect: (clusters, { calibration }) =>
    clusters.flatMap((cluster) => {
      const decline = cluster.largestOurDecline
      if (decline === null || decline.to - decline.from < MEANINGFUL_FALL) {
        return []
      }
      if (decline.demand < calibration.demandFloor) {
        return []
      }
      return [
        candidate(
          "decay",
          cluster,
          "refresh",
          [
            `We've fallen from ${String(decline.from)} to ${String(decline.to)} on "${decline.keyword}".`,
            `That term still carries ${demand(decline.demand)} searches a month, so the subject hasn't shrunk, our page has slipped.`,
            "The earlier position is from the provider's last check of that result page rather than from our last collection."
          ],
          `Rebuild ${cluster.ourRankingUrls[0] ?? "the ranking page"} against "${decline.keyword}".`
        )
      ]
    })
}
