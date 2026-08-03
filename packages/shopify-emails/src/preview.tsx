/** @jsxRuntime automatic */
/* The loader that runs the build command takes its JSX settings from the consumer's tsconfig, which
 * says nothing about this package's own files, so each one states the runtime it needs. */
import { createShopifyEngine } from "./filters/engine.ts"
import type { LiquidEvaluator, TemplateValues } from "./liquid/mode.ts"
import { previewValues } from "./previewValues.ts"
import { renderTemplateValues } from "./renderValues.tsx"
import { templateSamples } from "./samples/templates.ts"
import type { TemplateDefinition } from "./template.ts"

/*
 * A default export React Email's dev server can render, so a template can be viewed in the same
 * harness as any other React Email component.
 *
 * The variables arrive as props, which is what makes the dev server's props panel an override for
 * the drop: `PreviewProps` seeds the panel with the sample shipped for the template's type, or with
 * a pulled order laid over it, and editing that JSON re-renders against the edit. They sit under
 * `values` so the panel can also carry settings of its own, such as `highlight`, without either
 * shadowing the other.
 *
 * The subject is not shown here. React Email's render keeps only the email document, so anything
 * drawn beside it is discarded, and the harness has no subject chrome of its own.
 *
 * The markup is injected rather than returned as a tree because value mode resolves to a string:
 * its ambient environment lives only for one synchronous render, and a returned tree would render
 * after that environment was gone. The dev server parses the result, so the email's own `html` and
 * `body` collapse into the surrounding document and the preview looks the way the message will.
 *
 * Drops are marked, because telling data from typed copy is what this view is for: a picture of the
 * finished message is something Shopify's own admin already gives, against real orders. The Send
 * button posts the very markup on the page rather than rendering again, so a test send from here
 * carries the marks too. A consumer who would rather send than read passes `{ highlight: false }`,
 * and the props panel switches either default for one render.
 */
export type PreviewOptions = {
  /** Marks each drop so a reader can tell it from typed copy. On unless turned off. */
  readonly highlight?: boolean
}

export type PreviewProps = {
  readonly values: TemplateValues
  readonly highlight?: boolean
}

/* Built once and shared, because constructing an engine per preview re-registers 150-odd filters. */
let sharedEngine: LiquidEvaluator | undefined

export const definePreview = <TVariables extends object>(
  template: TemplateDefinition<TVariables>,
  engine: LiquidEvaluator = (sharedEngine ??= createShopifyEngine()),
  { highlight = true }: PreviewOptions = {}
) => {
  const Preview = ({ values, highlight: enabled = highlight }: PreviewProps) => {
    const markup = renderTemplateValues(template, engine, Object.fromEntries(Object.entries(values)), enabled)
    // oxlint-disable-next-line no-danger -- the markup is this package's own render, not user input.
    return <div dangerouslySetInnerHTML={{ __html: markup }} />
  }
  Preview.displayName = template.id
  Preview.PreviewProps = { highlight, values: previewValues(templateSamples[template.type]) }
  return Preview
}
