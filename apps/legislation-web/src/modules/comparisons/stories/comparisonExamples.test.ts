import { createHash } from "node:crypto"
import invariant from "tiny-invariant"
import { expect, it } from "vitest"
import { chapterCollisionExample, federalRevisionExample, stateWordingExample } from "./comparisonExamples"
import capture from "./fixtures/databaseDocuments.json"

it.each([
  ["California amended bill", stateWordingExample],
  ["Federal reported bill", federalRevisionExample],
  ["Chapter 53 regression", chapterCollisionExample]
] as const)("renders complete database text for %s without invented hunks", (_name, example) => {
  const { comparison } = example.state
  const left = capture.documents.find((document) => document.id === comparison.left.id)
  const right = capture.documents.find((document) => document.id === comparison.right.id)
  invariant(left && right)
  expect(comparison.hunks.map((hunk) => hunk.leftText ?? "").join("")).toBe(left.text)
  expect(comparison.hunks.map((hunk) => hunk.rightText ?? "").join("")).toBe(right.text)
  expect(createHash("sha256").update(left.text).digest("hex")).toBe(left.textHash)
  expect(createHash("sha256").update(right.text).digest("hex")).toBe(right.textHash)
  expect(example.leftValidatedSourceUrl).toBe(left.sourceUrl)
  expect(example.rightValidatedSourceUrl).toBe(right.sourceUrl)
})
