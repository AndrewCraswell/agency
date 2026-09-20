import { createHash } from "node:crypto"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { compareDocuments, DocumentDiffError, type DiffHunk } from "@repo/legislation-diffing/comparison"
import { z } from "zod"
import type { DocumentDiffRead } from "./persistence/queries/document-diff-read"

const identifier = z.string().trim().min(1).max(256)
const requestSchema = z
  .strictObject({
    billId: identifier,
    cursor: z.string().min(1).max(2048).nullable().optional(),
    granularity: z.enum(["paragraph", "word"]).default("paragraph"),
    includeUnchanged: z.boolean().default(false),
    leftDocumentId: identifier,
    limit: z.number().int().min(1).max(100).default(25),
    rightDocumentId: identifier
  })
  .refine((value) => value.leftDocumentId !== value.rightDocumentId, {
    message: "Select two distinct documents."
  })
const cursorSchema = z.strictObject({
  scope: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  comparison: z.string().regex(/^[a-zA-Z0-9_-]{43}$/),
  offset: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
})
const maximumPageBytes = 100_000

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("base64url")
}

function scope(request: z.infer<typeof requestSchema>) {
  const { cursor: _cursor, ...selection } = request
  return fingerprint(selection)
}

function readCursor(request: z.infer<typeof requestSchema>) {
  if (!request.cursor) {
    return undefined
  }
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(request.cursor, "base64url").toString("utf8")))
    if (parsed.scope !== scope(request)) {
      throw new Error("Selection mismatch")
    }
    return parsed
  } catch {
    throw new LegislationError(
      "invalid_request",
      "Comparison cursor does not match the selected documents and options."
    )
  }
}

export function parseDocumentComparisonRequest(input: unknown) {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    throw new LegislationError("invalid_request", parsed.error.issues[0]?.message ?? "Invalid comparison request.")
  }
  readCursor(parsed.data)
  return parsed.data
}

export function createDocumentComparisonPage(
  read: DocumentDiffRead,
  request: ReturnType<typeof parseDocumentComparisonRequest>
) {
  if (
    read.left.document.id !== request.leftDocumentId ||
    read.right.document.id !== request.rightDocumentId ||
    read.left.document.billId !== request.billId ||
    read.right.document.billId !== request.billId
  ) {
    throw new LegislationError("conflict", "Comparison documents do not match the requested bill and versions.")
  }
  for (const side of [read.left, read.right]) {
    if (side.document.processingStatus !== "processed" || !side.text.trim()) {
      throw new LegislationError("conflict", "Both documents must have processed full text before comparison.")
    }
  }
  const leftHash = read.left.document.contentHash
  const rightHash = read.right.document.contentHash
  if (!leftHash || !rightHash || !/^[0-9a-f]{64}$/.test(leftHash) || !/^[0-9a-f]{64}$/.test(rightHash)) {
    throw new LegislationError("unprocessable", "A processed document is missing its source fingerprint.")
  }
  let comparison
  try {
    comparison = compareDocuments({
      left: {
        id: read.left.document.id,
        contentHash: leftHash,
        text: read.left.text
      },
      right: {
        id: read.right.document.id,
        contentHash: rightHash,
        text: read.right.text
      },
      granularity: request.granularity
    })
  } catch (error) {
    if (error instanceof DocumentDiffError) {
      throw new LegislationError(
        error.code === "resource_limit" ? "payload_too_large" : "unprocessable",
        error.message,
        {
          cause: error
        }
      )
    }
    throw error
  }
  const leftTextHash = createHash("sha256").update(read.left.text).digest("hex")
  const rightTextHash = createHash("sha256").update(read.right.text).digest("hex")
  const id = fingerprint({ billId: request.billId, leftTextHash, rightTextHash, comparison })
  const cursor = readCursor(request)
  if (cursor && cursor.comparison !== id) {
    throw new LegislationError("invalid_request", "The compared text changed. Start the comparison again.")
  }
  const visible = request.includeUnchanged
    ? comparison.hunks
    : comparison.hunks.filter((hunk) => hunk.classification !== "unchanged")
  const offset = cursor?.offset ?? 0
  if (cursor && offset >= visible.length) {
    throw new LegislationError("invalid_request", "The comparison cursor is outside the available changes.")
  }
  const base = {
    id,
    billId: request.billId,
    comparisonKind: "literal-text" as const,
    offsetUnit: "utf16-code-unit" as const,
    granularity: comparison.granularity,
    counts: comparison.counts,
    left: comparison.left,
    right: comparison.right,
    leftDocument: read.left.document,
    rightDocument: read.right.document,
    leftTextHash,
    rightTextHash,
    limitations: [
      "Offsets reference the exact stored processed texts, not raw XML bytes or PDF coordinates.",
      "Text additions and deletions are not claims about enactment, repeal or legal effect.",
      "Movement can appear as deletion and insertion; no provision identity or amendment application is inferred."
    ]
  }
  function page(hunks: DiffHunk[]) {
    const hasNext = offset + hunks.length < visible.length
    return {
      ...base,
      hunks,
      truncated: hasNext,
      nextCursor: hasNext
        ? Buffer.from(
            JSON.stringify({ scope: scope(request), comparison: id, offset: offset + hunks.length })
          ).toString("base64url")
        : null
    }
  }
  const hunks: DiffHunk[] = []
  for (const hunk of visible.slice(offset, offset + request.limit)) {
    const candidate = [...hunks, hunk]
    if (Buffer.byteLength(JSON.stringify(page(candidate)), "utf8") > maximumPageBytes) {
      if (!hunks.length) {
        throw new LegislationError(
          "payload_too_large",
          "A comparison hunk exceeds the response budget. Try paragraph granularity or read the source documents."
        )
      }
      break
    }
    hunks.push(hunk)
  }
  const result = page(hunks)
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > maximumPageBytes) {
    throw new LegislationError("payload_too_large", "Comparison metadata exceeds the response budget.")
  }
  return result
}
