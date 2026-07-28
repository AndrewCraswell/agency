import { GROUP_SOURCE_DIRS, templates } from "../registry.ts"
import { renderSource } from "../renderSource.ts"
import type { Template, TemplateVariation } from "../types.ts"
import { inlineNotificationStyles, wrapPrintout } from "./previewDocument.ts"
import notificationsCss from "../styles/notifications.css?raw"

/*
 * Storybook has no dev-server middleware to render through once it is built, so the Liquid sources
 * are inlined at bundle time and rendered in the browser instead. The engine and the variables are
 * plain modules, so this produces byte-for-byte what the dev server produces.
 */
const sources = import.meta.glob("../templates/**/*.liquid", {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>

function sourceOf(template: Template): string {
  const key = `../templates/${GROUP_SOURCE_DIRS[template.group]}/${template.dir}/${template.dir}.liquid`
  const source = sources[key]
  if (source === undefined) {
    throw new Error(`No Liquid source bundled for "${template.id}" at ${key}`)
  }
  return source
}

export function templateOf(id: string): Template {
  const template = templates.find((candidate) => candidate.id === id)
  if (!template) {
    throw new Error(`No template with id "${id}"`)
  }
  return template
}

export function variationOf(template: Template, id: string): TemplateVariation {
  const variation = template.variations.find((candidate) => candidate.id === id)
  if (!variation) {
    throw new Error(`Template "${template.id}" has no variation "${id}"`)
  }
  return variation
}

export type BrowserPreview = {
  /** A standalone document, ready to drop into an iframe's `srcdoc`. */
  document: string
  /** The rendered subject line, or an empty string for printouts. */
  subject: string
}

/** Renders one variation entirely in the browser, with nothing left to fetch. */
export async function previewVariation(templateId: string, variationId: string): Promise<BrowserPreview> {
  const template = templateOf(templateId)
  const variation = variationOf(template, variationId)
  const { html, subject } = await renderSource(template, variation, sourceOf(template))

  if (template.type === "printout") {
    return { document: wrapPrintout(template, html), subject }
  }
  return { document: inlineNotificationStyles(html, notificationsCss), subject }
}
