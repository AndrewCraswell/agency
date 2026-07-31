import { describe, expect, it } from "vitest"
import { shopifyFilterShims } from "./shims.ts"

/*
 * These stand in for filters Shopify applies for real, so what matters is the shape a preview
 * shows: a currency symbol where one appears in the inbox, a CDN path where an image loads from.
 */
const shims = shopifyFilterShims({ currency: "USD", locale: "en-US", timeZone: "UTC" })
const apply = (name: string, value: unknown, ...args: readonly unknown[]) => shims[name]!(value, ...args)

describe("money", () => {
  it("reads an integer as the currency's smallest unit", () => {
    expect(apply("money", 21_400)).toBe("$214.00")
    expect(apply("money_amount", 21_400)).toBe("214.00")
    expect(apply("money_with_currency", 21_400)).toBe("$214.00 USD")
    expect(apply("money_without_currency", 21_400)).toBe("214.00")
  })

  it("drops the trailing zeros only when there is nothing behind them", () => {
    expect(apply("money_without_trailing_zeros", 21_400)).toBe("$214")
    expect(apply("money_without_trailing_zeros", 21_450)).toBe("$214.50")
  })

  it("treats a missing or unreadable amount as nothing owed", () => {
    expect(apply("money", null)).toBe("$0.00")
    expect(apply("money", "not a number")).toBe("$0.00")
  })

  it("appends a unit measurement, and leaves the price alone without one", () => {
    expect(apply("unit_price_with_measurement", 2400, { reference_unit: "kg", reference_value: 1 })).toBe("$24.00/kg")
    expect(apply("unit_price_with_measurement", 2400, { reference_unit: "ml", reference_value: 100 })).toBe(
      "$24.00/100ml"
    )
    expect(apply("unit_price_with_measurement", 2400, { reference_value: 1 })).toBe("$24.00")
    expect(apply("unit_price_with_measurement", 2400)).toBe("$24.00")
  })
})

describe("dates", () => {
  it("renders the formats Shopify names in the shop's settings", () => {
    expect(apply("date", "2027-12-31", "date")).toBe("Dec 31, 2027")
    expect(apply("date", "2027-12-31", "month_day_year")).toBe("December 31, 2027")
    expect(apply("date", "2027-12-31T15:04:00Z", "date_at_time")).toContain("Dec 31, 2027")
  })

  it("takes the format from a named argument as well as a positional one", () => {
    expect(apply("date", "2027-12-31", { format: "month_day_year" })).toBe("December 31, 2027")
  })

  it("spells out the strftime directives the stock templates use", () => {
    const stamp = new Date(2027, 11, 31, 14, 5, 9)
    expect(apply("date", stamp, "%A %a %B %b %d %e %j %m %y %Y")).toBe("Friday Fri December Dec 31 31 31 12 27 2027")
    expect(apply("date", stamp, "%H:%M:%S %I%p %l")).toBe("14:05:09 02PM 2")
  })

  it("leaves an unknown directive and a literal percent as they are", () => {
    expect(apply("date", new Date(2027, 0, 1), "%Q %% %Y")).toBe("%Q % 2027")
  })

  it("reads a bare date in the store's own day rather than shifting it west of Greenwich", () => {
    expect(apply("date", "2027-12-31", "%d")).toBe("31")
  })

  it("resolves the relative names Liquid allows", () => {
    expect(apply("date", "now", "%Y")).toBe(String(new Date().getFullYear()))
    expect(apply("date", "today", "%Y")).toBe(String(new Date().getFullYear()))
  })

  it("renders nothing for a value that is not a date", () => {
    expect(apply("date", "")).toBe("")
    expect(apply("date", null)).toBe("")
    expect(apply("date", "the third of never")).toBe("")
    expect(apply("time_tag", "")).toBe("")
  })

  it("wraps a time tag around the machine-readable stamp", () => {
    expect(apply("time_tag", "2027-12-31T15:04:00Z", "date")).toBe(
      `<time datetime="2027-12-31T15:04:00.000Z">Dec 31, 2027</time>`
    )
  })
})

