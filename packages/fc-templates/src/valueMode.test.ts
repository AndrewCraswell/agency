import { templateSamples } from "@repo/shopify-emails"
import { describe, expect, it } from "vitest"
import { orderConfirmation } from "./emails/notifications/orderConfirmation.tsx"
import { renderDefinition, renderDefinitionValues } from "./reactEmail.ts"
import { allTemplates } from "./templates.ts"

/*
 * The guard on the two render paths. Compiling to Liquid and running it must agree with resolving
 * the tree directly, or a preview stops describing what Shopify will send. Markup differs only in
 * incidental whitespace, so both sides are collapsed before comparison.
 */

/*
 * The two paths now run through different renderers, so syntax differs where meaning does not. The
 * compile path is pretty-printed on its way to Liquid, which lowercases attribute names and pads
 * text with the indentation it added, and react-email's renderer leaves marker comments that the
 * static renderer does not. Content and structure are compared; spelling and spacing are not.
 */
const normalise = (html: string): string =>
  html
    .replace(/<!DOCTYPE[^>]*>/i, "")
    .replace(/<!--\$-->|<!--\/\$-->|<!-- -->|<!--\/?(?:html|head|body)-->/g, "")
    /* React 19 hoists a preload for every image, which is a renderer detail rather than content. */
    .replace(/<link [^>]*rel="preload"[^>]*\/?>/g, "")
    /*
     * The preheader is padded with invisible characters to a length that depends on the preview
     * text, so a drop there pads differently before and after Liquid substitutes it.
     */
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    /*
     * A quote inside an attribute is escaped by one renderer and answered with single quotes by the
     * other, so both spellings are brought back to the same one before comparing.
     */
    .replace(/&quot;/g, `"`)
    .replace(/='([^']*)'/g, (_match, value: string) => `="${value}"`)
    .replace(/\s([a-zA-Z][\w-]*)=/g, (_match, name: string) => ` ${name.toLowerCase()}=`)
    .replace(/\s+/g, " ")
    .replace(/\s*\/>/g, "/>")
    .replace(/\s+>/g, ">")
    .replace(/>\s+/g, ">")
    .replace(/\s+</g, "<")
    .trim()

/* A whole email is too long to read in a diff, so a failure reports only where the paths part. */
const firstDifference = (resolved: string, compiled: string): string => {
  const limit = Math.max(resolved.length, compiled.length)
  for (let at = 0; at < limit; at += 1) {
    if (resolved[at] !== compiled[at]) {
      const from = Math.max(0, at - 70)
      return `diverges at ${at}\n compiled: ${compiled.slice(from, at + 70)}\n resolved: ${resolved.slice(from, at + 70)}`
    }
  }
  return ""
}

describe("value mode", () => {
  it("agrees with compiling to Liquid and rendering it", async () => {
    const { html: compiled } = await renderDefinition(orderConfirmation)
    const resolved = renderDefinitionValues(orderConfirmation)
    expect(firstDifference(normalise(resolved), normalise(compiled))).toBe("")
  })

  it("agrees when a pulled order replaces the placeholders", async () => {
    const pulled = { ...templateSamples.order_confirmation, name: "#FC-2001", total_price: 5000 }
    const { html: compiled } = await renderDefinition(orderConfirmation, pulled)
    const resolved = renderDefinitionValues(orderConfirmation, pulled)
    expect(firstDifference(normalise(resolved), normalise(compiled))).toBe("")
  })

  it("resolves drops to values rather than to expressions", () => {
    const html = renderDefinitionValues(orderConfirmation)
    expect(html).toContain("Alex")
    expect(html).toContain("$244.84")
    expect(html).not.toContain("{{")
    expect(html).not.toContain("__LQ_")
  })

  it("resolves a Liquid expression sitting in an attribute", () => {
    const html = renderDefinitionValues(orderConfirmation)
    expect(html).toContain(templateSamples.order_confirmation.order_status_url)
  })
})

/* Every template, so a shared component cannot break one path without breaking a test. */
describe.each(allTemplates.map((template) => [template.id, template] as const))("%s", (_id, template) => {
  it("renders the same markup through both paths", async () => {
    expect(firstDifference(normalise(template.renderValues()), normalise(await template.render()))).toBe("")
  })

  it("leaves no unresolved drop in the resolved markup", () => {
    const html = template.renderValues()
    expect(html).not.toContain("{{")
    expect(html).not.toContain("__LQ_")
  })

  /* The subject ships in its own box in the admin, so nothing in the body would catch a break here. */
  it("renders a subject line with every drop resolved", async () => {
    const subject = await template.renderSubject()
    expect(subject).not.toBe("")
    expect(subject).not.toContain("{{")
    expect(subject).not.toContain("__LQ_")
  })
})
