import { engine, sanitizeForPreview } from "./liquid.ts"
import type { Template, TemplateVariables, TemplateVariation } from "./types.ts"
import { highlightMarkedVariables, markVariableOutputs } from "./variableHighlight.ts"

export type RenderOptions = {
  /** Marks up every `{{ … }}` output in the body so the viewer can highlight it. */
  highlightVariables?: boolean
}

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

async function renderHighlighted(source: string, variables: TemplateVariables): Promise<string> {
  const { source: marked, expressions } = markVariableOutputs(source)
  return highlightMarkedVariables(await engine.parseAndRender(marked, variables), expressions)
}

/**
 * Renders one variation from Liquid source that the caller has already loaded. Kept free of
 * `node:fs` so the browser can render the same templates from sources Vite has inlined.
 */
export async function renderSource(
  template: Template,
  variation: TemplateVariation,
  source: string,
  options: RenderOptions = {}
): Promise<RenderedTemplate> {
  const sanitized = sanitizeForPreview(source)
  // The subject is chrome around the preview rather than part of it, so it stays plain text.
  const html = options.highlightVariables
    ? await renderHighlighted(sanitized, variation.variables)
    : await engine.parseAndRender(sanitized, variation.variables)

  let subject = ""
  if (template.type === "email") {
    subject = (await engine.parseAndRender(sanitizeForPreview(template.subject), variation.variables)).trim()
  }

  return { template, variation, source, html, subject }
}
