import { describe, expect, it } from "vitest"
import { resolveKeywordMarket } from "./market"

describe("resolveKeywordMarket", () => {
  it("names the country the way the keyword provider does", () => {
    expect(resolveKeywordMarket("US", "en")).toEqual({
      countryCode: "US",
      languageCode: "en",
      locationName: "United States"
    })
    expect(resolveKeywordMarket("GB", "en-GB")).toEqual({
      countryCode: "GB",
      languageCode: "en",
      locationName: "United Kingdom"
    })
  })

  it("keeps the region out of the language, because a market is a country and a language separately", () => {
    expect(resolveKeywordMarket("CA", "fr-CA")).toEqual({
      countryCode: "CA",
      languageCode: "fr",
      locationName: "Canada"
    })
  })

  it("declines rather than defaulting when either half is missing", () => {
    expect(resolveKeywordMarket(null, "en")).toBeNull()
    expect(resolveKeywordMarket("US", null)).toBeNull()
    expect(resolveKeywordMarket("", "")).toBeNull()
  })

  it("declines anything that is not a country code", () => {
    expect(resolveKeywordMarket("USA", "en")).toBeNull()
    expect(resolveKeywordMarket("us1", "en")).toBeNull()
    expect(resolveKeywordMarket("United States", "en")).toBeNull()
  })
})
