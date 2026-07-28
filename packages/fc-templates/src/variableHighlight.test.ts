import { describe, expect, it } from "vitest"
import { engine } from "./liquid.ts"
import { highlightMarkedVariables, markVariableOutputs, withHighlightStyles } from "./variableHighlight.ts"

async function highlight(source: string, variables: Record<string, unknown> = {}): Promise<string> {
  const { source: marked, expressions } = markVariableOutputs(source)
  return highlightMarkedVariables(await engine.parseAndRender(marked, variables), expressions)
}

describe("markVariableOutputs", () => {
  it("collects the source text of every output", () => {
    expect(markVariableOutputs("<p>{{ order.name }} {{ a | money }}</p>").expressions).toEqual([
      "order.name",
      "a | money"
    ])
  })

  it("keeps whitespace control on the markers rather than the value", async () => {
    await expect(highlight("a  {{- order.name -}}  b", { order: { name: "#1001" } })).resolves.toBe(
      'a<span data-fc-var title="order.name">#1001</span>b'
    )
  })
})

describe("highlightMarkedVariables", () => {
  it("wraps a value that rendered into text", async () => {
    await expect(highlight("<p>Hello {{ name }}</p>", { name: "Alex" })).resolves.toBe(
      '<p>Hello <span data-fc-var title="name">Alex</span></p>'
    )
  })

  it("flags the element instead when the value landed in an attribute", async () => {
    await expect(highlight('<img src="{{ logo }}" alt="Logo" />', { logo: "a.png" })).resolves.toBe(
      '<img data-fc-var src="a.png" alt="Logo" />'
    )
  })

  it("leaves a blank value unhighlighted", async () => {
    await expect(highlight("<p>{{ missing }}</p>")).resolves.toBe("<p></p>")
  })

  it("drops the markers inside a raw-text element", async () => {
    await expect(highlight("<style>.a { color: {{ tint }}; }</style>", { tint: "red" })).resolves.toBe(
      "<style>.a { color: red; }</style>"
    )
  })

  it("escapes an expression before putting it in the title", async () => {
    await expect(highlight(`{{ name | default: "x" }}`, { name: "Alex" })).resolves.toBe(
      '<span data-fc-var title="name | default: &quot;x&quot;">Alex</span>'
    )
  })

  it("renders the same text a bare render does", async () => {
    const source = '<p class="{{ tone }}">Hi {{ name }}, {{ missing }}<br />{{ 500 | money }}</p>'
    const variables = { tone: "warm", name: "Alex" }
    const highlighted = await highlight(source, variables)
    const plain = await engine.parseAndRender(source, variables)
    expect(highlighted.replace(/<span data-fc-var[^>]*>|<\/span>|\sdata-fc-var/g, "")).toBe(plain)
  })
})

describe("withHighlightStyles", () => {
  it("puts the rules in the head of a full document", () => {
    expect(withHighlightStyles("<html><head><title>a</title></head><body></body></html>")).toContain(
      "</title><style data-fc-var-styles>"
    )
  })

  it("prepends them to a fragment that has no head", () => {
    expect(withHighlightStyles("<p>a</p>").startsWith("<style data-fc-var-styles>")).toBe(true)
  })
})
