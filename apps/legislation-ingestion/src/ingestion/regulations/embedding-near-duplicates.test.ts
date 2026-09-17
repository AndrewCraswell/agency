import { expect, it } from "vitest"
import { screenRegulatoryNearDuplicates } from "./embedding-near-duplicates.js"

const row = (versionId: string, body: string, split: "development" | "held-out" = "development") => ({
  versionId,
  body,
  split
})
it("detects normalized Unicode equality across splits without confusing unrelated short inputs", () => {
  const result = screenRegulatoryNearDuplicates([
    row("a", "ＣＡＦÉ, 42!"),
    row("b", "café 42", "held-out"),
    row("c", "other words", "held-out")
  ])
  expect(result.pairs).toEqual([{ versions: ["a", "b"], crossSplit: true, reason: "normalized_equal", jaccard: null }])
  expect(result.crossSplitGroups).toBe(1)
  expect(result.semanticReviewComplete).toBe(false)
})
it("coassigns a transitive chain even when its endpoints are below the similarity threshold", () => {
  const result = screenRegulatoryNearDuplicates([
    row("a", "a b c d e f g h i j k l m n"),
    row("b", "d e f g h i j k l m n o p q"),
    row("c", "g h i j k l m n o p q r s t", "held-out")
  ])
  expect(result.pairs.map((p) => p.versions)).toEqual([
    ["a", "b"],
    ["b", "c"]
  ])
  expect(result.groups).toMatchObject([{ members: ["a", "b", "c"], crossSplit: true }])
})
it("keeps similar historical versions together and produces stable evidence regardless of input order", () => {
  const text =
    "A permit is required within DAYS days of the date of receipt. Applicants must retain the original signed document and provide a copy to the responsible agency upon written request."
  const rows = [row("b", text.replace("DAYS", "30")), row("a", text.replace("DAYS", "60"))]
  expect(screenRegulatoryNearDuplicates(rows)).toEqual(screenRegulatoryNearDuplicates([...rows].reverse()))
  expect(screenRegulatoryNearDuplicates(rows).crossSplitGroups).toBe(0)
  expect(screenRegulatoryNearDuplicates(rows).groups).toHaveLength(1)
  expect(screenRegulatoryNearDuplicates(rows).records[0]?.bodyHash).not.toBe(
    screenRegulatoryNearDuplicates(rows).records[1]?.bodyHash
  )
})
it("rejects conflicting identities, empty lexical content, and excessive aggregate work", () => {
  expect(() => screenRegulatoryNearDuplicates([row("a", "text"), row("a", "changed")])).toThrow(
    "regulatory_duplicate_version_identity"
  )
  expect(() => screenRegulatoryNearDuplicates([row("a", "... ")])).toThrow("regulatory_duplicate_words_required")
  expect(() =>
    screenRegulatoryNearDuplicates(Array.from({ length: 11 }, (_, i) => row(String(i), "x".repeat(200000))))
  ).toThrow("regulatory_duplicate_total_character_limit")
})
