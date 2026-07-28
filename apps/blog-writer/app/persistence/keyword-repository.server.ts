import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { keywordProviderName, rankedKeywordsEndpoint } from "../keywords/dataforseo.server"
import type { KeywordMarket } from "../keywords/market"
import { describeKeywordMarket } from "../keywords/market"
import type { KeywordObservation, NormalizedDomainKeywords } from "../keywords/normalize"
import { getTenantIdForShop } from "./blog-workspace-repository.server"
import { database } from "./database.server"
import {
  keywordImportDomains,
  keywordImports,
  keywordObservations,
  tenantCompetitorDomains,
  tenantStores
} from "./schema.server"

const HOUR_MS = 60 * 60 * 1000

/**
 * How long a collection stays current, which depends on who asked for it.
 *
 * The monthly cadence lives in the n8n schedule, not here, so the window for a scheduled run is only wide enough to
 * absorb a retry or a duplicated delivery. It must stay well under the shortest gap the schedule can produce: a job
 * that fires on the first of the month is 31 days apart in one place and 28 in another, so a window of a month would
 * silently skip February's run and every short month after it. Guarding a cadence we do not own is how that bug gets
 * written, and an hour is long enough to stop the same trigger paying twice without ever refusing a real run.
 *
 * A merchant refreshing by hand is answering a different question, usually that they have just added a competitor and
 * want it measured now, so their window is a week. That is a ceiling on how often a store can spend rather than an
 * invitation to spend weekly, and it sits far above the point where the provider would have new figures: the provider
 * serves its own database instead of querying a search engine on demand, and on the fencing sample its result-page
 * fields were already two months behind its demand fields.
 *
 * Both windows are read from the last import for the tenant, so a manual refresh also postpones the next scheduled
 * one. The two are not separate budgets.
 *
 * Forcing overrides the weekly ceiling for the case it was never meant to catch: a merchant on a support call who has
 * just corrected something and needs the figures to move now. It is not free of a floor, because the button is one
 * click and the spend is real, so a forced run still refuses to repeat within the hour. That is enough to stop a
 * double submission or an impatient second click from paying twice, and short enough that it never stands in the way
 * of the conversation that prompted it.
 */
export const KEYWORD_IMPORT_FRESHNESS_MS = {
  scheduled: HOUR_MS,
  manual: 7 * 24 * HOUR_MS,
  forced: HOUR_MS
} as const

/** Raised when keyword work is requested for a store whose market has not been resolved. */
export class KeywordMarketUnresolvedError extends Error {
  constructor() {
    super("The store's search market is not resolved")
    this.name = "KeywordMarketUnresolvedError"
  }
}

export type KeywordImportSummary = {
  importId: string
  status: "running" | "succeeded" | "partial" | "failed"
  trigger: "scheduled" | "manual"
  requestedAt: string
  completedAt: string | null
  rowCount: number
  cost: string
  errorCode: string | null
  domains: {
    domain: string
    isOwnDomain: boolean
    status: "running" | "succeeded" | "failed"
    rowCount: number
    availableRowCount: number | null
    domainRank: number | null
    errorCode: string | null
  }[]
}

export type KeywordImportOverview = {
  market: KeywordMarket | null
  competitorDomains: string[]
  lastImport: KeywordImportSummary | null
}

const ImportStatusSchema = z.enum(["running", "succeeded", "partial", "failed"])
const ImportTriggerSchema = z.enum(["scheduled", "manual"])
const DomainStatusSchema = z.enum(["running", "succeeded", "failed"])

/**
 * Resolves the store behind an authenticated session.
 *
 * Every exported function in this module goes through here, and none of them accept a tenant identifier, shop
 * handle, or domain from a caller. Keyword evidence is the one thing in the app a store can spend another store's
 * money to read, so the identifier is derived rather than passed and there is no argument a route could get wrong.
 */
async function requireTenantId(shopDomain: string) {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    throw new Error("Store content must be synchronized before keyword evidence can be collected")
  }
  return tenantId
}

async function readMarket(tenantId: string) {
  const [store] = await database
    .select({
      countryCode: tenantStores.marketCountryCode,
      languageCode: tenantStores.marketLanguageCode
    })
    .from(tenantStores)
    .where(eq(tenantStores.tenantId, tenantId))
  return describeKeywordMarket(store?.countryCode ?? null, store?.languageCode ?? null)
}

/**
 * Records the market a merchant chose, which later syncs then leave alone.
 *
 * Where a store sells and where it is billed are different questions, and Shopify can only answer the second one. The
 * source is written as the merchant's so that the answer survives, because a sync that overwrote it would put the
 * store back on the wrong market on a schedule.
 */
