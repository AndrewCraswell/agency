import {
  compileSubject,
  compileTemplate,
  renderTemplateValues,
  type TemplateDefinition,
  templateSamples
} from "@repo/shopify-emails"
import { engine, sanitizeForPreview } from "./liquid.ts"
import type { TemplateVariables } from "./types.ts"
import { highlightMarkedVariables, markVariableOutputs } from "./variableHighlight.ts"

/*
 * The bridge between a React-defined template and this package's preview.
 *
 * Two render paths share one tree. `renderDefinition` compiles to Liquid and runs it, which is the
 * same path the committed .liquid files take and the one that produces what gets pasted into the
 * admin. `renderDefinitionValues` resolves the tree directly, which is what a component-level
 * preview needs. The engine is passed in from here because it carries the Shopify filter shims.
 *
 * valueMode.test.ts holds the two paths to the same output, so neither can drift unnoticed.
 */

export type RenderOptions = {
  /** Marks up every `{{ … }}` output in the body so the viewer can highlight it. */
  highlightVariables?: boolean
}

export type DefinitionRender = {
  /** The compiled Liquid, which is exactly what would be pasted into the admin. */
  source: string
  subject: string
  html: string
}

const renderBody = async (source: string, variables: TemplateVariables, options: RenderOptions): Promise<string> => {
  if (!options.highlightVariables) {
    return engine.parseAndRender(source, variables)
  }
  const { source: marked, expressions } = markVariableOutputs(source)
  return highlightMarkedVariables(await engine.parseAndRender(marked, variables), expressions)
}

export const renderDefinition = async <TVariables extends object>(
  definition: TemplateDefinition<TVariables>,
  variables?: TemplateVariables,
  options: RenderOptions = {}
): Promise<DefinitionRender> => {
  const source = await compileTemplate(definition, { pretty: true })
  const values = variables ?? Object.fromEntries(Object.entries(templateSamples[definition.type]))

  const html = await renderBody(sanitizeForPreview(source), values, options)
  const subject = (await engine.parseAndRender(sanitizeForPreview(compileSubject(definition)), values)).trim()

  return { source, subject, html }
}

export const renderDefinitionValues = <TVariables extends object>(
  definition: TemplateDefinition<TVariables>,
  variables?: TemplateVariables
): string =>
  renderTemplateValues(
    definition,
    engine,
    variables ?? Object.fromEntries(Object.entries(templateSamples[definition.type]))
  )
