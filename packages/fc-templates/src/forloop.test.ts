import { describe, expect, it } from "vitest"
import { forloopByHand, forloopInAttribute, forloopInElements } from "./forloopFixtures.tsx"
import { renderDefinition, renderDefinitionValues } from "./reactEmail.ts"

/*
 * `forloop` reaches the body through the loop ref, and the ambient environment carries the real
 * `forloop` while each iteration builds its nodes, so it resolves in both render modes, in both
 * positions, and through hand-written Liquid.
 */

/* React's `<!-- -->` text separators fall where sibling nodes differ, and no client renders them. */
const rowsOf = (html: string): string[] =>
  html
    .replace(/<!-- -->/g, "")
    .replace(/\s+/g, " ")
    .match(/<tr[\s\S]*?<\/tr>/g)
    ?.map((row) => row.replace(/> </g, "><").replace(/ </g, "<").replace(/> /g, ">")) ?? []

describe("forloop", () => {
  it("agrees between modes in element position", async () => {
    const { html: compiled } = await renderDefinition(forloopInElements)
    const resolved = renderDefinitionValues(forloopInElements)
    expect(rowsOf(resolved)).toStrictEqual(rowsOf(compiled))
    expect(rowsOf(resolved)[0]).toContain("1")
    expect(rowsOf(resolved)[1]).toContain("LAST")
  })

  it("agrees between modes in attribute position", async () => {
    const { html: compiled } = await renderDefinition(forloopInAttribute)
    const resolved = renderDefinitionValues(forloopInAttribute)
    expect(rowsOf(resolved)).toStrictEqual(rowsOf(compiled))
    expect(rowsOf(resolved)[0]).toContain(`data-pos="1"`)
    expect(rowsOf(resolved)[1]).toContain(`data-pos="2"`)
  })

  it("agrees between modes for hand-written Liquid", async () => {
    const { html: compiled } = await renderDefinition(forloopByHand)
    const resolved = renderDefinitionValues(forloopByHand)
    expect(rowsOf(resolved)).toStrictEqual(rowsOf(compiled))
    expect(rowsOf(resolved)[0]).toContain(`data-pos="1"`)
    expect(rowsOf(resolved)[1]).toContain(`data-pos="2"`)
  })
})
