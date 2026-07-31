import { engine } from "./liquid.ts"
import type { TemplateVariables } from "./types.ts"
import { highlightMarkedVariables, markVariableOutputs } from "./variableHighlight.ts"

export type RenderOptions = {
  /** Marks up every `{{ … }}` output in the body so the viewer can highlight it. */
  highlightVariables?: boolean
}

async function renderHighlighted(source: string, variables: TemplateVariables): Promise<string> {
  const { source: marked, expressions } = markVariableOutputs(source)
  return highlightMarkedVariables(await engine.parseAndRender(marked, variables), expressions)
}

/** Liquid to HTML, with or without the highlight pass. The one place a template body is rendered. */
export async function renderLiquid(
  source: string,
  variables: TemplateVariables,
  options: RenderOptions = {}
): Promise<string> {
  return options.highlightVariables ? renderHighlighted(source, variables) : engine.parseAndRender(source, variables)
}
