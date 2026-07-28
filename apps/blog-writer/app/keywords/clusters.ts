import type { Cluster, CompetitorPlacement, TrackedObservation } from "./types"

/**
 * A page has to hold at least this many of a cluster's terms before it counts as proof the terms belong together.
 *
 * One page ranking for one term says nothing about which other terms it could carry, so a group of one is not
 * evidence of anything and would turn every long-tail phrase into its own recommendation.
 */
const MINIMUM_GROUP_SIZE = 2

/** How far down a result page still counts as holding it, which is the first page and nothing below. */
const TOP_TEN = 10

/**
 * Path fragments that mark a page as part of the shop rather than as writing.
 *
 * Checked before the editorial markers, because a store that files buying guides under `/collections/guides` is
 * still serving a collection page and an article of ours cannot displace it by being better written.
 */
const SHOP_PATH_FRAGMENTS = [
  "/products/",
  "/product/",
  "/collections/",
  "/collection/",
  "/category/",
  "/categories/",
  "/shop/",
  "/store/",
  "/cart",
  "/checkout",
  "/brands/"
]

/**
 * Path fragments that mark a page as writing.
 *
 * Reachability is proven rather than assumed, so the absence of a shop marker is not enough on its own: a bare path
 * like `/mens-ski-jackets` is a category page on most stores and reads as neither. Only a page that names itself as
 * writing counts as proof that writing can rank.
 */
const EDITORIAL_PATH_FRAGMENTS = [
  "/blog",
  "/article",
  "/guide",
  "/guides",
  "/how-to",
  "/howto",
  "/learn",
  "/advice",
  "/resources",
  "/news",
  "/journal",
  "/stories",
  "/tips",
  "/help",
  "/faq"
]

/** Intents the provider reports for searches an article can answer. */
const REACHABLE_INTENTS = new Set(["informational", "commercial"])

/** Result-page blocks that sell rather than answer. */
const PRODUCT_BLOCK_TYPES = new Set([
  "shopping",
  "popular_products",
  "product_considerations",
  "commercial_units",
  "google_posts"
])

/** The block that answers the search on the result page, taking clicks a position would otherwise earn. */
const AI_OVERVIEW_TYPE = "ai_overview"

/** Words a search starts with when it is asking rather than looking for something. */
const QUESTION_PREFIXES = new Set([
  "how",
  "what",
  "why",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "can",
  "should",
  "does",
  "do",
  "is",
  "are",
  "will",
  "would"
])

/**
 * The position a page actually occupies on the result page.
 *
 * The provider reports two ranks: one counting every element including the blocks that are not results, and one
 * counting organic results alone. Only the second answers "are we on page one", so it is preferred wherever it was
 * reported and the other is the fallback rather than the measure.
 */
export function positionOf(observation: TrackedObservation) {
  return observation.rankGroup ?? observation.rankAbsolute
}

/** A stable identifier for a set of terms, so a merchant's dismissal survives an import that rebuilds every row. */
export function fingerprintKeywords(keywords: string[]) {
  const joined = [...keywords].sort().join("\u0000")
  return `${fnv1a(joined, 0x811c9dc5)}${fnv1a(joined, 0x01000193)}`
}

/*
 * A hash is arithmetic on bits, so the ban on bitwise operators is lifted for exactly this function. Two passes with
 * different seeds are concatenated because a single 32-bit value collides at a rate a store with thousands of
 * clusters would actually meet, and a collision here silently merges two merchants' decisions.
 */
/* eslint-disable no-bitwise */
function fnv1a(value: string, seed: number) {
  let hash = seed
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}
/* eslint-enable no-bitwise */

/** Whether a ranking URL reads as writing rather than as a shop page. */
export function isEditorialUrl(url: string | null) {
  if (url === null) {
    return false
  }
  const path = readPath(url)
  if (SHOP_PATH_FRAGMENTS.some((fragment) => path.includes(fragment))) {
    return false
  }
  return EDITORIAL_PATH_FRAGMENTS.some((fragment) => path.includes(fragment))
}

