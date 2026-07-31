import { describe, expect, it } from "vitest"
import { assignReadTooEarly, assignRebinds, assignThenRead, captureThenRead } from "./assignFixtures.tsx"
import { renderDefinition, renderDefinitionValues } from "./reactEmail.ts"

const textOf = (html: string): string =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("assign and capture", () => {
  it("binds a name that a later read resolves", async () => {
    const { html: compiled } = await renderDefinition(assignThenRead)
    const resolved = renderDefinitionValues(assignThenRead)
    expect(textOf(resolved)).toBe(textOf(compiled))
    expect(textOf(resolved)).toContain("ALEX")
  })

  it("lets a second assign win from that point on", async () => {
    const { html: compiled } = await renderDefinition(assignRebinds)
    const resolved = renderDefinitionValues(assignRebinds)
    expect(textOf(resolved)).toBe(textOf(compiled))
    expect(textOf(resolved)).toBe("first second")
  })

  it("captures rendered markup into a name", async () => {
    const { html: compiled } = await renderDefinition(captureThenRead)
    const resolved = renderDefinitionValues(captureThenRead)
    expect(textOf(resolved)).toBe(textOf(compiled))
    expect(textOf(resolved)).toContain("Thanks, Alex")
  })

  it("reports a read that ran before its binding instead of showing an empty preview", () => {
    expect(() => renderDefinitionValues(assignReadTooEarly)).toThrow(/bound later in the same render/)
  })
})
