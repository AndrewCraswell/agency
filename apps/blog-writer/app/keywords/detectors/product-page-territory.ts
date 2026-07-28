import type { Detector } from "../types"
import { candidate } from "./support"

/** The reading that says a search wants to buy rather than to understand. */
const TRANSACTIONAL = "transactional"

/** The reading that keeps a search open to an article even when the main reading is not. */
const INFORMATIONAL = "informational"

/**
 * The result page is a shelf, and an article cannot displace a shelf by being better written.
 *
 * All three conditions are required. Transactional intent alone is not enough, because the provider reports secondary
 * readings and a term that also reads as informational is not closed to an article. Product blocks alone are not
 * enough either, because they appear beside plenty of searches an article wins. And a tracked domain holding the top
 * ten with an article is direct evidence against the whole conclusion, so it overrules the other two.
 *
 * The answer names the page that should be pointed here instead, because the demand is real even though the article
 * is not the way to reach it.
 */
export const productPageTerritory: Detector = {
  name: "product_page_territory",
  verdict: "no_action",
  requiresAuthority: false,
  detect: (clusters) =>
    clusters
      .filter((cluster) => cluster.mainIntent === TRANSACTIONAL)
      .filter((cluster) => !cluster.intents.includes(INFORMATIONAL))
      .filter((cluster) => cluster.hasProductBlocks)
      .filter((cluster) => !cluster.hasEditorialProof)
      .map((cluster) =>
        candidate("product_page_territory", cluster, "no_action", [
          `"${cluster.headKeyword}" is a search to buy, not a search to read.`,
          "The result page carries product blocks and no tracked domain wins it with an article.",
          "Point a collection or product page at this instead of writing for it."
        ])
      )
}
