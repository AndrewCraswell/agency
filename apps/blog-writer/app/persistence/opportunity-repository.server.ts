import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm"
import type { Opportunity } from "../keywords/opportunities"
import type { Calibration, Cluster } from "../keywords/types"
import { getTenantIdForShop } from "./blog-workspace-repository.server"
import { database } from "./database.server"
import {
  articles,
  blogIdeas,
  keywordClusterDismissals,
  keywordClusters,
  keywordImportDomains,
  keywordImports,
  keywordObservations,
  keywordOpportunities,
  tenantResources
} from "./schema.server"

/** How many rows to insert at once, which keeps a large tenant's clusters inside one statement's parameter budget. */
const BATCH_SIZE = 200

export type OpportunityRow = {
  clusterId: string
  detector: string
  verdict: string
  /** The other rules that reached this cluster, which the row reports rather than repeats. */
  supporting: { detector: string; verdict: string; evidence: string[] }[]
  scope: string | null
  evidence: string[]
  score: number
  scoreComponents: { name: string; value: number; reason: string }[]
  cluster: {
    headKeyword: string
    /** Every term in the cluster, so a merchant can read what an idea drawn from it would have to cover. */
    keywords: string[]
    keywordCount: number
    demand: number
    headDemand: number
    difficulty: number | null
    mainIntent: string | null
    ourBestPosition: number | null
    competitorDomains: string[]
  }
  /** The idea or article that already took this cluster, which turns the row from a decision into progress. */
  claim: Claim | null
  isDismissed: boolean
}

/**
 * What took a cluster. An idea until it becomes an article, and the article from then on.
 *
 * A merchant can draw more than one idea from the same subject, so the claim names the first and counts the rest
 * rather than pretending the subject produced a single piece of work.
 */
export type Claim = { kind: "idea" | "article"; id: string; title: string; count: number }

export type OpportunityList = {
  importId: string | null
  /** When the import behind these numbers ran, which the header states because a keyword figure expires. */
  measuredAt: string | null
  calibration: Calibration | null
  opportunities: OpportunityRow[]
  suppressed: OpportunityRow[]
}

/** Everything the derived layer needs from the tenant's own records, which costs no provider request. */
export async function readDerivationInputs(tenantId: string, importId: string) {
  const [observations, ownDomain, catalogue, targets] = await Promise.all([
    database
      .select()
      .from(keywordObservations)
      .where(and(eq(keywordObservations.tenantId, tenantId), eq(keywordObservations.importId, importId))),
    database
      .select({ domainRank: keywordImportDomains.domainRank })
      .from(keywordImportDomains)
      .where(
        and(
          eq(keywordImportDomains.tenantId, tenantId),
          eq(keywordImportDomains.importId, importId),
          eq(keywordImportDomains.isOwnDomain, true)
        )
      ),
    database
      .select({ title: tenantResources.title })
      .from(tenantResources)
      .where(
        and(
          eq(tenantResources.tenantId, tenantId),
          eq(tenantResources.isActive, true),
          inArray(tenantResources.resourceType, ["product", "collection"])
        )
      ),
    // An article's target is the term its idea was written against, and the URL it publishes at is what a search
    // engine can actually return. A misdirect is the difference between the two, so both travel together.
    database
      .select({
        keyword: blogIdeas.targetKeyword,
        articleId: articles.articleId,
        url: articles.shopifyArticleUrl
      })
      .from(articles)
      .innerJoin(blogIdeas, and(eq(blogIdeas.tenantId, articles.tenantId), eq(blogIdeas.ideaId, articles.ideaId)))
      .where(eq(articles.tenantId, tenantId))
  ])

  return {
    observations,
    ourDomainRank: ownDomain.find((row) => row.domainRank !== null)?.domainRank ?? null,
    catalogueTitles: catalogue.map((row) => row.title).filter((title) => title.trim().length > 0),
    articleTargets: targets.map((target) => ({
      keyword: target.keyword.toLowerCase().trim(),
      articleId: target.articleId,
      url: target.url
    }))
  }
}

/**
 * Replaces one import's derived layer with what the detectors just concluded.
 *
 * Wholesale replacement rather than reconciliation, because these rows are a function of the observations and the
 * rules alone. Reconciling them would preserve conclusions the current rules would not draw, which is the one thing a
 * derived table must never do. The observations they were derived from are untouched.
 */
