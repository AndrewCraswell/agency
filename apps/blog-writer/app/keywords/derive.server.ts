import { readDerivationInputs, saveDerivedLayer } from "../persistence/opportunity-repository.server"
import { calibrate } from "./calibration"
import { catalogueTerms } from "./catalogue"
import { buildClusters } from "./clusters"
import { runDetectors } from "./detectors"
import { rankOpportunities } from "./opportunities"
import type { TrackedObservation } from "./types"

/**
 * Turns one import's observations into the list a merchant reads.
 *
 * It runs after the provider requests have finished and spends nothing itself, which is why it is safe to re-run: a
 * change to how clusters are formed or to what a rule concludes is replayed against evidence already bought rather
 * than paid for again.
 */
export async function deriveOpportunities(tenantId: string, importId: string, now: Date = new Date()) {
  const inputs = await readDerivationInputs(tenantId, importId)
  const observations: TrackedObservation[] = inputs.observations.map((row) => ({
    keyword: row.keyword,
    domain: row.domain,
    isOwnDomain: row.isOwnDomain,
    rankAbsolute: row.rankAbsolute,
    rankGroup: row.rankGroup,
    rankingUrl: row.rankingUrl,
    previousRankAbsolute: row.previousRankAbsolute,
    searchVolume: row.searchVolume,
    monthlySearches: row.monthlySearches,
    difficulty: row.difficulty,
    mainIntent: row.mainIntent,
    foreignIntents: row.foreignIntents,
    serpItemTypes: row.serpItemTypes,
    serpAverageDomainRank: row.serpAverageDomainRank,
    serpResultCount: row.serpResultCount,
    estimatedTrafficVolume: row.estimatedTrafficVolume,
    fieldFreshness: row.fieldFreshness
  }))

  const clusters = buildClusters(observations)
  const calibration = calibrate(clusters, inputs.ourDomainRank)
  const context = {
    calibration,
    catalogueTerms: catalogueTerms(inputs.catalogueTitles),
    articleTargets: inputs.articleTargets,
    now
  }
  const { opportunities, suppressed } = rankOpportunities(runDetectors(clusters, context), clusters, context)

  await saveDerivedLayer({ tenantId, importId, calibration, clusters, opportunities, suppressed })

  return { clusterCount: clusters.length, opportunityCount: opportunities.length, suppressedCount: suppressed.length }
}
