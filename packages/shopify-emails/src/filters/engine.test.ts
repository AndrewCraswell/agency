import { Liquid } from "liquidjs"
import { describe, expect, it } from "vitest"
import { filterCatalog } from "./catalog.ts"
import { createShopifyEngine } from "./engine.ts"

const engine = createShopifyEngine()

const render = (source: string, scope: object = {}) => engine.parseAndRenderSync(source, scope)

describe("createShopifyEngine", () => {
  it("formats money from the smallest currency unit", () => {
    expect(render("{{ 21400 | money }}")).toBe("$214.00")
    expect(render("{{ 21400 | money_with_currency }}")).toBe("$214.00 USD")
    expect(render("{{ 21400 | money_without_currency }}")).toBe("214.00")
    expect(render("{{ 21400 | money_without_trailing_zeros }}")).toBe("$214")
  })

  it("prices in whatever currency the store uses", () => {
    const euros = createShopifyEngine({ currency: "EUR", locale: "de-DE" })
    expect(euros.parseAndRenderSync("{{ 21400 | money }}").replace(/\u00a0/g, " ")).toBe("214,00 €")
  })

  it("reads a bare date in the store's own day rather than in UTC", () => {
    expect(render("{{ '2027-12-31' | date: '%B %-d, %Y' | replace: '%-d', '31' }}")).toContain("December")
    expect(render("{{ '2027-12-31' | date: '%B %d, %Y' }}")).toBe("December 31, 2027")
  })

  it("groups a gift card code the way it is read aloud", () => {
    expect(render("{{ 'abcd1234efgh' | format_code }}")).toBe("ABCD 1234 EFGH")
  })

  it("lays an address out over several lines", () => {
    const scope = { address: { address1: "1 Wire Way", city: "Woodinville", first_name: "Robin", zip: "98072" } }
    expect(render("{{ address | format_address }}", scope)).toBe("Robin<br>1 Wire Way<br>Woodinville, 98072")
  })

  it("refuses a theme filter and names the reason", () => {
    expect(() => render("{{ '#fff' | color_darken: 10 }}")).toThrow(/cannot be used in a notification template/)
  })

  it("refuses a liquidjs filter Shopify does not have", () => {
    expect(() => render("{{ 'a b' | slugify }}")).toThrow(/Shopify does not provide/)
  })

  it("classifies every filter liquidjs ships", () => {
    const unclassified = Object.keys(new Liquid().filters).filter((name) => !filterCatalog.has(name))
    /* Each of these previews fine and prints nothing on Shopify, so the engine has to remove them. */
    expect(unclassified).toContain("slugify")
    for (const name of unclassified) {
      expect(() => render(`{{ 'x' | ${name} }}`)).toThrow(/Shopify does not provide/)
    }
  })
})
