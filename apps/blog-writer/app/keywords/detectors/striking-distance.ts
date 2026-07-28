import type { Detector } from "../types"
import { candidate, clearsDemandFloor, demand, isWithinStrikingDistance } from "./support"

/**
 * A page of ours already ranks on the second or third page of a search worth having.
 *
 * This is the cheapest recommendation the product can make, because the article exists, the search engine has already
 * accepted it as an answer, and the distance left is editorial rather than structural. It is deliberately restricted
 * to clusters an article can rank in at all: a page sitting at fourteen underneath ten shop pages is not close to
 * anything, it is in the wrong kind of result.
 */
export const strikingDistance: Detector = {
  name: "striking_distance",
  verdict: "refresh",
  requiresAuthority: false,
  detect: (clusters, { calibration }) =>
    clusters
      .filter((cluster) => cluster.isReachable)
      .filter((cluster) => clearsDemandFloor(cluster, calibration.demandFloor))
      .filter((cluster) => isWithinStrikingDistance(cluster.ourBestPosition))
      .map((cluster) =>
        candidate(
          "striking_distance",
          cluster,
          "refresh",
          [
            `We rank ${String(cluster.ourBestPosition)} for "${cluster.ourBestKeyword ?? cluster.headKeyword}".`,
            `The cluster carries ${demand(cluster.demand)} searches a month across ${String(cluster.keywords.length)} terms.`,
            cluster.hasEditorialProof
              ? "An article already holds the first page here."
              : "The search reads as one an article can answer."
          ],
          `Expand ${cluster.ourRankingUrls[0] ?? "the ranking page"} to cover ${cluster.keywords.slice(0, 5).join(", ")}.`
        )
      )
}
