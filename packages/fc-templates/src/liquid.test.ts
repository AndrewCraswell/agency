import { describe, expect, it } from "vitest"
import { engine, escapeHtml, sanitizeForPreview } from "./liquid.ts"

async function run(source: string, context: Record<string, unknown> = {}): Promise<string> {
  return engine.parseAndRender(source, context)
}

describe("money filters", () => {
  it("formats cents as US dollars", async () => {
    await expect(run("{{ 18148 | money }}")).resolves.toBe("$181.48")
  })

  it("appends the currency code", async () => {
    await expect(run("{{ 5000 | money_with_currency }}")).resolves.toBe("$50.00 USD")
  })

  it("drops trailing zeros for round amounts", async () => {
    await expect(run("{{ 5000 | money_without_trailing_zeros }}")).resolves.toBe("$50")
  })

  it("treats a missing amount as zero", async () => {
    await expect(run("{{ nothing | money }}")).resolves.toBe("$0.00")
  })
})

describe("asset filters", () => {
  it("maps a known Shopify asset to its CDN url", async () => {
    await expect(run("{{ 'notifications/no-image.png' | shopify_asset_url }}")).resolves.toContain(
      "cdn.shopify.com/shopifycloud"
    )
  })

  it("passes an absolute url straight through", async () => {
    await expect(run("{{ 'https://example.test/a.png' | cdn_asset_url }}")).resolves.toBe("https://example.test/a.png")
  })

  it("returns the Visa artwork for a Visa card", async () => {
    await expect(run("{{ 'Visa' | payment_icon_png_url }}")).resolves.toContain("visa-")
  })

  it("falls back to a payments path for other cards", async () => {
    await expect(run("{{ 'amex' | payment_type_img_url }}")).resolves.toBe("https://cdn.shopify.com/payments/amex.png")
  })

  it("reads a nested product image", async () => {
    const context = { item: { product: { featured_image: "https://example.test/p.png" } } }
    await expect(run("{{ item.product | img_url: 'compact' }}", context)).resolves.toBe("https://example.test/p.png")
  })
})

describe("date filter", () => {
  it("supports strftime directives", async () => {
    const context = { at: "2026-07-26T13:05:00" }
    await expect(run("{{ at | date: '%B %d, %Y at %I:%M %p' }}", context)).resolves.toBe("July 26, 2026 at 01:05 PM")
  })

  it("renders Shopify's named date format", async () => {
    const context = { at: "2026-07-26T13:05:00" }
    await expect(run("{{ at | date: format: 'date' }}", context)).resolves.toBe("Jul 26, 2026")
  })

  it("returns an empty string for a blank value", async () => {
    await expect(run("{{ missing | date: '%Y' }}")).resolves.toBe("")
  })
})

describe("text filters", () => {
  it("groups a gift card code into blocks of four", async () => {
    await expect(run("{{ 'abcd1234efgh' | format_code }}")).resolves.toBe("ABCD 1234 EFGH")
  })

  it("lays an address out over several lines", async () => {
    const context = {
      address: {
        first_name: "Alex",
        last_name: "Morgan",
        address1: "125 Main Street",
        city: "Boston",
        province_code: "MA",
        zip: "02110",
        country: "United States"
      }
    }
    await expect(run("{{ address | format_address }}", context)).resolves.toBe(
      "Alex Morgan<br>125 Main Street<br>Boston, MA, 02110<br>United States"
    )
  })

  it("passes a translation key through untouched", async () => {
    await expect(run("{{ 'Order confirmed' | t }}")).resolves.toBe("Order confirmed")
  })
})

describe("sanitizeForPreview", () => {
  it("collapses the Ruby-style compact.join idiom liquidjs cannot parse", () => {
    const source = "{{ [fulfillment.tracking_company, fulfillment.tracking_number].compact.join(' ') }}"
    expect(sanitizeForPreview(source)).toBe("{{ fulfillment.tracking_company }}")
  })

  it("repairs the stray closing paren in the shipping sources", () => {
    expect(sanitizeForPreview("{{ fulfillment.tracking_url) }}")).toBe("{{ fulfillment.tracking_url }}")
    expect(sanitizeForPreview("{{ fulfillment.tracking_number) }}")).toBe("{{ fulfillment.tracking_number }}")
  })

  it("leaves ordinary Liquid alone", () => {
    expect(sanitizeForPreview("{{ order.name }}")).toBe("{{ order.name }}")
  })
})

describe("escapeHtml", () => {
  it("escapes the characters that would break an attribute or a tag", () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;")
  })
})