export async function setKeywordMarket(shopDomain: string, market: KeywordMarket, now: Date = new Date()) {
  const tenantId = await requireTenantId(shopDomain)
  await database
    .update(tenantStores)
    .set({
      marketCountryCode: market.countryCode,
      marketLanguageCode: market.languageCode,
      marketSource: "merchant",
      updatedAt: now
    })
    .where(eq(tenantStores.tenantId, tenantId))
}

async function readOwnDomains(tenantId: string) {
  const [store] = await database
    .select({ shopDomain: tenantStores.shopDomain, ownedDomains: tenantStores.ownedDomains })
    .from(tenantStores)
    .where(eq(tenantStores.tenantId, tenantId))
  if (store === undefined) {
    return []
  }
  // The myshopify address is a redirect for most live stores, so the custom domain is what actually ranks. Both are
  // kept and the shortest is asked about first, because that is the apex the provider reports a domain rank for.
  return [...new Set([...store.ownedDomains, store.shopDomain])].sort((left, right) => left.length - right.length)
}

async function readImportSummary(tenantId: string, importId: string): Promise<KeywordImportSummary | null> {
  const [record] = await database
    .select()
    .from(keywordImports)
    .where(and(eq(keywordImports.tenantId, tenantId), eq(keywordImports.importId, importId)))
  if (record === undefined) {
    return null
  }

  const domains = await database
    .select()
    .from(keywordImportDomains)
    .where(and(eq(keywordImportDomains.tenantId, tenantId), eq(keywordImportDomains.importId, importId)))

  return {
    importId: record.importId,
    status: ImportStatusSchema.parse(record.status),
    trigger: ImportTriggerSchema.parse(record.trigger),
    requestedAt: record.requestedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    rowCount: record.rowCount,
    cost: record.cost,
    errorCode: record.errorCode,
    domains: domains
      .map((domain) => ({
        domain: domain.domain,
        isOwnDomain: domain.isOwnDomain,
        status: DomainStatusSchema.parse(domain.status),
        rowCount: domain.rowCount,
        availableRowCount: domain.availableRowCount,
        domainRank: domain.domainRank,
        errorCode: domain.errorCode
      }))
      .sort((left, right) => Number(right.isOwnDomain) - Number(left.isOwnDomain))
  }
}

async function readLastImportId(tenantId: string) {
  const [record] = await database
    .select({ importId: keywordImports.importId })
    .from(keywordImports)
    .where(eq(keywordImports.tenantId, tenantId))
    .orderBy(desc(keywordImports.requestedAt))
    .limit(1)
  return record?.importId ?? null
}

/** Everything the Settings view needs to describe the store's keyword evidence, and nothing that costs money. */
export async function getKeywordImportOverview(shopDomain: string): Promise<KeywordImportOverview> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return { market: null, competitorDomains: [], lastImport: null }
  }

  const [market, competitors, lastImportId] = await Promise.all([
    readMarket(tenantId),
    database
      .select({ hostname: tenantCompetitorDomains.hostname })
      .from(tenantCompetitorDomains)
      .where(eq(tenantCompetitorDomains.tenantId, tenantId)),
    readLastImportId(tenantId)
  ])

  return {
    market,
    competitorDomains: competitors.map(({ hostname }) => hostname),
    lastImport: lastImportId === null ? null : await readImportSummary(tenantId, lastImportId)
  }
}

export type KeywordImportPlan = {
  tenantId: string
  importId: string
  market: KeywordMarket
  targets: { domain: string; isOwnDomain: boolean }[]
}

export type BeginKeywordImportResult =
  | { outcome: "started"; plan: KeywordImportPlan }
  | { outcome: "current"; lastImport: KeywordImportSummary }

/**
 * Opens an import run, or declines to.
 *
 * A request inside the throttle window is answered with the collection already on file rather than an error. Nothing
 * failed, the merchant asked a reasonable question, and the honest answer is that the evidence is current.
 */