describe("urls and images", () => {
  it("resolves the platform assets a stock template references", () => {
    expect(apply("shopify_asset_url", "notifications/no-image.png")).toContain("themes_support/notifications/no-image")
    expect(apply("shopify_asset_url", "/notifications/no-image.png")).toContain("themes_support")
  })

  it("guesses a CDN path for anything else, and passes an absolute URL through", () => {
    expect(apply("shopify_asset_url", "custom/logo.png")).toBe("https://cdn.shopify.com/custom/logo.png")
    expect(apply("shopify_asset_url", "https://example.test/logo.png")).toBe("https://example.test/logo.png")
  })

  it("has a real icon for visa and a derived path for every other card", () => {
    expect(apply("payment_icon_png_url", "Visa")).toContain("visa-")
    expect(apply("payment_type_img_url", "bogus")).toBe("https://cdn.shopify.com/payments/bogus.png")
  })

  it("reads an image drop however it arrives", () => {
    expect(apply("image_url", "https://cdn.shopify.com/a.png", "200x")).toBe("https://cdn.shopify.com/a.png?width=200")
    expect(apply("img_url", { src: "https://cdn.shopify.com/b.png" }, { width: 300 })).toBe(
      "https://cdn.shopify.com/b.png?width=300"
    )
    expect(apply("product_img_url", { image: { src: "https://cdn.shopify.com/c.png" } }, "400x400")).toBe(
      "https://cdn.shopify.com/c.png?width=400"
    )
    expect(apply("collection_img_url", { featured_image: "https://cdn.shopify.com/d.png" }, "100x")).toBe(
      "https://cdn.shopify.com/d.png?width=100"
    )
  })

  it("joins the width onto a URL that already carries a query", () => {
    expect(apply("article_img_url", "https://cdn.shopify.com/e.png?v=2", "150x")).toBe(
      "https://cdn.shopify.com/e.png?v=2&width=150"
    )
  })

  it("leaves the source alone when no size was asked for, and returns nothing for no source", () => {
    expect(apply("image_url", "https://cdn.shopify.com/f.png")).toBe("https://cdn.shopify.com/f.png")
    expect(apply("image_url", "", "200x")).toBe("")
  })

  it("builds a Files URL, which is the filter a template holds rather than the URL itself", () => {
    expect(apply("file_url", "shield.png")).toBe("https://cdn.shopify.com/s/files/1/files/shield.png")
    expect(apply("file_img_url", "shield.png", "80x")).toBe(
      "https://cdn.shopify.com/s/files/1/files/shield.png?width=80"
    )
  })

  it("escapes a URL and a query parameter differently, since one keeps its structure", () => {
    expect(apply("url_escape", "https://example.test/a b&c")).toBe("https://example.test/a%20b%26c")
    expect(apply("url_param_escape", "a b&c")).toBe("a%20b%26c")
  })
})

describe("strings and hashes", () => {
  it("groups a gift card code the way it is read aloud", () => {
    expect(apply("format_code", "abcd1234efgh")).toBe("ABCD 1234 EFGH")
  })

  it("lays an address out over the lines a label uses, skipping what is missing", () => {
    expect(
      apply("format_address", {
        address1: "1 Wire Way",
        city: "Woodinville",
        country: "United States",
        first_name: "Robin",
        province_code: "WA",
        zip: "98072"
      })
    ).toBe("Robin<br>1 Wire Way<br>Woodinville, WA, 98072<br>United States")
    expect(apply("format_address", "not an address")).toBe("")
  })

  it("handleizes and camelizes the way Shopify does", () => {
    expect(apply("handleize", "  Épée & Foil!  ")).toBe("p-e-foil")
    expect(apply("camelize", "shop_pay logo-mark")).toBe("ShopPayLogoMark")
  })

  it("round-trips url-safe base64", () => {
    const encoded = apply("base64_url_safe_encode", "sub?ject=a/b+c")
    expect(String(encoded)).not.toMatch(/[+/=]/)
    expect(apply("base64_url_safe_decode", encoded)).toBe("sub?ject=a/b+c")
  })

  it("hashes with the algorithms Shopify exposes", () => {
    expect(apply("md5", "alex@fencing.club")).toMatch(/^[0-9a-f]{32}$/)
    expect(apply("sha1", "alex@fencing.club")).toMatch(/^[0-9a-f]{40}$/)
    expect(apply("hmac_sha1", "message", "key")).toMatch(/^[0-9a-f]{40}$/)
  })

  it("says plainly that blake3 cannot be previewed rather than showing a wrong digest", () => {
    expect(() => apply("blake3", "x")).toThrow(/no Node equivalent/)
  })

  it("reads a metafield through its value, and a plain one directly", () => {
    expect(apply("metafield_text", { value: "engraved" })).toBe("engraved")
    expect(apply("metafield_text", "engraved")).toBe("engraved")
  })

  it("picks the singular only for exactly one", () => {
    expect(apply("pluralize", 1, "item", "items")).toBe("item")
    expect(apply("pluralize", 2, "item", "items")).toBe("items")
  })

  it("falls back to the key's own default, since the shop's translations are not here", () => {
    expect(apply("t", "shopify.email.greeting", { default: "Hello" })).toBe("Hello")
    expect(apply("t", "Hello")).toBe("Hello")
  })

  it("shows nothing where Shopify swaps the drop for an attachment", () => {
    expect(apply("attach_as_pdf", "invoice")).toBe("")
  })
})

describe("weights", () => {
  it("converts grams into the unit the store weighs in", () => {
    expect(apply("weight_with_unit", 2000, "kg")).toBe("2 kg")
    expect(apply("weight_with_unit", 2500, "kg")).toBe("2.5 kg")
    expect(apply("weight_with_unit", 500)).toBe("500 g")
    expect(apply("weight_with_unit", 453.592, "lb")).toBe("1 lb")
  })

  it("leaves an unrecognised unit in grams rather than inventing a factor", () => {
    expect(apply("weight_with_unit", 100, "stone")).toBe("100 stone")
  })
})
