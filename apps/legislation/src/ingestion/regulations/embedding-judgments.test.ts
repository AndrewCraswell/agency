import { describe, expect, it } from "vitest"
import { buildRegulatoryJudgmentPool } from "./embedding-judgments.js"

const manifest = {
  records: ["a", "b", "c"].map((id) => ({ id, versionId: `${id}-version`, input: `source ${id}` })),
  queries: [{ id: "q", input: "question", relevantIds: ["c"] }]
}
const systems = [
  { model: "first", queries: [{ queryId: "q", ranked: [{ id: "a" }, { id: "b" }] }] },
  { model: "second", queries: [{ queryId: "q", ranked: [{ id: "b" }] }] }
]

describe("regulatory relevance review pool", () => {
  it("pools no-answer candidates for blind review without inventing a relevant passage", () => {
    const result = buildRegulatoryJudgmentPool(
      {
        ...manifest,
        queries: [{ id: "q", input: "unsupported question", relevantIds: [], answerability: "no_answer" }]
      },
      systems
    )
    expect(result.queries[0]?.candidates.map((row) => row.id).sort()).toEqual(["a", "b"])
    expect(result.queries[0]?.candidates.every((row) => row.grade === null && row.reviewer === null)).toBe(true)
    expect(result.humanReviewComplete).toBe(false)
  })
  it("retains pooled candidates and missed known answers without exposing ranking or fabricating grades", () => {
    const result = buildRegulatoryJudgmentPool(manifest, systems, 1)
    expect(result.queries[0]?.candidates.map((row) => row.id).sort()).toEqual(["a", "b", "c"])
    expect(
      result.queries[0]?.candidates.every(
        (row) => row.grade === null && row.reviewer === null && row.versionId === `${row.id}-version`
      )
    ).toBe(true)
    expect(JSON.stringify(result.queries)).not.toContain('"model"')
    expect(buildRegulatoryJudgmentPool(manifest, [...systems].reverse(), 1).queries).toEqual(result.queries)
    expect(result.humanReviewComplete).toBe(false)
  })
  it("rejects incomplete systems and unknown or duplicate candidate identities", () => {
    expect(() => buildRegulatoryJudgmentPool(manifest, [{ model: "x", queries: [] }])).toThrow("coverage_mismatch")
    for (const ranked of [[{ id: "unknown" }], [{ id: "a" }, { id: "a" }]]) {
      expect(() =>
        buildRegulatoryJudgmentPool(manifest, [{ model: "x", queries: [{ queryId: "q", ranked }] }])
      ).toThrow("invalid_ranking")
    }
  })
})
