import { templateSamples } from "@repo/shopify-emails"
import { describe, expect, it } from "vitest"
import { contactBuyer } from "./emails/notifications/contactBuyer.tsx"
import { orderLink } from "./emails/notifications/orderLink.tsx"
import { renderDefinition, renderDefinitionValues } from "./reactEmail.ts"

/*
 * Escaping, checked without the normalisation the two-path test applies. That normalisation rewrites
 * entities and attribute quotes to reconcile two renderers, which is wide enough to absorb a real
 * change in how a drop is escaped — the one difference that matters when the value is a customer's
 * own text. Here the bytes are read as they are.
 */

const markup = `<script>alert(1)</script>`
const attributeBreak = `https://fencing.club/"onmouseover="x`

describe("a drop carrying markup", () => {
  it("reaches neither path as live markup from a text position", async () => {
    const values = { ...templateSamples.contact_buyer, custom_message: markup }
    const compiled = (await renderDefinition(contactBuyer, values)).html
    const resolved = renderDefinitionValues(contactBuyer, values)
    expect(compiled).not.toContain(markup)
    expect(resolved).not.toContain(markup)
    expect(compiled).toContain("&lt;script&gt;")
  })

  it("cannot break out of an attribute on either path", async () => {
    const values = { ...templateSamples.order_link, order_status_url: attributeBreak }
    const compiled = (await renderDefinition(orderLink, values)).html
    const resolved = renderDefinitionValues(orderLink, values)
    expect(compiled).not.toContain(`"onmouseover="x`)
    expect(resolved).not.toContain(`"onmouseover="x`)
  })
})
