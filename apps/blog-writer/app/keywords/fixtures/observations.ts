import type { TrackedObservation } from "../types"

/**
 * One measured row, with everything the provider is allowed to omit already omitted.
 *
 * The derived layer has to behave on rows where demand, difficulty, intent, and authority are all missing, because
 * that is what a real payload looks like. Starting every fixture from a complete row would test a payload the
 * provider never sends.
 */
export function observation(overrides: Partial<TrackedObservation> & Pick<TrackedObservation, "keyword" | "domain">) {
  return {
    rankAbsolute: 1,
    rankGroup: null,
    rankingUrl: null,
    previousRankAbsolute: null,
    searchVolume: null,
    monthlySearches: null,
    difficulty: null,
    mainIntent: null,
    foreignIntents: [],
    serpItemTypes: [],
    serpAverageDomainRank: null,
    serpResultCount: null,
    estimatedTrafficVolume: null,
    fieldFreshness: {},
    isOwnDomain: false,
    ...overrides
  } satisfies TrackedObservation
}
