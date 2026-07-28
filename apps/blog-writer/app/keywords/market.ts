import { z } from "zod"

/**
 * The country and language a keyword figure was measured in. Volume, position, and difficulty are all properties of a
 * market rather than of a term, so nothing keyword-shaped is allowed to exist without one.
 */
export type KeywordMarket = {
  countryCode: string
  languageCode: string
  /**
   * What this country is called when a figure has to be read by a person. The provider has its own name for the same
   * place and does not always agree, so this is never sent to it.
   */
  locationName: string
}

const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/u)
// A few markets are only measured in a regional variant of their language, Chinese in China among them, so a bare
// two-letter code cannot describe every market the provider covers.
const LanguageCodeSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/u)

const countryNames = new Intl.DisplayNames(["en"], { type: "region" })

/**
 * Turns the country Shopify reports for the store and the store's primary locale into a market.
 *
 * Returns null rather than a default when either half is missing or unrecognized. A store selling from a country the
 * provider has no coverage for is a real case, and answering it with United States English would produce figures that
 * look measured and describe a market the merchant does not sell into.
 */
export function resolveKeywordMarket(countryCode: string | null, primaryLocale: string | null): KeywordMarket | null {
  // Shopify reports a locale rather than a language, and the region half of it says where the shop admin is written
  // for rather than where the store sells, which the country half already answers.
  return describeKeywordMarket(countryCode, primaryLocale?.split("-")[0]?.toLowerCase() ?? null)
}

/**
 * Names a country and language pair that has already been decided, whether by Shopify or by the merchant.
 *
 * Kept apart from the resolve above because a stored market must survive a round trip unchanged. Narrowing a language
 * the merchant chose would quietly turn the one market the provider measures Chinese in into one it does not measure
 * at all.
 */
export function describeKeywordMarket(countryCode: string | null, languageCode: string | null): KeywordMarket | null {
  const country = CountryCodeSchema.safeParse(countryCode?.toUpperCase())
  const language = LanguageCodeSchema.safeParse(languageCode)
  if (!country.success || !language.success) {
    return null
  }

  // A region code outside ISO 3166's assigned range is echoed back rather than rejected, so the code coming back
  // unchanged is how an unrecognized country announces itself. The reserved codes are named instead of echoed, and
  // they are left to the provider to refuse, because a store's billing country never carries one.
  const locationName = countryNames.of(country.data)
  if (locationName === undefined || locationName === country.data) {
    return null
  }

  return { countryCode: country.data, languageCode: language.data, locationName }
}
