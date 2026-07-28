import { fetchSupportedMarkets } from "./dataforseo.server"
import type { KeywordMarket } from "./market"
import { describeKeywordMarket } from "./market"

/** A market the provider measures, carrying both the name a merchant reads and the name the provider answers to. */
export type SupportedKeywordMarket = KeywordMarket & { providerLocationName: string }

/**
 * How long a read of the provider's coverage is trusted.
 *
 * The list is a catalogue of countries rather than a measurement, and it changes on the order of years. A day is short
 * enough that a newly covered market appears without a deploy and long enough that opening Settings never waits on the
 * provider twice.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

let cache: { markets: SupportedKeywordMarket[]; readAt: number } | null = null

/**
 * The markets a store can be measured in, newest reading first and then cached.
 *
 * Throws when the provider cannot be reached. A caller that only wants to draw a picker should treat that as having no
 * choices to offer rather than as an error worth showing, because the market already on file still works.
 */
export async function listSupportedKeywordMarkets(now = Date.now()): Promise<SupportedKeywordMarket[]> {
  if (cache !== null && now - cache.readAt < CACHE_TTL_MS) {
    return cache.markets
  }

  const pairs = await fetchSupportedMarkets()
  const markets = pairs.flatMap((pair) => {
    const market = describeKeywordMarket(pair.countryCode, pair.languageCode)
    // A country we cannot name is one a merchant cannot recognise in a list, so it is dropped rather than offered
    // under its own code.
    if (market === null) {
      return []
    }
    return [{ ...market, providerLocationName: pair.providerLocationName }]
  })

  markets.sort((left, right) => left.locationName.localeCompare(right.locationName))
  cache = { markets, readAt: now }
  return markets
}

/**
 * What the provider calls the country a market names.
 *
 * Returns null when the pair is not one the provider measures, which is the only honest answer available: asking it
 * about a market it does not cover buys nothing and reports a domain that failed rather than a market that is wrong.
 */
export async function findProviderLocationName(market: KeywordMarket): Promise<string | null> {
  const markets = await listSupportedKeywordMarkets()
  const match = markets.find(
    (candidate) => candidate.countryCode === market.countryCode && candidate.languageCode === market.languageCode
  )
  return match?.providerLocationName ?? null
}
