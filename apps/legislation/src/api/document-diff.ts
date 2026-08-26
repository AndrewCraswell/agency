import { createHash } from "node:crypto"
import type { DocumentSummary, SourceReference } from "./canonical-projection.js"

export type DiffGranularity = "paragraph" | "section" | "word"
export type DiffClassification = "added" | "changed" | "removed" | "unchanged"

export interface DiffSection {
  id: string
  ordinal: number
  sectionIdentifier: string | null
  sourceEndOffset: number
  sourceStartOffset: number
  text: string
}

export interface DiffOperation {
  classification: "delete" | "equal" | "insert"
  leftEnd: number | null
  leftStart: number | null
  rightEnd: number | null
  rightStart: number | null
  text: string
}

export interface DiffHunk {
  classification: DiffClassification
  leftSectionId: string | null
  leftText: string | null
  operations: DiffOperation[]
  ordinal: number
  rightSectionId: string | null
  rightText: string | null
  sources: SourceReference[]
}

export interface DocumentDiff {
  billId: string
  counts: Record<DiffClassification, number>
  granularity: DiffGranularity
  hunks: DiffHunk[]
  id: string
  leftDocument: DocumentSummary
  nextCursor: string | null
  rightDocument: DocumentSummary
  truncated: boolean
}

const MAXIMUM_HUNK_CHARACTERS = 200_000
const MAXIMUM_LCS_CELLS = 4_000_000

interface Unit {
  end: number
  start: number
  text: string
}

function units(text: string, granularity: DiffGranularity): Unit[] {
  if (granularity === "section") {
    return text.length === 0 ? [] : [{ end: text.length, start: 0, text }]
  }
  const expression = granularity === "paragraph" ? /[\s\S]+?(?:\n\s*\n|$)/g : /\S+\s*/g
  return [...text.matchAll(expression)].flatMap((match) => {
    const value = match[0]
    const start = match.index
    return value === undefined || start === undefined || value.length === 0
      ? []
      : [{ end: start + value.length, start, text: value }]
  })
}

function appendOperation(
  operations: DiffOperation[],
  classification: DiffOperation["classification"],
  left: Unit | undefined,
  right: Unit | undefined
): void {
  const text = left?.text ?? right?.text
  if (text === undefined) {
    return
  }
  const previous = operations.at(-1)
  const contiguous =
    previous !== undefined &&
    previous.classification === classification &&
    (left === undefined || previous.leftEnd === left.start) &&
    (right === undefined || previous.rightEnd === right.start)
  if (contiguous) {
    previous.text += text
    if (left !== undefined) {
      previous.leftEnd = left.end
    }
    if (right !== undefined) {
      previous.rightEnd = right.end
    }
    return
  }
  operations.push({
    classification,
    leftEnd: left?.end ?? null,
    leftStart: left?.start ?? null,
    rightEnd: right?.end ?? null,
    rightStart: right?.start ?? null,
    text
  })
}

/** Exact LCS diff; offsets refer to the unmodified hunk strings. */
export function diffText(
  leftText: string | null,
  rightText: string | null,
  granularity: DiffGranularity
): DiffOperation[] {
  const left = units(leftText ?? "", granularity)
  const right = units(rightText ?? "", granularity)
  if ((left.length + 1) * (right.length + 1) > MAXIMUM_LCS_CELLS) {
    throw new Error("Document diff hunk exceeds the allowed size")
  }
  const matrix = Array.from({ length: left.length + 1 }, () => Array.from({ length: right.length + 1 }, () => 0))
  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      matrix[leftIndex][rightIndex] =
        left[leftIndex]?.text === right[rightIndex]?.text
          ? (matrix[leftIndex + 1]?.[rightIndex + 1] ?? 0) + 1
          : Math.max(matrix[leftIndex + 1]?.[rightIndex] ?? 0, matrix[leftIndex]?.[rightIndex + 1] ?? 0)
    }
  }
  const operations: DiffOperation[] = []
  let leftIndex = 0
  let rightIndex = 0
  while (leftIndex < left.length || rightIndex < right.length) {
    const leftUnit = left[leftIndex]
    const rightUnit = right[rightIndex]
    if (leftUnit !== undefined && rightUnit !== undefined && leftUnit.text === rightUnit.text) {
      appendOperation(operations, "equal", leftUnit, rightUnit)
      leftIndex += 1
      rightIndex += 1
    } else if (
      rightUnit !== undefined &&
      (leftUnit === undefined ||
        (matrix[leftIndex]?.[rightIndex + 1] ?? 0) >= (matrix[leftIndex + 1]?.[rightIndex] ?? 0))
    ) {
      appendOperation(operations, "insert", undefined, rightUnit)
      rightIndex += 1
    } else if (leftUnit !== undefined) {
      appendOperation(operations, "delete", leftUnit, undefined)
      leftIndex += 1
    }
  }
  return operations
}