function readPath(url: string) {
  try {
    return new URL(url).pathname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** Whether a term is asking a question, which is what an answering article is proposed from. */
export function isQuestion(keyword: string) {
  if (keyword.includes("?")) {
    return true
  }
  const [first] = keyword.toLowerCase().split(/\s+/u)
  return first !== undefined && QUESTION_PREFIXES.has(first)
}

/**
 * Groups measured terms into sets one page could win together.
 *
 * The grouping is read off the result pages rather than off the words: a URL that already holds two or more of the
 * terms is evidence that one page can carry them, and no amount of string similarity is. Groups that share a term are
 * merged, because two pages holding overlapping sets are competing for the same article.
 *
 * A term no page holds alongside anything else is dropped unless we already rank for it. That keeps the long tail out
 * of the list without losing the terms where the question is about a page the store already has.
 */
export function buildClusters(observations: TrackedObservation[]): Cluster[] {
  const byKeyword = new Map<string, TrackedObservation[]>()
  for (const observation of observations) {
    const existing = byKeyword.get(observation.keyword)
    if (existing === undefined) {
      byKeyword.set(observation.keyword, [observation])
    } else {
      existing.push(observation)
    }
  }

  const groups = groupByRankingUrl(observations)
  const components = mergeOverlappingGroups(groups)
  const grouped = new Set(components.flat())

  for (const [keyword, rows] of byKeyword) {
    if (!grouped.has(keyword) && rows.some((row) => row.isOwnDomain)) {
      components.push([keyword])
    }
  }

  return components
    .map((keywords) => describeCluster(keywords, byKeyword))
    .sort((left, right) => right.demand - left.demand || left.headKeyword.localeCompare(right.headKeyword))
}

/** Every set of two or more terms one page was measured holding. */
function groupByRankingUrl(observations: TrackedObservation[]) {
  const byUrl = new Map<string, Set<string>>()
  for (const observation of observations) {
    if (observation.rankingUrl === null) {
      continue
    }
    const key = `${observation.domain}\u0000${observation.rankingUrl}`
    const existing = byUrl.get(key)
    if (existing === undefined) {
      byUrl.set(key, new Set([observation.keyword]))
    } else {
      existing.add(observation.keyword)
    }
  }
  return [...byUrl.values()].filter((keywords) => keywords.size >= MINIMUM_GROUP_SIZE).map((keywords) => [...keywords])
}

/**
 * Merges groups that share a term.
 *
 * Two pages holding overlapping term sets are answering the same search, so leaving them apart would produce two
 * recommendations for one article. The merge is transitive, which is deliberate: the alternative is an arbitrary rule
 * about which of two overlapping pages a term belongs to.
 */
function mergeOverlappingGroups(groups: string[][]) {
  const owner = new Map<string, string>()
  const find = (keyword: string): string => {
    const parent = owner.get(keyword)
    if (parent === undefined || parent === keyword) {
      return keyword
    }
    const root = find(parent)
    owner.set(keyword, root)
    return root
  }

  for (const group of groups) {
    const [first] = group
    if (first === undefined) {
      continue
    }
    owner.set(first, owner.get(first) ?? first)
    for (const keyword of group) {
      owner.set(keyword, owner.get(keyword) ?? keyword)
      const left = find(first)
      const right = find(keyword)
      if (left !== right) {
        owner.set(right, left)
      }
    }
  }

  const components = new Map<string, string[]>()
  for (const keyword of owner.keys()) {
    const root = find(keyword)
    const existing = components.get(root)
    if (existing === undefined) {
      components.set(root, [keyword])
    } else {
      existing.push(keyword)
    }
  }
  return [...components.values()]
}

function describeCluster(keywords: string[], byKeyword: Map<string, TrackedObservation[]>): Cluster {
  const sorted = [...keywords].sort()
  const rows = sorted.flatMap((keyword) => byKeyword.get(keyword) ?? [])
  const demandByKeyword = new Map(
    sorted.map((keyword) => [
      keyword,
      Math.max(0, ...(byKeyword.get(keyword) ?? []).map((row) => row.searchVolume ?? 0))
    ])
  )
  const headKeyword = pickHeadKeyword(sorted, demandByKeyword)
  const headRows = byKeyword.get(headKeyword) ?? []
  const ourRows = rows.filter((row) => row.isOwnDomain)
  const competitorRows = rows.filter((row) => !row.isOwnDomain)
  const ourBest = pickBestPosition(ourRows)
  const serpItemTypes = majorityItemTypes(sorted, byKeyword)
  const mainIntent = headRows.find((row) => row.mainIntent !== null)?.mainIntent ?? null
  const competitorTopTen = competitorRows
    .filter((row) => positionOf(row) <= TOP_TEN)
    .map((row) => ({ domain: row.domain, keyword: row.keyword, position: positionOf(row), url: row.rankingUrl }))
    .sort((left, right) => left.position - right.position)

  return {
    clusterId: fingerprintKeywords(sorted),
    headKeyword,
    headDemand: demandByKeyword.get(headKeyword) ?? 0,
    keywords: sorted,
    keywordDemand: Object.fromEntries(demandByKeyword),
    demand: [...demandByKeyword.values()].reduce((total, demand) => total + demand, 0),
    proofUrls: findProofUrls(competitorRows),
    competitorTopTen,
    ourBestPosition: ourBest?.position ?? null,
    ourBestKeyword: ourBest?.keyword ?? null,
    ourHeadPosition: pickBestPosition(headRows.filter((row) => row.isOwnDomain))?.position ?? null,
    ourRankingUrls: [...new Set(ourRows.flatMap((row) => (row.rankingUrl === null ? [] : [row.rankingUrl])))],
    largestOurDecline: findLargestDecline(ourRows, demandByKeyword),
    mainIntent,
    intents: [
      ...new Set(
        rows.flatMap((row) => (row.mainIntent === null ? row.foreignIntents : [row.mainIntent, ...row.foreignIntents]))
      )
    ].sort(),
    difficulty: median(rows.flatMap((row) => (row.difficulty === null ? [] : [row.difficulty]))),
    serpAverageDomainRank: mean(
      rows.flatMap((row) => (row.serpAverageDomainRank === null ? [] : [row.serpAverageDomainRank]))
    ),
    serpItemTypes,
    headMonthlySearches: headRows.find((row) => row.monthlySearches !== null)?.monthlySearches ?? null,
    hasEditorialProof: hasEditorialWinner(competitorTopTen),
    isReachable: (mainIntent !== null && REACHABLE_INTENTS.has(mainIntent)) || hasEditorialWinner(competitorTopTen),
    hasAiOverview: serpItemTypes.includes(AI_OVERVIEW_TYPE),
    hasProductBlocks: serpItemTypes.some((type) => PRODUCT_BLOCK_TYPES.has(type)),
    questionKeywords: sorted.filter((keyword) => isQuestion(keyword))
  }
}

/** The cluster's highest-demand term, resolving ties alphabetically so a rebuild names the row the same way. */
function pickHeadKeyword(keywords: string[], demandByKeyword: Map<string, number>) {
  return keywords.reduce((head, keyword) => {
    const difference = (demandByKeyword.get(keyword) ?? 0) - (demandByKeyword.get(head) ?? 0)
    if (difference > 0 || (difference === 0 && keyword.localeCompare(head) < 0)) {
      return keyword
    }
    return head
  })
}

function pickBestPosition(rows: TrackedObservation[]) {
  let best: { position: number; keyword: string } | null = null
  for (const row of rows) {
    const position = positionOf(row)
    if (best === null || position < best.position) {
      best = { position, keyword: row.keyword }
    }
  }
  return best
}

/** Competitor pages holding two or more of the cluster's terms, which is the proof one page can carry the set. */
function findProofUrls(competitorRows: TrackedObservation[]) {
  const counts = new Map<string, number>()
  for (const row of competitorRows) {
    if (row.rankingUrl !== null) {
      counts.set(row.rankingUrl, (counts.get(row.rankingUrl) ?? 0) + 1)
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= MINIMUM_GROUP_SIZE).map(([url]) => url)
}

function hasEditorialWinner(competitorTopTen: CompetitorPlacement[]) {
  return competitorTopTen.some((placement) => isEditorialUrl(placement.url))
}

/**
 * The steepest fall the provider reports for one of our terms.
 *
 * Only falls are read. A term we rose on is not evidence about anything, and mixing the two into an average would let
 * a page that gained in one place hide a page that collapsed in another.
 */
function findLargestDecline(ourRows: TrackedObservation[], demandByKeyword: Map<string, number>) {
  let worst: Cluster["largestOurDecline"] = null
  for (const row of ourRows) {
    const previous = row.previousRankAbsolute
    if (previous === null) {
      continue
    }
    const current = positionOf(row)
    if (current <= previous) {
      continue
    }
    if (worst === null || current - previous > worst.to - worst.from) {
      worst = { keyword: row.keyword, from: previous, to: current, demand: demandByKeyword.get(row.keyword) ?? 0 }
    }
  }
  return worst
}

/**
 * The result-page blocks present on at least half the cluster's terms.
 *
 * A block that appears on nearly every result page carries no information about a particular cluster, and a block
 * that appeared once is not a property of the cluster at all. Requiring a majority is what stops both from being read
 * as a signal.
 */
function majorityItemTypes(keywords: string[], byKeyword: Map<string, TrackedObservation[]>) {
  const counts = new Map<string, number>()
  for (const keyword of keywords) {
    const types = new Set((byKeyword.get(keyword) ?? []).flatMap((row) => row.serpItemTypes))
    for (const type of types) {
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count * 2 >= keywords.length)
    .map(([type]) => type)
    .sort()
}

function median(values: number[]) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  if (sorted.length % 2 === 1) {
    return upper
  }
  return ((sorted[middle - 1] ?? upper) + upper) / 2
}

function mean(values: number[]) {
  if (values.length === 0) {
    return null
  }
  return values.reduce((total, value) => total + value, 0) / values.length
}
