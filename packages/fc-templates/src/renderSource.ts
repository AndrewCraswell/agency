import { engine, sanitizeForPreview } from "./liquid.ts"
import type { Template, TemplateVariation } from "./types.ts"

export type RenderedTemplate = {
  template: Template
  variation: TemplateVariation
  /** The Liquid source exactly as it sits on disk. */
  source: string
  /** The rendered body. For emails this is Shopify's own full HTML document. */
  html: string
  /** The rendered subject line, or an empty string for printouts. */
  subject: string
}

/**
 * Renders one variation from Liquid source that the caller has already loaded. Kept free of
 * `node:fs` so the browser can render the same templates from sources Vite has inlined.
 */
export async function renderSource(
  template: Template,
  variation: TemplateVariation,
  source: string
): Promise<RenderedTemplate> {
  const html = await engine.parseAndRender(sanitizeForPreview(source), variation.variables)

  let subject = ""
  if (template.type === "email") {
    subject = (await engine.parseAndRender(sanitizeForPreview(template.subject), variation.variables)).trim()
  }

  return { template, variation, source, html, subject }
}
