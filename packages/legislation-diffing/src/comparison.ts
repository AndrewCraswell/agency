import { createTwoFilesPatch, diffArrays } from "diff"
import { z } from "zod"

export type DiffGranularity = "paragraph" | "word"
export type DiffClassification = "added" | "changed" | "removed" | "unchanged"

export type ComparisonDocument = {
  id: string
  contentHash: string
  text: string
}

export type DiffOperation = {
  classification: "equal" | "delete" | "insert"
  text: string
  leftStart: number | null
  leftEnd: number | null
  rightStart: number | null
  rightEnd: number | null
}

export type DiffHunk = {
  ordinal: number
  classification: DiffClassification
  leftText: string | null
  rightText: string | null
  leftStart: number | null
  leftEnd: number | null
  rightStart: number | null
  rightEnd: number | null
  operations: DiffOperation[]
}

type ComparisonSource = {
  id: string
  contentHash: string
  textLength: number
}

export type DocumentComparison = {
  granularity: DiffGranularity
  left: ComparisonSource
  right: ComparisonSource
  counts: Record<DiffClassification, number>
  hunks: DiffHunk[]
  unifiedDiff: string
}

export type ComparisonLimits = {
  maxDocumentCharacters: number
  maxBlocks: number
  maxTokens: number
  maxEditDistance: number
  timeoutMs: number
}

export type CompareDocumentsOptions = {
  left: ComparisonDocument
  right: ComparisonDocument
  granularity?: DiffGranularity
  limits?: Partial<ComparisonLimits>
}

export type DocumentDiffErrorCode = "invalid_input" | "resource_limit"

export class DocumentDiffError extends Error {
  readonly code: DocumentDiffErrorCode

  constructor(code: DocumentDiffErrorCode, message: string) {
    super(message)
    this.name = "DocumentDiffError"
    this.code = code
  }
}

export const DEFAULT_COMPARISON_LIMITS: Readonly<ComparisonLimits> = Object.freeze({
  maxDocumentCharacters: 2_000_000,
  maxBlocks: 20_000,
  maxTokens: 200_000,
  maxEditDistance: 4_096,
  timeoutMs: 2_000
})

const documentSchema = z.object({
  id: z.string(),
  contentHash: z.string(),
  text: z.string()
})

function limitSchema(maximum: number) {
  return z.number().int().min(0).max(maximum).default(maximum)
}

const limitsSchema = z.strictObject({
  maxDocumentCharacters: limitSchema(DEFAULT_COMPARISON_LIMITS.maxDocumentCharacters),
  maxBlocks: limitSchema(DEFAULT_COMPARISON_LIMITS.maxBlocks),
  maxTokens: limitSchema(DEFAULT_COMPARISON_LIMITS.maxTokens),
  maxEditDistance: limitSchema(DEFAULT_COMPARISON_LIMITS.maxEditDistance),
  timeoutMs: limitSchema(DEFAULT_COMPARISON_LIMITS.timeoutMs)
})

const optionsSchema = z.strictObject({
  left: documentSchema,
  right: documentSchema,
  granularity: z.enum(["paragraph", "word"]).default("paragraph"),
  limits: limitsSchema.prefault({})
})

type ComparisonContext = {
  limits: ComparisonLimits
  deadline: number
  blocks: number
  tokens: number
}

function remainingTime(context: ComparisonContext) {
  const remaining = context.deadline - Date.now()
  if (remaining <= 0) {
    throw new DocumentDiffError("resource_limit", "The comparison exceeds the time limit.")
  }
  return remaining
}

function splitBlocks(text: string, context: ComparisonContext) {
  const blocks: string[] = []
  let blockStart = 0
  let lineStart = 0
  let hasBoundary = false

  function finishBlock(end: number) {
    context.blocks += 1
    if (context.blocks > context.limits.maxBlocks) {
      throw new DocumentDiffError("resource_limit", "The comparison exceeds the combined block limit.")
    }
    blocks.push(text.slice(blockStart, end))
    blockStart = end
  }

  for (const match of text.matchAll(/\r\n|[\r\n\u2028\u2029]/gu)) {
    remainingTime(context)
    const isBlankLine = text.slice(lineStart, match.index).trim().length === 0
    if (hasBoundary && !isBlankLine) {
      finishBlock(lineStart)
      hasBoundary = false
    }
    if (isBlankLine || match[0] === "\u2029") {
      hasBoundary = true
    }
    lineStart = match.index + match[0].length
  }

  if (hasBoundary && text.slice(lineStart).trim().length > 0) {
    finishBlock(lineStart)
  }
  if (blockStart < text.length) {
    finishBlock(text.length)
  }
  return blocks
}

function splitWords(text: string, context: ComparisonContext) {
  const tokens: string[] = []
  for (const match of text.matchAll(/[\p{L}\p{N}\p{M}_]+|\s+|[^\p{L}\p{N}\p{M}_\s]/gu)) {
    remainingTime(context)
    context.tokens += 1
    if (context.tokens > context.limits.maxTokens) {
      throw new DocumentDiffError("resource_limit", "The comparison exceeds the word-token limit.")
    }
    tokens.push(match[0])
  }
  return tokens
}

function alignTokens(left: string[], right: string[], context: ComparisonContext) {
  const changes = diffArrays(left, right, {
    maxEditLength: context.limits.maxEditDistance,
    timeout: remainingTime(context)
  })
  if (changes === undefined) {
    throw new DocumentDiffError("resource_limit", "The comparison exceeds the edit-distance or time limit.")
  }
  remainingTime(context)
  return changes
}

