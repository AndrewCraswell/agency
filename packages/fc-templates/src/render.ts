import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { GROUP_SOURCE_DIRS, templates } from "./registry.ts"
import { type RenderedTemplate, type RenderOptions, renderSource } from "./renderSource.ts"
import type { Template, TemplateVariation } from "./types.ts"

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)))
const templatesDir = join(srcDir, "templates")

export const stylesPath = join(srcDir, "styles", "notifications.css")

export type { RenderedTemplate, RenderOptions }

export function templateSourcePath(template: Template): string {
  return join(templatesDir, GROUP_SOURCE_DIRS[template.group], template.dir, `${template.dir}.liquid`)
}

export function findTemplate(id: string): Template | undefined {
  return templates.find((template) => template.id === id)
}

export function findVariation(template: Template, id?: string): TemplateVariation {
  if (!id) {
    return template.variations[0]
  }
  return template.variations.find((variation) => variation.id === id) ?? template.variations[0]
}

/** Render one variation of one template. */
export async function renderTemplate(
  template: Template,
  variation: TemplateVariation,
  options?: RenderOptions
): Promise<RenderedTemplate> {
  return renderSource(template, variation, await readFile(templateSourcePath(template), "utf8"), options)
}

/** Render by ids, the way the preview server and the build both address templates. */
export async function render(
  templateId: string,
  variationId?: string,
  options?: RenderOptions
): Promise<RenderedTemplate> {
  const template = findTemplate(templateId)
  if (!template) {
    throw new Error(`No template with id "${templateId}"`)
  }
  return renderTemplate(template, findVariation(template, variationId), options)
}
