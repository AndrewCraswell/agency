import { describe, expect, it } from "vitest"
import {
  decodeSearchCursor,
  encodeSearchCursor,
  paginateSearchRows,
  reciprocalRankFusion,
  reciprocalRankFusionWithScores
} from "./search.js"

describe("hybrid search ranking", () => {
  it("combines lexical and semantic ranks with deterministic tie-breaking", () => {
    const a = { id: "a" }
    const b = { id: "b" }
    const c = { id: "c" }
    expect(reciprocalRankFusion([a, b], [b, c], 3)).toEqual([b, a, c])
    expect(reciprocalRankFusion([b, a], [a, b], 2)).toEqual([a, b])
  })

  it("returns normalized reciprocal-rank scores", () => {
    const items = reciprocalRankFusionWithScores([{ id: "a" }, { id: "b" }], [{ id: "b" }], 2)

    expect(items[0]?.id).toBe("b")
    expect(items[0]?.score).toBeGreaterThan(items[1]?.score ?? 0)
  })

  it("uses bounded opaque pagination cursors", () => {
    const cursor = encodeSearchCursor(2)

    expect(decodeSearchCursor(cursor)).toBe(2)
    expect(paginateSearchRows(["a", "b", "c", "d"], 2, 1)).toEqual({
      items: ["b", "c"],
      nextCursor: encodeSearchCursor(3),
      truncated: true
    })
    expect(() => decodeSearchCursor(Buffer.from('{"offset":-1}').toString("base64url"))).toThrow(
      "Invalid search cursor"
    )
  })
})
