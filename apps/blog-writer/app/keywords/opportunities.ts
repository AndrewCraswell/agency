import invariant from "tiny-invariant"
import { demand as writeDemand } from "./detectors/support"
import type { Candidate, Cluster, DetectorContext, Verdict } from "./types"

/**
 * What each property of a cluster is worth, summing to one.
 *
 * They are weighted separately and reported separately because they answer different questions, and a merchant who
 * disagrees with a ranking is nearly always disagreeing with one of these rather than with the total. Demand leads
 * because it bounds the return; reachability is close behind because a large unreachable cluster is worth nothing at
 * all, whatever the other three say.
 */
const WEIGHTS = {
  demand: 0.3,
  reachability: 0.25,
  proof: 0.2,
  relevance: 0.15,
  distance: 0.1
}

/**
 * An AI overview does not change whether we can rank, it changes what ranking earns.
 *
 * It sat on fifteen of twenty-five sampled result pages, so treating it as disqualifying would empty the list. It is
 * applied to the total instead of to a component, because it discounts the whole return rather than any one property.
 */
const AI_OVERVIEW_DISCOUNT = 0.8

/** Where striking distance begins, and where it stops being close enough to call a short push. */
const PAGE_TWO_START = 11
const PAGE_THREE_END = 30
const TOP_TEN = 10

/** Beyond this many competitor pages the proof is already conclusive and more of it says nothing new. */
const PROOF_CEILING = 5

/** How many rows one rule may contribute, so that no single rule becomes the whole list. */
const DETECTOR_CAP = 5

/** One component of a score, named so the row can be opened rather than trusted. */
export type ScoreComponent = {
  name: string
  /** The component's contribution to the total, already weighted. */
  value: number
  /** What this component measured, in the words the merchant reads. */
  reason: string
}

/** Another rule that reached the same cluster, kept on the row it agrees with rather than given a row of its own. */
export type SupportingFinding = {
  detector: string
  verdict: Verdict
  evidence: string[]
}

export type Opportunity = Candidate & {
  score: number
  components: ScoreComponent[]
  supporting: SupportingFinding[]
}

/**
 * Turns findings into a ranked list, and keeps the rest.
 *
 * Two lists come back rather than one. The suppressed rows are not discarded, because product-page territory,
 * cannibalization, and adequate coverage mostly work by keeping things out of the list, and a list that silently omits
 * things is a list a merchant stops trusting. Each suppressed row carries the rule that suppressed it, so "why is this
 * term not here" has an answer.
 *
 * A cluster gets one row however many rules reached it. Several usually do, because a large seasonal gap our
 * competitors hold is a competitor gap and a question and a season at once, and three rows saying so would read as
 * three separate pieces of work. The other rules stay on the row as supporting findings.
 */
export function rankOpportunities(candidates: Candidate[], clusters: Cluster[], context: DetectorContext) {
  const byId = new Map(clusters.map((cluster) => [cluster.clusterId, cluster]))
  const peakDemand = Math.max(1, ...clusters.map((cluster) => cluster.demand))
  const scored = candidates.flatMap((candidate) => {
    const cluster = byId.get(candidate.clusterId)
    if (cluster === undefined) {
      return []
    }
    return [score(candidate, cluster, peakDemand, context.catalogueTerms)]
  })
  const collapsed = [...groupByCluster(scored).values()].map((findings) => collapse(findings))
  const actionable = collapsed.filter((opportunity) => opportunity.verdict !== "no_action")
  const suppressed = collapsed
    .filter((opportunity) => opportunity.verdict === "no_action")
    .sort((left, right) => right.score - left.score)
  return { opportunities: interleave(actionable), suppressed }
}

function groupByCluster(scored: Opportunity[]) {
  const grouped = new Map<string, Opportunity[]>()
  for (const opportunity of scored) {
    const found = grouped.get(opportunity.clusterId) ?? []
    found.push(opportunity)
    grouped.set(opportunity.clusterId, found)
  }
  return grouped
}

/**
 * Picks the rule that speaks for a cluster.
 *
 * A rule that says to leave the cluster alone wins over one that says to write, whatever either scores. Those rules
 * exist to stop us proposing an article where an article would compete with our own page or with our own catalogue,
 * and letting a higher-scoring gap talk over them would waste exactly the work they were written to prevent.
 */
function collapse(findings: Opportunity[]): Opportunity {
  const byScore = [...findings].sort((left, right) => right.score - left.score)
  const leader = byScore.find((finding) => finding.verdict === "no_action") ?? byScore[0]
  invariant(leader !== undefined, "A cluster group always holds at least one finding.")
  return {
    ...leader,
    supporting: byScore
      .filter((finding) => finding.detector !== leader.detector)
      .map((finding) => ({ detector: finding.detector, verdict: finding.verdict, evidence: finding.evidence }))
  }
}