function operation(
  classification: DiffOperation["classification"],
  text: string,
  leftOffset: number,
  rightOffset: number
): DiffOperation {
  const hasLeft = classification !== "insert"
  const hasRight = classification !== "delete"
  return {
    classification,
    text,
    leftStart: hasLeft ? leftOffset : null,
    leftEnd: hasLeft ? leftOffset + text.length : null,
    rightStart: hasRight ? rightOffset : null,
    rightEnd: hasRight ? rightOffset + text.length : null
  }
}

function refineWords(left: string, right: string, leftStart: number, rightStart: number, context: ComparisonContext) {
  const changes = alignTokens(splitWords(left, context), splitWords(right, context), context)
  const operations: DiffOperation[] = []
  let leftOffset = leftStart
  let rightOffset = rightStart
  for (const change of changes) {
    const text = change.value.join("")
    let classification: DiffOperation["classification"] = "equal"
    if (change.removed) {
      classification = "delete"
    } else if (change.added) {
      classification = "insert"
    }
    operations.push(operation(classification, text, leftOffset, rightOffset))
    if (!change.added) {
      leftOffset += text.length
    }
    if (!change.removed) {
      rightOffset += text.length
    }
  }
  return operations
}

function hunkClassification(left: string | null, right: string | null): DiffClassification {
  if (left === null) {
    return "added"
  }
  if (right === null) {
    return "removed"
  }
  return left === right ? "unchanged" : "changed"
}

function describeSource(document: ComparisonDocument): ComparisonSource {
  return {
    id: document.id,
    contentHash: document.contentHash,
    textLength: document.text.length
  }
}

export function compareDocuments(options: CompareDocumentsOptions): DocumentComparison {
  const startedAt = Date.now()
  const parsed = optionsSchema.safeParse(options)
  if (!parsed.success) {
    throw new DocumentDiffError(
      "invalid_input",
      "Expected text documents, paragraph or word granularity, and finite integer limits within the supported caps."
    )
  }
  const { left, right, granularity, limits } = parsed.data
  if (left.text.length > limits.maxDocumentCharacters || right.text.length > limits.maxDocumentCharacters) {
    throw new DocumentDiffError("resource_limit", "A document exceeds the character limit.")
  }

  const context: ComparisonContext = {
    limits,
    deadline: startedAt + limits.timeoutMs,
    blocks: 0,
    tokens: 0
  }
  remainingTime(context)
  const leftBlocks = splitBlocks(left.text, context)
  const rightBlocks = splitBlocks(right.text, context)
  const hunks: DiffHunk[] = []
  const counts: Record<DiffClassification, number> = {
    added: 0,
    changed: 0,
    removed: 0,
    unchanged: 0
  }
  let leftOffset = 0
  let rightOffset = 0

  function appendHunk(leftText: string | null, rightText: string | null, operations: DiffOperation[]) {
    remainingTime(context)
    const classification = hunkClassification(leftText, rightText)
    hunks.push({
      ordinal: hunks.length,
      classification,
      leftText,
      rightText,
      leftStart: leftText === null ? null : leftOffset,
      leftEnd: leftText === null ? null : leftOffset + leftText.length,
      rightStart: rightText === null ? null : rightOffset,
      rightEnd: rightText === null ? null : rightOffset + rightText.length,
      operations
    })
    counts[classification] += 1
    leftOffset += leftText?.length ?? 0
    rightOffset += rightText?.length ?? 0
  }

  function appendRegion(removed: string[], added: string[]) {
    if (granularity === "paragraph" && (removed.length > 1 || added.length > 1)) {
      for (const text of removed) {
        appendHunk(text, null, [operation("delete", text, leftOffset, rightOffset)])
      }
      for (const text of added) {
        appendHunk(null, text, [operation("insert", text, leftOffset, rightOffset)])
      }
      return
    }
    if (removed.length === 0) {
      for (const text of added) {
        appendHunk(null, text, [operation("insert", text, leftOffset, rightOffset)])
      }
      return
    }
    if (added.length === 0) {
      for (const text of removed) {
        appendHunk(text, null, [operation("delete", text, leftOffset, rightOffset)])
      }
      return
    }
    const leftText = removed.join("")
    const rightText = added.join("")
    const operations =
      granularity === "word"
        ? refineWords(leftText, rightText, leftOffset, rightOffset, context)
        : [
            operation("delete", leftText, leftOffset, rightOffset),
            operation("insert", rightText, leftOffset, rightOffset)
          ]
    appendHunk(leftText, rightText, operations)
  }

  if (leftBlocks.length === 0 || rightBlocks.length === 0) {
    appendRegion(leftBlocks, rightBlocks)
  } else {
    const changes = alignTokens(leftBlocks, rightBlocks, context)
    let removed: string[] = []
    let added: string[] = []
    for (const change of changes) {
      if (change.removed) {
        removed.push(...change.value)
      } else if (change.added) {
        added.push(...change.value)
      } else {
        appendRegion(removed, added)
        removed = []
        added = []
        for (const text of change.value) {
          appendHunk(text, text, [operation("equal", text, leftOffset, rightOffset)])
        }
      }
    }
    appendRegion(removed, added)
  }

  remainingTime(context)
  const patch = createTwoFilesPatch("a/document.txt", "b/document.txt", left.text, right.text, undefined, undefined, {
    context: 3,
    maxEditLength: left.text.length && right.text.length ? limits.maxEditDistance : undefined,
    timeout: remainingTime(context)
  })
  if (patch === undefined) {
    throw new DocumentDiffError("resource_limit", "The line comparison exceeds the edit-distance or time limit.")
  }
  return {
    granularity,
    left: describeSource(left),
    right: describeSource(right),
    counts,
    hunks,
    unifiedDiff: `diff --git a/document.txt b/document.txt\n${patch}`
  }
}
