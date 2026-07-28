import type { Detector } from "../types"
import { candidate, demand, PAGE_THREE_END, TOP_TEN } from "./support"

/**
 * How much larger the head has to be before missing it is worth a refresh.
 *
 * A page holding a term worth nine hundred searches and missing one worth a thousand has not left anything on the
 * table. The gap has to be big enough that the head is the reason to touch the page at all.
 */
const HEAD_DEMAND_MULTIPLE = 2

/**
 * We already hold the first page for a minor term while the term that carries the cluster passes us by.
 *
 * This is the strongest kind of refresh, because the search engine has already accepted our page as an answer for
 * part of the subject. The page does not need authority it does not have, it needs to cover the rest of the subject
 * it half covers, and the head term names exactly what is missing.
 */
export const partialCluster: Detector = {
  name: "partial_cluster",
  verdict: "refresh",
  requiresAuthority: false,
  detect: (clusters) =>
    clusters
      .filter((cluster) => cluster.ourBestPosition !== null && cluster.ourBestPosition <= TOP_TEN)
      .filter((cluster) => cluster.ourBestKeyword !== cluster.headKeyword)
      .filter((cluster) => cluster.ourHeadPosition === null || cluster.ourHeadPosition > PAGE_THREE_END)
      .filter((cluster) => {
        const held = cluster.keywordDemand[cluster.ourBestKeyword ?? ""] ?? 0
        return cluster.headDemand >= Math.max(1, held * HEAD_DEMAND_MULTIPLE)
      })
      .map((cluster) =>
        candidate(
          "partial_cluster",
          cluster,
          "refresh",
          [
            `We hold position ${String(cluster.ourBestPosition)} for "${cluster.ourBestKeyword ?? ""}".`,
            cluster.ourHeadPosition === null
              ? `We don't rank at all for "${cluster.headKeyword}", which carries ${demand(cluster.headDemand)} searches a month.`
              : `We sit at ${String(cluster.ourHeadPosition)} for "${cluster.headKeyword}", which carries ${demand(cluster.headDemand)} searches a month.`,
            "The page already ranks for part of this subject, so the work is coverage rather than authority."
          ],
          `Extend ${cluster.ourRankingUrls[0] ?? "the ranking page"} to answer "${cluster.headKeyword}" directly.`
        )
      )
}
