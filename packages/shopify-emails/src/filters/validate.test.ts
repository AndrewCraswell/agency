import { describe, expect, it } from "vitest"
import { assertFiltersApply, assertFiltersAreAvailable, filterNamesIn, filtersIn } from "./validate.ts"

describe("filterNamesIn", () => {
  it("finds a filter in a drop and in a tag", () => {
    const source = "{{ order.total_price | money }}{% assign name = shop.name | upcase %}"
    expect(filterNamesIn(source)).toEqual(["money", "upcase"])
  })

  it("reads a chain in the order Shopify applies it", () => {
    expect(filterNamesIn("{{ x | strip | truncate: 10 }}")).toEqual(["strip", "truncate"])
  })

  it("ignores a pipe inside a quoted argument", () => {
    expect(filterNamesIn("{{ x | replace: ' | ', ' - ' }}")).toEqual(["replace"])
  })

  it("ignores a pipe in ordinary copy", () => {
    expect(filterNamesIn("<p>Sizes | Colours</p>")).toEqual([])
  })
})

describe("assertFiltersAreAvailable", () => {
  it("passes a template that only uses filters a notification has", () => {
    expect(() => assertFiltersAreAvailable("{{ total | money }}", "order_confirmation")).not.toThrow()
  })

  it("names the template and the reason when a theme filter slips in", () => {
    expect(() => assertFiltersAreAvailable("{{ settings.bg | color_darken: 10 }}", "order_confirmation")).toThrow(
      /order_confirmation uses a filter it cannot/
    )
  })

  it("catches a filter that does not exist at all", () => {
    expect(() => assertFiltersAreAvailable("{{ x | slugify }}", "store_receipt")).toThrow(/not a Shopify Liquid filter/)
  })
})

describe("filtersIn", () => {
  it("reads a bare expression, which is what a ref carries before it becomes a tag", () => {
    expect(filtersIn("order.total_price | money")).toEqual(["money"])
    expect(filtersIn("'now' | date: '%Y'")).toEqual(["date"])
    expect(filtersIn("customer.name")).toEqual([])
  })
})

describe("assertFiltersApply", () => {
  it("names the drop rather than the template, since that is what a reader has to go and fix", () => {
    expect(() => assertFiltersApply(["color_darken"], "shop.brand_color")).toThrow(
      /`shop.brand_color` uses a filter it cannot/
    )
  })

  it("says nothing about a filter a notification has", () => {
    expect(() => assertFiltersApply(["money"], "total_price")).not.toThrow()
  })

  it("reads the name off a filter that carries its arguments", () => {
    expect(() => assertFiltersApply(["date: '%B %e, %Y'", "default: shop.url"], "expires_on")).not.toThrow()
    expect(() => assertFiltersApply(["color_darken: 10"], "shop.brand_color")).toThrow(/"color_darken"/)
  })

  it("reports each refusal once, however often the filter is repeated", () => {
    expect(() => assertFiltersApply(["slugify", "slugify"], "x")).toThrow(
      /^`x` uses a filter it cannot: "slugify" is not a Shopify Liquid filter$/
    )
  })
})
