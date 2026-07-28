import type { Calibration, Cluster, DetectorContext } from "../types"

/**
 * A cluster with every field a detector may read already set to the harmless value.
 *
 * Detectors read a dozen fields each and mostly care about two, so a test that had to spell out all of them would bury
 * the condition it exists to describe. Each test names only the fields its rule turns on.
 */
export function cluster(overrides: Partial<Cluster> & Pick<Cluster, "clusterId">): Cluster {
  const keywords = overrides.keywords ?? [overrides.clusterId]
  return {
    headKeyword: keywords[0] ?? overrides.clusterId,
    headDemand: 1000,
    keywords,
    keywordDemand: Object.fromEntries(keywords.map((keyword) => [keyword, 1000])),
    demand: 1000 * keywords.length,
    proofUrls: [],
    competitorTopTen: [],
    ourBestPosition: null,
    ourBestKeyword: null,
    ourHeadPosition: null,
    ourRankingUrls: [],
    largestOurDecline: null,
    mainIntent: "informational",
    intents: [],
    difficulty: null,
    serpAverageDomainRank: null,
    serpItemTypes: [],
    headMonthlySearches: null,
    hasEditorialProof: false,
    isReachable: true,
    hasAiOverview: false,
    hasProductBlocks: false,
    questionKeywords: [],
    ...overrides
  }
}

/** A calibration that permits everything, so a test only has to state the bound it is exercising. */
export function calibration(overrides: Partial<Calibration> = {}): Calibration {
  return {
    ourDomainRank: 91,
    demandFloor: 50,
    wonAuthorityCeiling: 200,
    wonDifficultyCeiling: 17,
    authorityConfidence: "own_wins",
    clusterCount: 20,
    ...overrides
  }
}

export function detectorContext(overrides: Partial<DetectorContext> = {}): DetectorContext {
  return {
    calibration: calibration(),
    catalogueTerms: new Set<string>(),
    articleTargets: [],
    now: new Date("2026-01-15T00:00:00Z"),
    ...overrides
  }
}

/** Twelve months of flat demand ending in the month before `now`, which a seasonal test then bends. */
export function flatMonths(searchVolume = 1000) {
  return Array.from({ length: 12 }, (_unused, index) => ({
    year: 2025,
    month: index + 1,
    searchVolume
  }))
}