export async function beginKeywordImport(
  shopDomain: string,
  trigger: "scheduled" | "manual",
  options: { force?: boolean; now?: Date } = {}
): Promise<BeginKeywordImportResult> {
  const now = options.now ?? new Date()
  const window = options.force === true ? "forced" : trigger
  const tenantId = await requireTenantId(shopDomain)
  const market = await readMarket(tenantId)
  if (market === null) {
    throw new KeywordMarketUnresolvedError()
  }

  const [recent] = await database
    .select({ importId: keywordImports.importId })
    .from(keywordImports)
    .where(
      and(
        eq(keywordImports.tenantId, tenantId),
        sql`${keywordImports.requestedAt} > ${new Date(now.getTime() - KEYWORD_IMPORT_FRESHNESS_MS[window])}`,
        // Only a run that reached every domain counts as current evidence. A partial run is the shape a provider
        // outage or an exhausted account leaves behind, and treating it as current would hold a tenant on a
        // half-measured competitor set for a week with no way back other than waiting it out.
        sql`${keywordImports.status} = 'succeeded'`
      )
    )
    .orderBy(desc(keywordImports.requestedAt))
    .limit(1)

  if (recent !== undefined) {
    const lastImport = await readImportSummary(tenantId, recent.importId)
    if (lastImport !== null) {
      return { outcome: "current", lastImport }
    }
  }

  const ownDomains = await readOwnDomains(tenantId)
  const competitors = await database
    .select({ hostname: tenantCompetitorDomains.hostname })
    .from(tenantCompetitorDomains)
    .where(eq(tenantCompetitorDomains.tenantId, tenantId))

  const targets = [
    ...ownDomains.slice(0, 1).map((domain) => ({ domain, isOwnDomain: true })),
    ...competitors.map(({ hostname }) => ({ domain: hostname, isOwnDomain: false }))
  ]

  const [created] = await database
    .insert(keywordImports)
    .values({
      tenantId,
      provider: keywordProviderName,
      endpoint: rankedKeywordsEndpoint,
      locationName: market.locationName,
      languageCode: market.languageCode,
      trigger,
      status: "running",
      requestedAt: now
    })
    .returning({ importId: keywordImports.importId })

  if (created === undefined) {
    throw new Error("Could not open a keyword import")
  }

  return { outcome: "started", plan: { tenantId, importId: created.importId, market, targets } }
}

/** Records what one domain returned. Observations are inserted once and never revised. */
export async function recordKeywordImportDomain(
  plan: KeywordImportPlan,
  target: { domain: string; isOwnDomain: boolean },
  outcome:
    | { status: "succeeded"; cost: number; normalized: NormalizedDomainKeywords }
    | { status: "failed"; cost: number; errorCode: string }
) {
  const observations: KeywordObservation[] = outcome.status === "succeeded" ? outcome.normalized.observations : []

  await database.transaction(async (transaction) => {
    await transaction.insert(keywordImportDomains).values({
      tenantId: plan.tenantId,
      importId: plan.importId,
      domain: target.domain,
      isOwnDomain: target.isOwnDomain,
      domainRank: outcome.status === "succeeded" ? outcome.normalized.domainRank : null,
      status: outcome.status,
      rowCount: observations.length,
      availableRowCount: outcome.status === "succeeded" ? outcome.normalized.availableRowCount : null,
      cost: outcome.cost.toFixed(6),
      errorCode: outcome.status === "failed" ? outcome.errorCode : null
    })

    for (let index = 0; index < observations.length; index += 500) {
      await transaction.insert(keywordObservations).values(
        observations.slice(index, index + 500).map((observation) => ({
          ...observation,
          tenantId: plan.tenantId,
          importId: plan.importId,
          isOwnDomain: target.isOwnDomain
        }))
      )
    }
  })
}

/** Closes a run by totalling what its requests actually did, rather than by trusting what they were asked to do. */
export async function completeKeywordImport(plan: KeywordImportPlan, now: Date = new Date()) {
  const [totals] = await database
    .select({
      rowCount: sql<number>`coalesce(sum(${keywordImportDomains.rowCount}), 0)::int`,
      cost: sql<string>`coalesce(sum(${keywordImportDomains.cost}), 0)::text`,
      failedCount: sql<number>`count(*) filter (where ${keywordImportDomains.status} = 'failed')::int`,
      succeededCount: sql<number>`count(*) filter (where ${keywordImportDomains.status} = 'succeeded')::int`,
      firstError: sql<string | null>`(array_remove(array_agg(${keywordImportDomains.errorCode}), null))[1]`
    })
    .from(keywordImportDomains)
    .where(and(eq(keywordImportDomains.tenantId, plan.tenantId), eq(keywordImportDomains.importId, plan.importId)))

  const failedCount = totals?.failedCount ?? 0
  const succeededCount = totals?.succeededCount ?? 0
  const statuses = { allFailed: succeededCount === 0, someFailed: failedCount > 0 }
  let status: z.infer<typeof ImportStatusSchema> = "succeeded"
  if (statuses.allFailed) {
    status = "failed"
  } else if (statuses.someFailed) {
    status = "partial"
  }

  await database
    .update(keywordImports)
    .set({
      status,
      completedAt: now,
      rowCount: totals?.rowCount ?? 0,
      cost: totals?.cost ?? "0",
      errorCode: totals?.firstError ?? null
    })
    .where(and(eq(keywordImports.tenantId, plan.tenantId), eq(keywordImports.importId, plan.importId)))

  return readImportSummary(plan.tenantId, plan.importId)
}

/** Marks a run that could not proceed at all, so a failed attempt never masquerades as current evidence. */
export async function failKeywordImport(plan: KeywordImportPlan, errorCode: string, now: Date = new Date()) {
  await database
    .update(keywordImports)
    .set({ status: "failed", completedAt: now, errorCode })
    .where(and(eq(keywordImports.tenantId, plan.tenantId), eq(keywordImports.importId, plan.importId)))
}
