import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { Var } from "./liquid/tags.tsx"
import { definePreview } from "./preview.tsx"
import { templateSamples } from "./samples/templates.ts"
import { defineTemplate } from "./template.ts"

const orderConfirmation = defineTemplate({
  type: "order_confirmation",
  subject: () => "Order confirmed",
  render: (v) => (
    <p>
      Thanks <Var path={v.name} />
    </p>
  )
})

const sample = templateSamples[orderConfirmation.type]

/*
 * Calling the component rather than mounting it: what it returns is a single div carrying the
 * render, so the injected string is the whole of what the dev server shows.
 */
const markupOf = (element: ReactElement) => {
  const props = element.props as { dangerouslySetInnerHTML: { __html: string } }
  return props.dangerouslySetInnerHTML.__html
}

describe("definePreview", () => {
  const Preview = definePreview(orderConfirmation)

  it("names itself after the template, so the dev server lists it by id", () => {
    expect(Preview.displayName).toBe("order_confirmation")
  })

  it("seeds the props panel with the sample shipped for the template's type", () => {
    expect(Preview.PreviewProps.values).toBe(sample)
    expect(Preview.PreviewProps.highlight).toBe(true)
  })

  it("renders what the panel holds rather than the drop", () => {
    const markup = markupOf(Preview({ values: { ...sample, name: "#9001" } }))
    expect(markup).toContain("#9001")
    expect(markup).not.toContain("{{")
  })

  it("marks the drops, which is what the view is for", () => {
    expect(markupOf(Preview({ values: sample }))).toContain("background-color:#fff4d6")
  })

  it("lets the panel turn the marking off, so a test send is worth reading", () => {
    expect(markupOf(Preview({ highlight: false, values: sample }))).not.toContain("background-color:#fff4d6")
  })

  it("takes its default from the definition when the props panel says nothing", () => {
    const plain = definePreview(orderConfirmation, undefined, { highlight: false })
    expect(plain.PreviewProps.highlight).toBe(false)
    expect(markupOf(plain({ values: sample }))).not.toContain("background-color:#fff4d6")
  })
})
