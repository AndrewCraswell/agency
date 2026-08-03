import documented from "@shopify/theme-check-docs-updater/data/filters.json" with { type: "json" }
import { describe, expect, it } from "vitest"
import { filterCatalog, filterNames, filterRefusal } from "./catalog.ts"

type DocumentedFilter = { readonly name: string; readonly category: string }

const shopifyFilters = documented as readonly DocumentedFilter[]

/* Not documented because notifications are not part of Shopify's Liquid reference. */
const notificationOnly = ["attach_as_pdf", "cdn_asset_url", "format_code", "payment_icon_png_url", "t"]

describe("the filter catalog", () => {
  it("reads Shopify's own published list", () => {
    expect(shopifyFilters.length).toBeGreaterThan(100)
    expect(shopifyFilters.map((filter) => filter.name)).toContain("money")
  })

  it("classifies every filter Shopify documents", () => {
    const missing = shopifyFilters.map((filter) => filter.name).filter((name) => !filterCatalog.has(name))
    expect(missing).toEqual([])
  })

  it("invents nothing Shopify does not have", () => {
    const documentedNames = new Set(shopifyFilters.map((filter) => filter.name))
    const strays = [...filterCatalog.keys()].filter(
      (name) => !documentedNames.has(name) && !notificationOnly.includes(name)
    )
    expect(strays).toEqual([])
  })

  it("refuses a filter that does not exist", () => {
    expect(filterRefusal("definitely_not_a_filter")).toContain("is not a Shopify Liquid filter")
  })

  it("refuses a theme filter and says why", () => {
    expect(filterRefusal("stylesheet_tag")).toContain("cannot be used in a notification template")
  })

  it("allows the filters the stock notification sources use", () => {
    const used = ["date", "default", "format_address", "format_code", "img_url", "money", "shopify_asset_url"]
    for (const name of used) {
      expect(filterRefusal(name)).toBeUndefined()
    }
  })

  it("keeps the unverified set small enough to be worth reading", () => {
    expect(filterNames("unverified").length).toBeLessThan(12)
  })
})