function hunkClassification(left: DiffSection | undefined, right: DiffSection | undefined): DiffClassification {
  if (left === undefined) {
    return "added"
  }
  if (right === undefined) {
    return "removed"
  }
  return left.text === right.text ? "unchanged" : "changed"
}

function stablePairs(left: readonly DiffSection[], right: readonly DiffSection[]) {
  const rightByIdentifier = new Map<string, DiffSection>()
  for (const section of right) {
    if (section.sectionIdentifier !== null && !rightByIdentifier.has(section.sectionIdentifier)) {
      rightByIdentifier.set(section.sectionIdentifier, section)
    }
  }
  const matchedRight = new Set<string>()
  const pairs: Array<{ left: DiffSection | undefined; right: DiffSection | undefined }> = []
  for (const leftSection of left) {
    const matched =
      leftSection.sectionIdentifier === null ? undefined : rightByIdentifier.get(leftSection.sectionIdentifier)
    const byOrdinal = right.find((section) => section.ordinal === leftSection.ordinal && !matchedRight.has(section.id))
    const rightSection = matched === undefined || matchedRight.has(matched.id) ? byOrdinal : matched
    if (rightSection !== undefined) {
      matchedRight.add(rightSection.id)
    }
    pairs.push({ left: leftSection, right: rightSection })
  }
  for (const rightSection of right) {
    if (!matchedRight.has(rightSection.id)) {
      pairs.push({ left: undefined, right: rightSection })
    }
  }
  return pairs
}

function sources(
  left: DocumentSummary,
  right: DocumentSummary,
  hasLeft: boolean,
  hasRight: boolean
): SourceReference[] {
  const values = [...(hasLeft ? left.sources : []), ...(hasRight ? right.sources : [])]
  return [...new Map(values.map((source) => [`${source.sourceUrl}|${source.retrievedAt}`, source])).values()]
}

export function buildDocumentDiff(input: {
  billId: string
  granularity: DiffGranularity
  left: { document: DocumentSummary; sections: readonly DiffSection[] }
  right: { document: DocumentSummary; sections: readonly DiffSection[] }
}): Omit<DocumentDiff, "hunks" | "nextCursor" | "truncated"> & { allHunks: DiffHunk[] } {
  const allHunks = stablePairs(input.left.sections, input.right.sections).map(({ left, right }, ordinal) => {
    if ((left?.text.length ?? 0) > MAXIMUM_HUNK_CHARACTERS || (right?.text.length ?? 0) > MAXIMUM_HUNK_CHARACTERS) {
      throw new Error("Document diff hunk exceeds the allowed size")
    }
    return {
      classification: hunkClassification(left, right),
      leftSectionId: left?.id ?? null,
      leftText: left?.text ?? null,
      operations: diffText(left?.text ?? null, right?.text ?? null, input.granularity),
      ordinal,
      rightSectionId: right?.id ?? null,
      rightText: right?.text ?? null,
      sources: sources(input.left.document, input.right.document, left !== undefined, right !== undefined)
    }
  })
  const counts: Record<DiffClassification, number> = { added: 0, changed: 0, removed: 0, unchanged: 0 }
  for (const hunk of allHunks) {
    counts[hunk.classification] += 1
  }
  return {
    allHunks,
    billId: input.billId,
    counts,
    granularity: input.granularity,
    id: createHash("sha256")
      .update(
        `${input.billId}\u0000${input.left.document.id}\u0000${input.right.document.id}\u0000${input.granularity}`
      )
      .digest("base64url"),
    leftDocument: input.left.document,
    rightDocument: input.right.document
  }
}