/** Scores one finding against the tenant's own population, and says what each part of the total was for. */
export function score(
  candidate: Candidate,
  cluster: Cluster,
  peakDemand: number,
  catalogueTerms: Set<string>
): Opportunity {
  const components: ScoreComponent[] = [
    {
      name: "demand",
      value: WEIGHTS.demand * Math.min(1, cluster.demand / peakDemand),
      reason: `${writeDemand(cluster.demand)} searches a month across ${String(cluster.keywords.length)} terms.`
    },
    {
      name: "reachability",
      value: WEIGHTS.reachability * reachability(cluster),
      reason: describeReachability(cluster)
    },
    {
      name: "proof",
      value: WEIGHTS.proof * Math.min(1, cluster.proofUrls.length / PROOF_CEILING),
      reason: `${String(cluster.proofUrls.length)} pages have already won these terms together.`
    },
    {
      name: "relevance",
      value: WEIGHTS.relevance * relevance(cluster, catalogueTerms),
      reason: describeRelevance(cluster, catalogueTerms)
    },
    {
      name: "distance",
      value: WEIGHTS.distance * distance(cluster),
      reason: describeDistance(cluster)
    }
  ]
  const total = components.reduce((sum, component) => sum + component.value, 0)
  if (cluster.hasAiOverview) {
    components.push({
      name: "ai_overview",
      value: total * (AI_OVERVIEW_DISCOUNT - 1),
      reason: "An AI overview sits above these results, so a given position earns fewer clicks than usual."
    })
    return { ...candidate, score: total * AI_OVERVIEW_DISCOUNT, components, supporting: [] }
  }
  return { ...candidate, score: total, components, supporting: [] }
}

/** Direct evidence that an article can rank here beats the provider's reading of what the search wants. */
function reachability(cluster: Cluster) {
  if (cluster.hasEditorialProof) {
    return 1
  }
  if (cluster.isReachable) {
    return 0.6
  }
  return 0.1
}

function describeReachability(cluster: Cluster) {
  if (cluster.hasEditorialProof) {
    return "A tracked domain holds the first page here with an article, so an article can win it."
  }
  if (cluster.isReachable) {
    return `The search reads as ${cluster.mainIntent ?? "informational"}, which an article can answer.`
  }
  return "The first page is commercial, so an article is unlikely to displace it."
}

/** How much of the cluster the store actually sells, which is the merchant's question rather than the provider's. */
function relevance(cluster: Cluster, catalogueTerms: Set<string>) {
  if (cluster.keywords.length === 0 || catalogueTerms.size === 0) {
    return 0
  }
  return matchingTerms(cluster, catalogueTerms).length / cluster.keywords.length
}

function describeRelevance(cluster: Cluster, catalogueTerms: Set<string>) {
  const matches = matchingTerms(cluster, catalogueTerms)
  if (matches.length === 0) {
    return "Nothing in your catalogue matches these terms."
  }
  return `${String(matches.length)} of these terms name something you sell, including "${matches[0] ?? ""}".`
}

/**
 * A cluster term is ours when one of its words is a catalogue word, or grows out of one.
 *
 * Matching anywhere inside a phrase makes "birkenstock" a match for a store that sells things in stock, so a match has
 * to start a word. It may still run past the end of one, because a store selling snowboards is unarguably relevant to
 * snowboarding.
 */
function matchingTerms(cluster: Cluster, catalogueTerms: Set<string>) {
  return cluster.keywords.filter((keyword) =>
    keyword.split(/[^\p{Letter}\p{Number}]+/u).some((word) => [...catalogueTerms].some((term) => word.startsWith(term)))
  )
}

/** Nearly ranking is the cheapest work there is, so it is worth more than ranking nowhere and more than being done. */
function distance(cluster: Cluster) {
  const position = cluster.ourBestPosition
  if (position === null) {
    return 0.4
  }
  if (position >= PAGE_TWO_START && position <= PAGE_THREE_END) {
    return 1
  }
  if (position <= TOP_TEN) {
    return 0.2
  }
  return 0.6
}

function describeDistance(cluster: Cluster) {
  if (cluster.ourBestPosition === null) {
    return "We don't rank for any of these terms yet."
  }
  return `Our best position across these terms is ${String(cluster.ourBestPosition)}.`
}

/**
 * Builds the list by taking turns between rules rather than by score alone.
 *
 * Sorting purely by score would hand the whole list to whichever rule happens to fire on the largest clusters, and a
 * merchant who only ever sees competitor gaps will only ever write against competitors and never fix what they already
 * have. Rules take turns, best row first, and each rule stops after its cap.
 */
function interleave(opportunities: Opportunity[]) {
  const queues = new Map<string, Opportunity[]>()
  for (const opportunity of [...opportunities].sort((left, right) => right.score - left.score)) {
    const queue = queues.get(opportunity.detector) ?? []
    if (queue.length < DETECTOR_CAP) {
      queue.push(opportunity)
    }
    queues.set(opportunity.detector, queue)
  }
  // Rules are served in the order of their strongest row, so the best finding overall still leads the list.
  const ordered = [...queues.values()].sort((left, right) => (right[0]?.score ?? 0) - (left[0]?.score ?? 0))
  const rows: Opportunity[] = []
  const depth = Math.max(0, ...ordered.map((queue) => queue.length))
  for (let index = 0; index < depth; index += 1) {
    for (const queue of ordered) {
      const opportunity = queue[index]
      if (opportunity !== undefined) {
        rows.push(opportunity)
      }
    }
  }
  return rows
}