export async function saveDerivedLayer(input: {
  tenantId: string
  importId: string
  calibration: Calibration
  clusters: Cluster[]
  opportunities: Opportunity[]
  suppressed: Opportunity[]
}) {
  const { tenantId, importId } = input
  // Only the clusters something was concluded about are worth keeping. A cluster no rule fired on has nothing to say
  // and no row to answer for, and storing it would fill the table with silence.
  const spokenFor = new Set([...input.opportunities, ...input.suppressed].map((entry) => entry.clusterId))
  const clusters = input.clusters.filter((cluster) => spokenFor.has(cluster.clusterId))

  await database.transaction(async (transaction) => {
    await transaction
      .delete(keywordClusters)
      .where(and(eq(keywordClusters.tenantId, tenantId), eq(keywordClusters.importId, importId)))

    for (let index = 0; index < clusters.length; index += BATCH_SIZE) {
      await transaction
        .insert(keywordClusters)
        .values(clusters.slice(index, index + BATCH_SIZE).map((cluster) => ({ ...cluster, tenantId, importId })))
    }

    const rows = [
      ...input.opportunities.map((opportunity, rank) => toRow(opportunity, tenantId, importId, rank + 1, false)),
      ...input.suppressed.map((opportunity) => toRow(opportunity, tenantId, importId, null, true))
    ]
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      await transaction.insert(keywordOpportunities).values(rows.slice(index, index + BATCH_SIZE))
    }

    await transaction
      .update(keywordImports)
      .set({ calibration: { ...input.calibration } })
      .where(and(eq(keywordImports.tenantId, tenantId), eq(keywordImports.importId, importId)))
  })
}

function toRow(
  opportunity: Opportunity,
  tenantId: string,
  importId: string,
  rank: number | null,
  isSuppressed: boolean
) {
  return {
    tenantId,
    importId,
    clusterId: opportunity.clusterId,
    detector: opportunity.detector,
    verdict: opportunity.verdict,
    supporting: opportunity.supporting,
    rank,
    isSuppressed,
    score: opportunity.score,
    scoreComponents: opportunity.components,
    evidence: opportunity.evidence,
    scope: opportunity.scope
  }
}

/**
 * The ranked list as of the most recent import that produced one.
 *
 * The most recent import is not necessarily the most recent successful one, and a run that failed writes no clusters,
 * so the list is read from the last import that has any rather than emptying the section whenever the provider has a
 * bad night.
 */
export async function readOpportunityList(shopDomain: string): Promise<OpportunityList> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return { importId: null, measuredAt: null, calibration: null, opportunities: [], suppressed: [] }
  }

  const [latest] = await database
    .select({
      importId: keywordImports.importId,
      calibration: keywordImports.calibration,
      completedAt: keywordImports.completedAt,
      requestedAt: keywordImports.requestedAt
    })
    .from(keywordImports)
    .innerJoin(
      keywordClusters,
      and(eq(keywordClusters.tenantId, keywordImports.tenantId), eq(keywordClusters.importId, keywordImports.importId))
    )
    .where(eq(keywordImports.tenantId, tenantId))
    .groupBy(
      keywordImports.importId,
      keywordImports.calibration,
      keywordImports.completedAt,
      keywordImports.requestedAt
    )
    .orderBy(desc(keywordImports.requestedAt))
    .limit(1)

  if (latest === undefined) {
    return { importId: null, measuredAt: null, calibration: null, opportunities: [], suppressed: [] }
  }

  const [rows, dismissals, claims] = await Promise.all([
    database
      .select()
      .from(keywordOpportunities)
      .innerJoin(
        keywordClusters,
        and(
          eq(keywordClusters.tenantId, keywordOpportunities.tenantId),
          eq(keywordClusters.importId, keywordOpportunities.importId),
          eq(keywordClusters.clusterId, keywordOpportunities.clusterId)
        )
      )
      .where(and(eq(keywordOpportunities.tenantId, tenantId), eq(keywordOpportunities.importId, latest.importId)))
      // The stored rank interleaves the detectors so no single rule can fill the list, which decides which clusters
      // are here at all. Once they are here the merchant reads them strongest first, so the list is shown by score.
      .orderBy(desc(keywordOpportunities.score), asc(keywordOpportunities.rank)),
    database
      .select({ clusterId: keywordClusterDismissals.clusterId })
      .from(keywordClusterDismissals)
      .where(eq(keywordClusterDismissals.tenantId, tenantId)),
    readClaims(tenantId)
  ])

  const dismissed = new Set(dismissals.map((row) => row.clusterId))
  const listed = rows.map((row) => ({
    // A dismissal is the merchant's own suppression, and it reads the same way from the list: the row leaves the
    // writing queue and stays answerable for why.
    isSuppressed: row.keyword_opportunities.isSuppressed || dismissed.has(row.keyword_opportunities.clusterId),
    row: toOpportunityRow(row, dismissed, claims)
  }))

  return {
    importId: latest.importId,
    measuredAt: (latest.completedAt ?? latest.requestedAt).toISOString(),
    calibration: readCalibration(latest.calibration),
    opportunities: listed.filter((entry) => !entry.isSuppressed).map((entry) => entry.row),
    suppressed: listed.filter((entry) => entry.isSuppressed).map((entry) => entry.row)
  }
}

