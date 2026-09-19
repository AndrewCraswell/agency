import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { applyReviewedPeopleRoles } from "./people-role-review.js"

const role = {
  type: "upper",
  jurisdiction: "ocd-jurisdiction/country:us/state:wa/government",
  district: "1",
  start_date: "2025-01-13",
  end_date: "2025-04-23"
}
const file = {
  path: "data/wa/retired/example.yml",
  content: JSON.stringify({
    id: "ocd-person/example",
    name: "Unchanged",
    roles: [role],
    other_names: [{ name: "Alias" }]
  })
}
const review = {
  state: "wa",
  revision: "a".repeat(40),
  path: file.path,
  sourceSha256: createHash("sha256").update(file.content).digest("hex"),
  personId: "ocd-person/example",
  changes: [
    {
      before: role,
      after: { ...role, end_date: "2025-04-19" },
      evidenceUrls: ["https://example.org/evidence"],
      reason: "Source-backed date correction"
    }
  ]
}
const apply = (data: unknown = [review], input = file) => applyReviewedPeopleRoles(input, "wa", review.revision, data)

describe("source-bound people role reviews", () => {
  it("corrects only exact reviewed roles without mutating immutable input or metadata", () => {
    const result = apply()
    expect(JSON.parse(result.file.content)).toEqual({
      ...JSON.parse(file.content),
      roles: [{ ...role, end_date: "2025-04-19" }]
    })
    expect(JSON.parse(file.content).roles[0].end_date).toBe("2025-04-23")
    expect(apply()).toEqual(result)
    expect(result.review).toEqual(review)
  })
  it("does not apply reviews to another revision, state, or path", () => {
    for (const change of [{ revision: "b".repeat(40) }, { state: "nc" }, { path: "data/wa/retired/other.yml" }]) {
      expect(apply([{ ...review, ...change }])).toEqual({ file, review: null })
    }
  })
  it("rejects source drift and identity changes rather than guessing", () => {
    expect(() => apply([review], { ...file, content: file.content + " " })).toThrow("fingerprint mismatch")
    expect(() => apply([{ ...review, personId: "ocd-person/other" }])).toThrow("identity mismatch")
  })
  it("rejects duplicate reviews, repeated edits and absent role targets", () => {
    expect(() => apply([review, review])).toThrow("Duplicate people role review")
    expect(() => apply([{ ...review, changes: [...review.changes, ...review.changes] }])).toThrow("target is ambiguous")
    expect(() =>
      apply([{ ...review, changes: [{ ...review.changes[0], before: { ...role, district: "2" } }] }])
    ).toThrow("target is ambiguous")
  })
  it("supports evidence-backed removal but never silently retains a deleted assertion", () => {
    expect(
      JSON.parse(apply([{ ...review, changes: [{ ...review.changes[0], after: null }] }]).file.content).roles
    ).toEqual([])
  })
  it("rejects jurisdiction rewrites, invalid dates, reversed periods and missing evidence", () => {
    for (const after of [
      { ...role, jurisdiction: "other" },
      { ...role, end_date: "2025-02-30" },
      { ...role, end_date: "2024-01-01" }
    ]) {
      expect(() => apply([{ ...review, changes: [{ ...review.changes[0], after }] }])).toThrow()
    }
    expect(() => apply([{ ...review, changes: [{ ...review.changes[0], evidenceUrls: [] }] }])).toThrow()
  })
  it("does not modify unreviewed source files", () => {
    expect(apply([])).toEqual({ file, review: null })
  })
})
