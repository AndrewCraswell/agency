/** @jsxRuntime automatic */
/* The loader that runs the build command takes its JSX settings from the consumer's tsconfig, which
 * says nothing about this package's own files, so each one states the runtime it needs. */
import type { ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { runInValueMode } from "./liquid/environment.ts"
import { decorateAttributeDrops } from "./liquid/highlight.tsx"
import type { LiquidEvaluator, TemplateValues } from "./liquid/mode.ts"
import { rootRef } from "./refs/path.ts"
import { templateSamples } from "./samples/templates.ts"
import type { TemplateDefinition } from "./template.ts"
import { toLiquidSource } from "./token.ts"

/*
 * The value half of the two render modes. The tags resolve themselves against an ambient
 * environment, so this only has to install that environment around one synchronous render. The
 * render has to be synchronous: an await would let a second render overlap the first and read its
 * bindings.
 *
 * The tree is built here rather than passed in, because attributes are evaluated as the JSX is
 * constructed. An element handed over ready-made would already have resolved its attributes against
 * no environment at all.
 */

export type ValueRenderOptions = {
  readonly engine: LiquidEvaluator
  readonly values: TemplateValues
  /** Marks each `Var` so a reader can tell a drop from typed copy. Preview only. */
  readonly highlight?: boolean
}

export const renderValues = (build: () => ReactElement, { engine, values, highlight }: ValueRenderOptions): string => {
  const { result, readBeforeBound, unknownDrops } = runInValueMode(
    engine,
    values,
    () => renderToStaticMarkup(build()),
    highlight
  )
  if (readBeforeBound.length > 0) {
    const reads = readBeforeBound.map((expression) => `\`${expression}\``).join(", ")
    throw new Error(
      `${reads} resolved to nothing, and the name was bound later in the same render. A bare liquidValue or liquidExpression call runs while the surrounding JSX is built, which is before any sibling component renders, so read the name with <Var path={…} /> instead.`
    )
  }
  if (unknownDrops.length > 0) {
    const reads = unknownDrops.map((expression) => `\`${expression}\``).join(", ")
    throw new Error(
      `${reads} named nothing the template was given. Liquid prints a missing drop as nothing, so this would render blank on Shopify with no error. Read a name the template's type carries, or stop reading it.`
    )
  }
  /* Only a captured name reaches here as a token, holding markup React would otherwise have escaped. */
  const markup = toLiquidSource(result)
  return highlight === true ? decorateAttributeDrops(markup) : markup
}

export const renderTemplateValues = <TVariables extends object>(
  template: TemplateDefinition<TVariables>,
  engine: LiquidEvaluator,
  values?: TemplateValues,
  highlight?: boolean
): string =>
  renderValues(() => template.render(rootRef<TVariables>()), {
    engine,
    highlight,
    values: values ?? Object.fromEntries(Object.entries(templateSamples[template.type]))
  })