/** The thresholds the run was judged against, or nothing when it predates them. */
function readCalibration(stored: Record<string, unknown> | null) {
  if (stored === null) {
    return null
  }
  return stored as unknown as Calibration
}

/**
 * Which cluster each existing idea took, keyed by cluster.
 *
 * The oldest idea speaks for the cluster, because the first thing to take a subject is what claimed it, and the rest
 * are counted so a subject worked on repeatedly does not read like a subject worked on once. An idea that has become
 * an article reports the article, since that is what the merchant would open.
 */
async function readClaims(tenantId: string): Promise<Map<string, Claim>> {
  const rows = await database
    .select({
      clusterId: blogIdeas.clusterId,
      ideaId: blogIdeas.ideaId,
      title: blogIdeas.title,
      articleId: articles.articleId
    })
    .from(blogIdeas)
    .leftJoin(articles, and(eq(articles.tenantId, blogIdeas.tenantId), eq(articles.ideaId, blogIdeas.ideaId)))
    .where(and(eq(blogIdeas.tenantId, tenantId), isNotNull(blogIdeas.clusterId)))
    .orderBy(asc(blogIdeas.createdAt))

  const claims = new Map<string, Claim>()
  for (const row of rows) {
    if (row.clusterId === null) {
      continue
    }
    const found = claims.get(row.clusterId)
    if (found !== undefined) {
      claims.set(row.clusterId, { ...found, count: found.count + 1 })
      continue
    }
    if (row.articleId === null) {
      claims.set(row.clusterId, { kind: "idea", id: row.ideaId, title: row.title, count: 1 })
      continue
    }
    claims.set(row.clusterId, { kind: "article", id: row.articleId, title: row.title, count: 1 })
  }
  return claims
}

function toOpportunityRow(
  row: {
    keyword_opportunities: {
      clusterId: string
      detector: string
      verdict: string
      supporting: { detector: string; verdict: string; evidence: string[] }[]
      scope: string | null
      evidence: string[]
      score: number
      scoreComponents: { name: string; value: number; reason: string }[]
      isSuppressed: boolean
    }
    keyword_clusters: {
      headKeyword: string
      keywords: string[]
      demand: number
      headDemand: number
      difficulty: number | null
      mainIntent: string | null
      ourBestPosition: number | null
      competitorTopTen: { domain: string }[]
    }
  },
  dismissed: Set<string>,
  claims: Map<string, Claim>
): OpportunityRow {
  const opportunity = row.keyword_opportunities
  const cluster = row.keyword_clusters
  return {
    clusterId: opportunity.clusterId,
    detector: opportunity.detector,
    verdict: opportunity.verdict,
    supporting: opportunity.supporting,
    scope: opportunity.scope,
    evidence: opportunity.evidence,
    score: opportunity.score,
    scoreComponents: opportunity.scoreComponents,
    cluster: {
      headKeyword: cluster.headKeyword,
      keywords: cluster.keywords,
      keywordCount: cluster.keywords.length,
      demand: cluster.demand,
      headDemand: cluster.headDemand,
      difficulty: cluster.difficulty,
      mainIntent: cluster.mainIntent,
      ourBestPosition: cluster.ourBestPosition,
      competitorDomains: [...new Set(cluster.competitorTopTen.map((placement) => placement.domain))]
    },
    claim: claims.get(opportunity.clusterId) ?? null,
    isDismissed: dismissed.has(opportunity.clusterId)
  }
}

/** Records that these ideas were drawn from a cluster, which is the moment the cluster counts as claimed. */
export async function claimCluster(tenantId: string, clusterId: string, ideaIds: string[]) {
  if (ideaIds.length === 0) {
    return
  }
  await database
    .update(blogIdeas)
    .set({ clusterId })
    .where(and(eq(blogIdeas.tenantId, tenantId), inArray(blogIdeas.ideaId, ideaIds)))
}

/** Records that a merchant never wants this subject written about, with the reason they gave. */
export async function dismissCluster(
  shopDomain: string,
  cluster: { clusterId: string; headKeyword: string },
  reason: string
) {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return
  }
  await database
    .insert(keywordClusterDismissals)
    .values({ tenantId, clusterId: cluster.clusterId, headKeyword: cluster.headKeyword, reason })
    .onConflictDoUpdate({
      target: [keywordClusterDismissals.tenantId, keywordClusterDismissals.clusterId],
      set: { reason, dismissedAt: new Date() }
    })
}

/** Undoes a dismissal, which is a decision a merchant is allowed to change. */
export async function restoreCluster(shopDomain: string, clusterId: string) {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return
  }
  await database
    .delete(keywordClusterDismissals)
    .where(and(eq(keywordClusterDismissals.tenantId, tenantId), eq(keywordClusterDismissals.clusterId, clusterId)))
}
