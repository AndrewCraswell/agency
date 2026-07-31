import { templateSamples } from "@repo/shopify-emails"
import { describe, expect, it } from "vitest"
import { orderConfirmation } from "./emails/notifications/orderConfirmation.tsx"
import { renderDefinition } from "./reactEmail.ts"

describe("renderDefinition", () => {
  it("compiles the React tree to the Liquid that would be pasted into the admin", async () => {
    const { source } = await renderDefinition(orderConfirmation)

    expect(source).toContain("{% for line_items_item in line_items %}")
    expect(source).toContain("{{ line_items_item.final_line_price | money | escape }}")
    expect(source).toContain("{% if shipping_price > 0 %}")
    expect(source).not.toContain("__LQ_")
  })

  it("renders that Liquid with the sample so the preview shows real values", async () => {
    const { html, subject } = await renderDefinition(orderConfirmation)

    expect(subject).toBe("Order #1001 confirmed")
    expect(html).toContain("Alex")
    expect(html).toContain("Ridgeline Backpack")
    expect(html).toContain("$244.84")
    expect(html).not.toContain("{{")
  })

  it("highlights every drop when the viewer asks for it", async () => {
    const { html } = await renderDefinition(orderConfirmation, undefined, { highlightVariables: true })

    expect(html).toContain("data-fc-var")
  })

  it("renders a pulled order in place of the placeholders", async () => {
    const pulled = { ...templateSamples.order_confirmation, name: "#FC-2001", total_price: 5000 }
    const { html, subject } = await renderDefinition(orderConfirmation, pulled)

    expect(subject).toBe("Order #FC-2001 confirmed")
    expect(html).toContain("$50.00")
  })
})
