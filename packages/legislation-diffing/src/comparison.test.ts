import { applyPatch } from "diff"
import { describe, expect, it, vi } from "vitest"
import {
  compareDocuments,
  DEFAULT_COMPARISON_LIMITS,
  DocumentDiffError,
  type ComparisonDocument,
  type ComparisonLimits,
  type DiffGranularity,
  type DocumentComparison,
  type DocumentDiffErrorCode
} from "./comparison"

function document(text: string, id = "source"): ComparisonDocument {
  return { id, contentHash: `fingerprint:${id}`, text }
}

function compare(left: string, right: string, granularity: DiffGranularity = "paragraph") {
  return compareDocuments({
    left: document(left, "left"),
    right: document(right, "right"),
    granularity
  })
}

function expectExactInputs(result: DocumentComparison, left: string, right: string) {
  let leftOffset = 0
  let rightOffset = 0
  let reconstructedLeft = ""
  let reconstructedRight = ""
  for (const [index, hunk] of result.hunks.entries()) {
    expect(hunk.ordinal).toBe(index)
    let hunkLeft = ""
    let hunkRight = ""
    const leftStart = leftOffset
    const rightStart = rightOffset
    expect(hunk.operations.length).toBeGreaterThan(0)
    for (const operation of hunk.operations) {
      expect(operation.text.length).toBeGreaterThan(0)
      const hasLeft = operation.classification !== "insert"
      const hasRight = operation.classification !== "delete"
      expect(operation.leftStart).toBe(hasLeft ? leftOffset : null)
      expect(operation.leftEnd).toBe(hasLeft ? leftOffset + operation.text.length : null)
      expect(hasLeft ? left.slice(leftOffset, leftOffset + operation.text.length) : null).toBe(
        hasLeft ? operation.text : null
      )
      expect(operation.rightStart).toBe(hasRight ? rightOffset : null)
      expect(operation.rightEnd).toBe(hasRight ? rightOffset + operation.text.length : null)
      expect(hasRight ? right.slice(rightOffset, rightOffset + operation.text.length) : null).toBe(
        hasRight ? operation.text : null
      )
      if (hasLeft) {
        hunkLeft += operation.text
        leftOffset += operation.text.length
      }
      if (hasRight) {
        hunkRight += operation.text
        rightOffset += operation.text.length
      }
    }
    expect(hunk.leftText).toBe(hunkLeft || null)
    expect(hunk.rightText).toBe(hunkRight || null)
    expect(hunk.leftStart).toBe(hunkLeft ? leftStart : null)
    expect(hunk.leftEnd).toBe(hunkLeft ? leftOffset : null)
    expect(hunk.rightStart).toBe(hunkRight ? rightStart : null)
    expect(hunk.rightEnd).toBe(hunkRight ? rightOffset : null)
    reconstructedLeft += hunkLeft
    reconstructedRight += hunkRight
  }
  expect(reconstructedLeft).toBe(left)
  expect(reconstructedRight).toBe(right)
  expect(leftOffset).toBe(left.length)
  expect(rightOffset).toBe(right.length)
  for (const classification of ["added", "changed", "removed", "unchanged"] as const) {
    expect(result.counts[classification]).toBe(
      result.hunks.filter((hunk) => hunk.classification === classification).length
    )
  }
}

