import type { KeywordObservation } from "./normalize"

/**
 * One observation, with the one fact the provider does not supply.
 *
 * Whether a domain is ours is a tenant fact rather than a measurement, so it is attached here rather than carried
 * through normalization. Everything downstream is a function of these rows and nothing else, which is what lets the
 * whole derived layer be replayed against a stored import.
 */
export type TrackedObservation = KeywordObservation & { isOwnDomain: boolean }

/** Where a competitor's page sits on a term one of our pages could hold instead. */
export type CompetitorPlacement = {
  domain: string
  keyword: string
  position: number
  url: string | null
}

/**
 * A set of terms one page has been proven able to win together.
 *
 * The four properties worth scoring separately are kept separate: how reachable the cluster is by an article at all,
 * how much demand it carries, how far our own page is from holding it, and how much proof there is that a single page
 * can win it. Collapsing them into one number would make every recommendation unanswerable.
 */
export type Cluster = {
  /** A hash of the cluster's sorted terms, so a dismissal survives an import that rebuilds every row. */
  clusterId: string
  /** The cluster's highest-demand term, which is what a row is named after. */
  headKeyword: string
  headDemand: number
  keywords: string[]
  /** Demand per term, so a rule can compare the term we hold against the one we do not. */
  keywordDemand: Record<string, number>
  /** Combined demand across the cluster's terms, which is not the head's demand and never stands in for it. */
  demand: number
  /** Distinct competitor pages that hold two or more of these terms. Proof that one page can carry the set. */
  proofUrls: string[]
  /** Competitor pages in the top ten anywhere in the cluster, which is what a gap is argued from. */
  competitorTopTen: CompetitorPlacement[]
  /** Our best position anywhere in the cluster, and the term it was measured on. */
  ourBestPosition: number | null
  ourBestKeyword: string | null
  /** Our position on the head term specifically, which is a different question from our best position. */
  ourHeadPosition: number | null
  /** Distinct pages of ours ranking anywhere in the cluster. More than one is a split, not a win. */
  ourRankingUrls: string[]
  /** The largest fall the provider reports for one of our terms, against the demand that term still carries. */
  largestOurDecline: { keyword: string; from: number; to: number; demand: number } | null
  mainIntent: string | null
  /** Every intent reported across the cluster's terms, main and secondary alike. */
  intents: string[]
  /** The median of the difficulties the provider actually reported, which is absent on many terms. */
  difficulty: number | null
  /** The mean authority of the pages holding these terms, which is what attainability is read from. */
  serpAverageDomainRank: number | null
  /** Result-page features present on at least half the cluster's terms. A feature nearly everything has proves nothing. */
  serpItemTypes: string[]
  /** Twelve monthly demand figures for the head term, when the provider supplied them. */
  headMonthlySearches: { year: number; month: number; searchVolume: number }[] | null
  /** A tracked domain holds the top ten here with a page that reads as an article rather than as a shop page. */
  hasEditorialProof: boolean
  /** Reported intent or editorial proof says an article can rank here at all. */
  isReachable: boolean
  /** The result pages carry an answer block that takes clicks a position would otherwise earn. */
  hasAiOverview: boolean
  /** The result pages carry product blocks, which alongside transactional intent is shop territory. */
  hasProductBlocks: boolean
  /** Terms in the cluster phrased as a question, which is what an answering article is proposed from. */
  questionKeywords: string[]
}

/**
 * The thresholds a tenant is measured against, taken from the tenant's own distribution.
 *
 * Fixed constants make the product useless for a niche store and noisy for a large one, so every bar here is derived
 * from what this store and its competitors were actually measured at. The confidence field says how much weight the
 * authority ceiling can carry, because a store that ranks for nothing has nothing to calibrate against and the
 * detectors that need one must not run rather than run on a guess.
 */
export type Calibration = {
  ourDomainRank: number | null
  /** Below this, a cluster is single-search noise for this tenant. */
  demandFloor: number
  /** The authority of the strongest result page we have been shown to be able to hold. Null when nothing supports one. */
  wonAuthorityCeiling: number | null
  /** The highest reported difficulty we hold in the top ten, kept as a coarse sanity check rather than as the bar. */
  wonDifficultyCeiling: number | null
  authorityConfidence: "own_wins" | "competitor_floor" | "none"
  clusterCount: number
}

/** What a detector says should happen, which is never left for a later step to infer. */
export type Verdict = "new_article" | "refresh" | "schedule" | "no_action"

/**
 * One detector's finding on one cluster.
 *
 * The evidence travels with the finding rather than being recomputed for display, because a row that cannot name why
 * it is there is a row a merchant has to take on faith.
 */
export type Candidate = {
  detector: string
  clusterId: string
  verdict: Verdict
  /** The instruction a refresh carries into the brief. Absent where the verdict is not a refresh. */
  scope: string | null
  /** Short factual statements, each one readable on its own, that produced this finding. */
  evidence: string[]
}

/** Everything a detector may read beyond the clusters themselves. */
export type DetectorContext = {
  calibration: Calibration
  /** Terms our own catalogue already names, lowercased, used to prefer clusters about what the store actually sells. */
  catalogueTerms: Set<string>
  /** Our ranking URL for each term an article of ours deliberately targets. */
  articleTargets: { keyword: string; articleId: string; url: string | null }[]
  /** When the import ran. Passed in rather than read, so a season is decided by the run and not by the clock. */
  now: Date
}

/**
 * A rule with its own evidence and its own gate.
 *
 * Detectors are a catalogue rather than one scoring function so that a rule can be added, reweighted, or switched off
 * without disturbing the others, and so that every row can name the rule that produced it.
 */
export type Detector = {
  name: string
  verdict: Verdict
  /** Whether the rule needs an authority ceiling, which a store that ranks for nothing cannot supply. */
  requiresAuthority: boolean
  detect: (clusters: Cluster[], context: DetectorContext) => Candidate[]
}
