import {
  beginKeywordImport,
  completeKeywordImport,
  failKeywordImport,
  recordKeywordImportDomain
} from "../persistence/keyword-repository.server"
import type { KeywordImportSummary } from "../persistence/keyword-repository.server"
import { KeywordProviderError, fetchRankedKeywords } from "./dataforseo.server"
import { deriveOpportunities } from "./derive.server"
import { normalizeRankedKeywords } from "./normalize"
import { findProviderLocationName } from "./supported-markets.server"

/**
 * How many keywords to buy per domain.
 *
 * Every returned row is billed, so this is a spending decision rather than a technical one. At $0.012 per request and
 * $0.00012 per row this is thirteen cents a domain, and a monthly cadence puts a six-domain tenant near nine dollars a
 * year. It is a ceiling rather than a purchase: only rows that come back are billed, so a niche supplier whose whole
 * qualifying pool is 198 terms bills a fraction of it. The number of competitors, not this cap, is what varies by plan,
 * because cost is very nearly linear in domain count.
 */
export const DEFAULT_ROW_LIMIT_PER_DOMAIN = 1000

/**
 * The narrowest band of a competitor's keywords that can contain something worth writing.
 *
 * Buying a competitor's biggest terms unfiltered returns its brand head and nothing else: on a store ranking for
 * 189,000 terms, the hundred largest were all national brand queries no article can win.
 *
 * Every clause here has to hold in any vertical, because the same filter is sent for a national outdoor retailer and
 * for a niche club supplier. Intent and position qualify a term rather than measure a market, so they travel. The
 * ceiling travels too, but for a subtler reason than it first appears: it removes almost nothing from the pool, 62
 * terms of 27,401 on the largest competitor measured, yet it is the whole reason the purchase returns phrasings
 * instead of brands. Because rows are bought largest demand first, the ceiling is where the sampling starts, not a
 * filter on what qualifies. What it asserts is that above thirty thousand searches a store blog loses regardless of
 * its niche, which is a fact about the result page rather than about the market's size.
 *
 * A demand floor was tried and removed. It looked harmless on the large domains and was: taking the hundred largest
 * terms never reaches a two-hundred-search keyword, so it discarded twenty-two thousand rows that were never going to
 * be bought. On the fencing supplier it was the only thing that mattered, cutting the pool from 198 to 46 and halving
 * what a small store could buy. A floor asserts that a quiet term is not worth writing about, which is a claim about
 * how big the market is, and in a niche the quiet terms are the winnable ones.
 */
const COMPETITOR_FILTERS = [
  ["keyword_data.search_intent_info.main_intent", "=", "informational"],
  "and",
  ["keyword_data.keyword_info.search_volume", "<", 30000],
  "and",
  ["ranked_serp_element.serp_item.rank_absolute", "<=", 50]
]

export type KeywordImportOutcome =
  | { outcome: "current"; lastImport: KeywordImportSummary }
  | { outcome: "imported"; lastImport: KeywordImportSummary | null }

/**
 * Collects what the store and its accepted competitors rank for, and writes it down.
 *
 * One failing domain does not end the run. A competitor that the provider has no data for is an ordinary result, and
 * discarding the domains that did resolve because of it would throw away evidence that was already paid for.
 */
export async function importKeywordEvidence(
  shopDomain: string,
  options: { trigger?: "scheduled" | "manual"; rowLimitPerDomain?: number; force?: boolean } = {}
): Promise<KeywordImportOutcome> {
  const trigger = options.trigger ?? "manual"
  const limit = options.rowLimitPerDomain ?? DEFAULT_ROW_LIMIT_PER_DOMAIN

  const begun = await beginKeywordImport(shopDomain, trigger, { force: options.force })
  if (begun.outcome === "current") {
    return { outcome: "current", lastImport: begun.lastImport }
  }

  const { plan } = begun
  let providerLocationName: string | null
  try {
    providerLocationName = await findProviderLocationName(plan.market)
  } catch (error) {
    await failKeywordImport(plan, "unreachable")
    throw error
  }
  // Nothing here is recoverable by retrying, and every domain would fail identically, so the run ends before it spends
  // anything rather than billing six requests to learn the same thing six times.
  if (providerLocationName === null) {
    await failKeywordImport(plan, "marketUnsupported")
    throw new KeywordProviderError(
      "marketUnsupported",
      `The keyword provider does not measure ${plan.market.locationName} in ${plan.market.languageCode}`
    )
  }

  try {
    for (const target of plan.targets) {
      // Tracked outside the attempt so that a domain which fails after the provider answered still reports what the
      // answer cost. The money left the account whether or not the rows survived.
      let cost = 0
      try {
        const response = await fetchRankedKeywords({
          target: target.domain,
          locationName: providerLocationName,
          languageCode: plan.market.languageCode,
          limit,
          // The store's own domain is bought whole. Where it ranks badly, or on terms nobody would call
          // informational, is exactly what the weak-hold and decay signals are looking for, so narrowing the purchase
          // would discard the evidence about ourselves that we most need.
          ...(target.isOwnDomain ? {} : { filters: COMPETITOR_FILTERS })
        })
        cost = response.cost
        if (response.result === null) {
          await recordKeywordImportDomain(plan, target, {
            status: "failed",
            cost,
            errorCode: "noResult"
          })
          continue
        }
        await recordKeywordImportDomain(plan, target, {
          status: "succeeded",
          cost,
          normalized: normalizeRankedKeywords(response.result, target.domain)
        })
      } catch (error) {
        const errorCode = error instanceof KeywordProviderError ? error.code : "unexpected"
        console.error(`Keyword import failed for ${target.domain}.`, error)
        await recordKeywordImportDomain(plan, target, { status: "failed", cost, errorCode })
      }
    }
  } catch (error) {
    await failKeywordImport(plan, "unexpected")
    throw error
  }

  const lastImport = await completeKeywordImport(plan)

  // Derivation spends nothing and reads only what was already bought, so a failure here must not fail the import: the
  // evidence is on file either way, and the list can be rebuilt from it without going back to the provider.
  try {
    await deriveOpportunities(plan.tenantId, plan.importId)
  } catch (error) {
    console.error(`Could not derive opportunities for import ${plan.importId}.`, error)
  }

  return { outcome: "imported", lastImport }
}