function expectDiffError(run: () => unknown, code: DocumentDiffErrorCode) {
  let failure: unknown
  try {
    run()
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(DocumentDiffError)
  expect(failure).toMatchObject({ name: "DocumentDiffError", code })
}

describe("compareDocuments", () => {
  it("provides a standard line patch with inserted lines and unchanged anchors", () => {
    const left = "First.\nRetained.\nLast.\n"
    const right = "First.\nInserted one.\nInserted two.\nRetained.\nLast.\n"
    const result = compare(left, right)
    expect(result.unifiedDiff).toContain("+Inserted one.\n+Inserted two.")
    expect(result.unifiedDiff).toContain(" Retained.")
    expect(applyPatch(left, result.unifiedDiff)).toBe(right)
    expectExactInputs(result, left, right)
  })
  it("defaults to paragraphs and copies caller-supplied source fingerprints without interpretation", () => {
    const left = document("Original text.", "source-left")
    const right = { ...document("Different text.", "source-right"), contentHash: left.contentHash }
    const result = compareDocuments({ left, right })

    expect(result.granularity).toBe("paragraph")
    expect(result.left).toEqual({
      id: left.id,
      contentHash: left.contentHash,
      textLength: left.text.length
    })
    expect(result.right).toEqual({
      id: right.id,
      contentHash: right.contentHash,
      textLength: right.text.length
    })
    expect(result.counts).toEqual({ added: 0, changed: 1, removed: 0, unchanged: 0 })
    expectExactInputs(result, left.text, right.text)
  })

  it("preserves duplicate Chapter 53 references without pairing ownership and whistleblower provisions", () => {
    const preamble = "A bill to improve reporting.\n\n"
    const oldOwnership = "Chapter 53\nOwnership reporting shall occur annually.\n\n"
    const newOwnership = "Chapter 53\nOwnership reporting shall occur quarterly.\n\n"
    const whistleblower = "Chapter 53\nWhistleblower reports remain confidential.\n\n"
    const repeatedReference = "This provision refers to Chapter 53.\n\n"
    const ending = "End of bill."
    const left = preamble + oldOwnership + repeatedReference + whistleblower + repeatedReference + ending
    const right = preamble + newOwnership + repeatedReference + whistleblower + repeatedReference + ending
    const result = compare(left, right, "word")

    expect(result.counts).toEqual({ added: 0, changed: 1, removed: 0, unchanged: 5 })
    const changed = result.hunks.find((hunk) => hunk.classification === "changed")
    expect(changed).toMatchObject({ leftText: oldOwnership, rightText: newOwnership })
    expect(changed?.operations).toContainEqual(expect.objectContaining({ classification: "delete", text: "annually" }))
    expect(changed?.operations).toContainEqual(expect.objectContaining({ classification: "insert", text: "quarterly" }))
    expect(result.hunks).toContainEqual(
      expect.objectContaining({
        classification: "unchanged",
        leftText: whistleblower,
        rightText: whistleblower
      })
    )
    expect(result.hunks.filter((hunk) => hunk.leftText === repeatedReference)).toHaveLength(2)
    expectExactInputs(result, left, right)
  })

  it("keeps duplicate blocks as independent occurrences when only one is removed", () => {
    const repeated = "The report cites Chapter 53.\n\n"
    const left = `Preamble.\n\n${repeated}${repeated}End.`
    const right = `Preamble.\n\n${repeated}End.`
    const result = compare(left, right)

    expect(result.counts).toEqual({ added: 0, changed: 0, removed: 1, unchanged: 3 })
    expect(result.hunks.filter((hunk) => hunk.leftText === repeated)).toHaveLength(2)
    expectExactInputs(result, left, right)
  })

  it.each<DiffGranularity>(["paragraph", "word"])(
    "represents a move as insertion and deletion at %s granularity",
    (granularity) => {
      const moved = "Moved reporting provision.\n\n"
      const first = "First retained provision.\n\n"
      const second = "Second retained provision.\n\n"
      const left = first + second + moved + "End."
      const right = moved + first + second + "End."
      const result = compare(left, right, granularity)

      expect(result.counts).toEqual({ added: 1, changed: 0, removed: 1, unchanged: 3 })
      expect(result.hunks).toContainEqual(
        expect.objectContaining({ classification: "added", leftText: null, rightText: moved })
      )
      expect(result.hunks).toContainEqual(
        expect.objectContaining({ classification: "removed", leftText: moved, rightText: null })
      )
      expectExactInputs(result, left, right)
    }
  )

  it("compares headingless text, preamble and punctuation literally", () => {
    const left = "an unnumbered introduction\n\nwe require annual reports."
    const right = "an updated introduction\n\nwe require annual reports!"
    const result = compare(left, right, "word")

    expect(result.hunks).toHaveLength(1)
    expect(result.hunks[0].operations).toContainEqual(expect.objectContaining({ classification: "delete", text: "." }))
    expect(result.hunks[0].operations).toContainEqual(expect.objectContaining({ classification: "insert", text: "!" }))
    expectExactInputs(result, left, right)
  })

  it.each(["split", "merge"])("preserves a paragraph %s without ordinal pairing", (direction) => {
    const merged = "Preamble.\n\nAlpha beta.\n\nEnd."
    const split = "Preamble.\n\nAlpha\n\nbeta.\n\nEnd."
    const left = direction === "split" ? merged : split
    const right = direction === "split" ? split : merged
    const result = compare(left, right, "word")

    expect(result.counts).toEqual({ added: 0, changed: 1, removed: 0, unchanged: 2 })
    expect(result.hunks[1].operations).toContainEqual(
      expect.objectContaining({ classification: "equal", text: "Alpha" })
    )
    expectExactInputs(result, left, right)
  })

  it("retains leading, trailing and blank-line whitespace without normalization", () => {
    const left = " \t\r\n\r\n  Opening.\r\nwrapped line\r\n \t\r\nLast.  \t"
    const right = "\n  Opening.\r\nwrapped line\r\n\r\nLast.\t "
    const result = compare(left, right, "word")

    expectExactInputs(result, left, right)
    expect(result.counts.changed + result.counts.removed + result.counts.added).toBeGreaterThan(0)
  })

  it("uses unmodified UTF-16 offsets for CRLF, astral characters and combining marks", () => {
    const prefix = "😀 e\u0301\r\n\r\n"
    const left = `${prefix}Rule: café 👩‍⚖️\r\n`
    const right = `${prefix}Rule: cafe\u0301 👩‍⚖️\n`
    const result = compare(left, right, "word")

    expect(result.hunks[1]).toMatchObject({ leftStart: prefix.length, rightStart: prefix.length })
    expect(result.hunks[0]).toMatchObject({ leftEnd: 9, rightEnd: 9 })
    expectExactInputs(result, left, right)
  })

  it("treats Unicode paragraph separators as boundaries and preserves lone carriage returns", () => {
    const text = "First.\u2029Second.\r\rThird.\u2028\u2028Fourth."
    const result = compare(text, text)

    expect(result.hunks.map((hunk) => hunk.leftText)).toEqual([
      "First.\u2029",
      "Second.\r\r",
      "Third.\u2028\u2028",
      "Fourth."
    ])
    expectExactInputs(result, text, text)
  })

  it("does not mistake a single CRLF line ending for a paragraph boundary", () => {
    const text = "A wrapped\r\nparagraph.\r\n"
    const result = compare(text, text)

    expect(result.hunks).toHaveLength(1)
    expectExactInputs(result, text, text)
  })

  it("emits separate unchanged hunks instead of coalescing an identical document", () => {
    const text = "Preamble.\n\nFirst paragraph.\n\nSecond paragraph.\n\nEnd."
    const result = compare(text, text, "word")

    expect(result.counts).toEqual({ added: 0, changed: 0, removed: 0, unchanged: 4 })
    expect(result.hunks.every((hunk) => hunk.operations.length === 1)).toBe(true)
    expectExactInputs(result, text, text)
  })

  it("returns no hunks for two empty texts", () => {
    const result = compare("", "", "word")

    expect(result.hunks).toEqual([])
    expect(result.counts).toEqual({ added: 0, changed: 0, removed: 0, unchanged: 0 })
    expectExactInputs(result, "", "")
  })

  it.each(["added", "removed"])("keeps entirely %s documents at block granularity", (classification) => {
    const text = "Preamble.\n\nFirst paragraph.\n\nLast paragraph."
    const left = classification === "added" ? "" : text
    const right = classification === "added" ? text : ""
    const result = compare(left, right, "word")

    expect(result.hunks).toHaveLength(3)
    expect(result.hunks.every((hunk) => hunk.classification === classification)).toBe(true)
    expectExactInputs(result, left, right)
  })

  it("refines only changed regions when word granularity is selected", () => {
    const left = "Preamble.\n\nThe limit is ten days.\n\nEnd."
    const right = "Preamble.\n\nThe limit is twenty days.\n\nEnd."
    const paragraphs = compare(left, right)
    const words = compare(left, right, "word")

    expect(paragraphs.hunks[1].operations.map((item) => item.classification)).toEqual(["delete", "insert"])
    expect(words.counts).toEqual(paragraphs.counts)
    expect(words.hunks[0]).toEqual(paragraphs.hunks[0])
    expect(words.hunks[2]).toEqual(paragraphs.hunks[2])
    expect(words.hunks[1].operations).toContainEqual(
      expect.objectContaining({ classification: "equal", text: "The limit is " })
    )
    expectExactInputs(paragraphs, left, right)
    expectExactInputs(words, left, right)
  })

  it("is deterministic and does not mutate input documents or limits", () => {
    const left = Object.freeze(document("Repeated.\n\nRepeated.\n\nOld.", "left"))
    const right = Object.freeze(document("Repeated.\n\nNew.\n\nRepeated.", "right"))
    const limits = Object.freeze({ maxDocumentCharacters: 100 })
    const options = Object.freeze({ left, right, limits, granularity: "word" as const })
    const first = compareDocuments(options)

    expect(compareDocuments(options)).toEqual(first)
    expect(limits).toEqual({ maxDocumentCharacters: 100 })
    expectExactInputs(first, left.text, right.text)
  })

  it.each([
    { left: " \t\r\n", right: "\t\n" },
    { left: "漢字。😀", right: "漢字！😀" },
    { left: "\ud800\udfff\ud800", right: "\ud800\udfff" }
  ])("reconstructs unusual literal text without dropping code units %#", ({ left, right }) => {
    expect.hasAssertions()
    expectExactInputs(compare(left, right, "word"), left, right)
  })

  it("keeps unmatched paragraph runs individually addressable without inventing pairs", () => {
    const left = "Old first.\n\nOld second."
    const right = "New first.\n\nNew second.\n\nNew third."
    const result = compare(left, right)
    expect(result.counts).toEqual({ added: 3, removed: 2, changed: 0, unchanged: 0 })
    expectExactInputs(result, left, right)
  })
})

describe("comparison resource bounds", () => {
  it.each(["left", "right"] as const)("rejects oversized %s documents before tokenization", (side) => {
    expect.hasAssertions()
    const options = {
      left: document("x"),
      right: document("x"),
      limits: { maxDocumentCharacters: 1 }
    }
    options[side] = document("xx")

    expectDiffError(() => compareDocuments(options), "resource_limit")
  })

  it("accepts the exact character cap and counts astral characters as two UTF-16 units", () => {
    expect.hasAssertions()
    const source = document("😀")
    expectExactInputs(
      compareDocuments({ left: source, right: source, limits: { maxDocumentCharacters: 2 } }),
      source.text,
      source.text
    )
    expectDiffError(
      () => compareDocuments({ left: source, right: source, limits: { maxDocumentCharacters: 1 } }),
      "resource_limit"
    )
  })

  it("enforces the combined block budget even for identical texts", () => {
    expect.hasAssertions()
    expectDiffError(
      () =>
        compareDocuments({
          left: document("a\n\nb"),
          right: document("a\n\nb"),
          limits: { maxBlocks: 3 }
        }),
      "resource_limit"
    )
    expectExactInputs(
      compareDocuments({
        left: document("a\n\nb"),
        right: document("a\n\nb"),
        limits: { maxBlocks: 4 }
      }),
      "a\n\nb",
      "a\n\nb"
    )
  })

  it("bounds token creation before diffing a changed region", () => {
    expect.hasAssertions()
    expectDiffError(
      () =>
        compareDocuments({
          left: document("one two"),
          right: document("one three"),
          granularity: "word",
          limits: { maxTokens: 5 }
        }),
      "resource_limit"
    )
    expectExactInputs(
      compareDocuments({
        left: document("one two"),
        right: document("one three"),
        granularity: "word",
        limits: { maxTokens: 6 }
      }),
      "one two",
      "one three"
    )
  })

  it("shares the token budget across all changed regions", () => {
    expect.hasAssertions()
    const left = "old\n\nAnchor.\n\nold"
    const right = "new\n\nAnchor.\n\nnew"
    expectDiffError(
      () =>
        compareDocuments({
          left: document(left),
          right: document(right),
          granularity: "word",
          limits: { maxTokens: 5 }
        }),
      "resource_limit"
    )
  })

  it("does not tokenize unchanged or entirely one-sided regions into words", () => {
    expect.hasAssertions()
    const text = "one two\n\nthree four"
    for (const left of ["", text]) {
      const result = compareDocuments({
        left: document(left),
        right: document(text),
        granularity: "word",
        limits: { maxTokens: 0 }
      })
      expectExactInputs(result, left, text)
    }
  })

  it("rejects an expired deadline instead of returning an approximate comparison", () => {
    expect.hasAssertions()
    expectDiffError(
      () =>
        compareDocuments({
          left: document("same"),
          right: document("same"),
          limits: { timeoutMs: 0 }
        }),
      "resource_limit"
    )
  })

  it("uses one overall deadline rather than restarting it during tokenization", () => {
    expect.hasAssertions()
    let elapsed = 0
    const clock = vi.spyOn(Date, "now").mockImplementation(() => elapsed++)
    try {
      expectDiffError(
        () =>
          compareDocuments({
            left: document("a\n\nb\n\nc"),
            right: document("a\n\nb\n\nc"),
            limits: { timeoutMs: 3 }
          }),
        "resource_limit"
      )
    } finally {
      clock.mockRestore()
    }
  })

  it("aborts a block diff at the edit-distance cap", () => {
    expect.hasAssertions()
    expectDiffError(
      () =>
        compareDocuments({
          left: document("old"),
          right: document("new"),
          limits: { maxEditDistance: 1 }
        }),
      "resource_limit"
    )
  })

  it("also bounds edit distance during word refinement", () => {
    expect.hasAssertions()
    expectDiffError(
      () =>
        compareDocuments({
          left: document("a b c"),
          right: document("d e f"),
          granularity: "word",
          limits: { maxEditDistance: 2 }
        }),
      "resource_limit"
    )
  })

  it("allows an empty comparison with zero character, token and edit budgets", () => {
    expect.hasAssertions()
    const result = compareDocuments({
      left: document(""),
      right: document(""),
      limits: {
        maxDocumentCharacters: 0,
        maxBlocks: 0,
        maxTokens: 0,
        maxEditDistance: 0
      }
    })
    expectExactInputs(result, "", "")
  })

  it("allows identical blocks at zero edit distance", () => {
    expect.hasAssertions()
    const text = "same\n\nsame"
    const result = compareDocuments({
      left: document(text),
      right: document(text),
      limits: { maxEditDistance: 0 }
    })
    expectExactInputs(result, text, text)
  })

  it("needs no edit search when one input is empty", () => {
    expect.hasAssertions()
    const result = compareDocuments({
      left: document(""),
      right: document("a\n\nb"),
      limits: { maxEditDistance: 0 }
    })
    expectExactInputs(result, "", "a\n\nb")
  })

  it("exports immutable default safety ceilings", () => {
    expect(Object.isFrozen(DEFAULT_COMPARISON_LIMITS)).toBe(true)
    expect(DEFAULT_COMPARISON_LIMITS).toEqual({
      maxDocumentCharacters: 2_000_000,
      maxBlocks: 20_000,
      maxTokens: 200_000,
      maxEditDistance: 4_096,
      timeoutMs: 2_000
    })
  })
})

describe("comparison input validation", () => {
  const valid = { left: document("text"), right: document("text") }

  it.each([
    undefined,
    null,
    {},
    { left: document("text") },
    { ...valid, left: { id: "id", contentHash: "hash", text: null } },
    { ...valid, right: { id: 1, contentHash: "hash", text: "text" } },
    { ...valid, right: { id: "id", text: "text" } },
    { ...valid, granularity: "section" },
    { ...valid, granularity: null },
    { ...valid, limits: null },
    { ...valid, limits: { unknownLimit: 10 } },
    { ...valid, unexpected: true }
  ])("rejects malformed runtime input %#", (value) => {
    expect.hasAssertions()
    expectDiffError(() => Reflect.apply(compareDocuments, undefined, [value]), "invalid_input")
  })

  it.each<keyof ComparisonLimits>(["maxDocumentCharacters", "maxBlocks", "maxTokens", "maxEditDistance", "timeoutMs"])(
    "rejects invalid and unsupported %s limits",
    (key) => {
      expect.hasAssertions()
      for (const value of [-1, 0.5, Infinity, NaN, "10", DEFAULT_COMPARISON_LIMITS[key] + 1]) {
        expectDiffError(
          () => Reflect.apply(compareDocuments, undefined, [{ ...valid, limits: { [key]: value } }]),
          "invalid_input"
        )
      }
    }
  )
})
