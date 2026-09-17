import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import {
  legalReaderScopeSchema,
  legalTextBlockSchema,
  legalTextWindowSchema,
  type LegalReaderScope,
  type LegalTextBlock
} from "@repo/legislation-core/legal-text/reader-contract"
import invariant from "tiny-invariant"
import { z } from "zod"

export const legalReaderContract = "legal-source-text-2026-09-14"
const maximumBlockCharacters = 16_384
const maximumWindowCharacters = 100_000
const sourceBlocksSchema = regulatoryRecordSchema.shape.blocks
// eCFR can retain a zero-width space in an XML element tail outside the named source blocks.
// Treat only spacing as a gap; append it unchanged so reader offsets and body hashes stay lossless.
const sourceSpacing = /^[\s\u200B]*$/u

/** Normalize stored HTML reader blocks without changing canonical text or its version-bound anchors. */
export function buildStoredLegalTextProjection(input: {
  versionId: string
  body: string
  blocks: unknown
  inputContract: string
}) {
  return buildLegalTextProjection({ ...input, blocks: storedLegalSourceBlocks(input) })
}

export function storedLegalSourceBlocks(input: { body: string; blocks: unknown; inputContract: string }) {
  let blocks = input.blocks
  if (input.inputContract === "fr-html-publication-2026-09-14") {
    const stored = z.array(legalTextBlockSchema).parse(blocks)
    let end = 0
    for (const block of stored) {
      invariant(
        block.start === end && block.kind === "text" && block.sourceOrdinal === null,
        "legal_passage_html_reader_mismatch"
      )
      end = block.end
    }
    invariant(stored.map((block) => block.text).join("") === input.body, "legal_passage_html_reader_mismatch")
    blocks = []
  }
  return sourceBlocksSchema.parse(blocks)
}

/** Lossless source-body projection. No retrieval prefixes, overlap, repeated headers or raw XML delivery. */
export function buildLegalTextProjection(input: { versionId: string; body: string; blocks: unknown }) {
  const versionId = z.string().min(1).max(256).parse(input.versionId)
  invariant(Buffer.byteLength(input.body) <= 64 * 1024 * 1024, "legal_reader_body_limit")
  const sourceBlocks = sourceBlocksSchema.parse(input.blocks)
  const blocks: LegalTextBlock[] = []
  const append = (start: number, end: number, source: (typeof sourceBlocks)[number] | undefined) => {
    while (start < end) {
      let next = Math.min(end, start + maximumBlockCharacters)
      // Keep UTF-16 surrogate pairs together. Offsets are explicit UTF-16 code units, matching JS strings.
      if (
        next < end &&
        /[\uD800-\uDBFF]/.test(input.body[next - 1] ?? "") &&
        /[\uDC00-\uDFFF]/.test(input.body[next] ?? "")
      ) {
        next--
      }
      if (next < end) {
        const newline = input.body.lastIndexOf("\n", next - 1)
        if (newline >= start + maximumBlockCharacters / 2) {
          next = newline + 1
        }
      }
      blocks.push({
        id: digest(JSON.stringify([legalReaderContract, versionId, start, next])),
        sourceOrdinal: source?.ordinal ?? null,
        kind: source?.kind ?? "text",
        tag: source?.tag ?? null,
        start,
        end: next,
        text: input.body.slice(start, next)
      })
      start = next
    }
  }
  let position = 0
  for (const [index, block] of sourceBlocks.entries()) {
    invariant(block.ordinal === index, "legal_reader_source_order_mismatch")
    if (block.text.length === 0) {
      continue
    }
    const start = input.body.indexOf(block.text, position)
    invariant(start >= position, "legal_reader_source_text_mismatch")
    invariant(sourceSpacing.test(input.body.slice(position, start)), "legal_reader_unmapped_source_text")
    append(position, start, undefined)
    const end = start + block.text.length
    append(start, end, block)
    position = end
  }
  invariant(
    sourceBlocks.length === 0 || sourceSpacing.test(input.body.slice(position)),
    "legal_reader_unmapped_source_text"
  )
  append(position, input.body.length, undefined)
  const bodyHash = digest(input.body)
  const blockGeneration = digest(
    JSON.stringify([legalReaderContract, versionId, bodyHash, blocks.map(({ text: _text, ...block }) => block)])
  )
  return { versionId, bodyHash, blockGeneration, readerContract: legalReaderContract, blocks }
}

export type LegalTextProjection = ReturnType<typeof buildLegalTextProjection>
const cursorSchema = z.strictObject({ scope: z.string().regex(/^[a-f0-9]{64}$/), index: z.int().nonnegative() })

/** Caller must authorize current source rights before every call, including continuation and cached projections. */
export function readLegalTextWindow(
  projection: LegalTextProjection,
  input: {
    scope: LegalReaderScope
    limit?: number
    cursor?: string
    anchor?: string
  }
) {
  const limit = z
    .int()
    .min(1)
    .max(100)
    .parse(input.limit ?? 20)
  const access = legalReaderScopeSchema.parse(input.scope)
  invariant(!(input.cursor !== undefined && input.anchor !== undefined), "legal_reader_cursor_anchor_conflict")
  const scope = digest(
    JSON.stringify([projection.readerContract, projection.versionId, projection.blockGeneration, access, limit])
  )
  const encode = (index: number) => Buffer.from(JSON.stringify({ scope, index })).toString("base64url")
  let start = 0
  if (input.cursor !== undefined) {
    invariant(input.cursor.length <= 2048 && /^[A-Za-z0-9_-]+$/.test(input.cursor), "invalid_legal_reader_cursor")
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
    invariant(parsed.success, "invalid_legal_reader_cursor")
    const cursor = parsed.data
    invariant(cursor.scope === scope && cursor.index < projection.blocks.length, "legal_reader_cursor_scope_mismatch")
    start = cursor.index
  } else if (input.anchor !== undefined) {
    start = projection.blocks.findIndex((block) => block.id === input.anchor)
    invariant(start >= 0, "legal_reader_anchor_not_found")
  }
  const blocks: LegalTextBlock[] = []
  let characters = 0
  for (let index = start; index < projection.blocks.length && blocks.length < limit; index++) {
    const block = projection.blocks[index]
    invariant(block, "legal_reader_block_missing")
    if (characters + block.text.length > maximumWindowCharacters) {
      break
    }
    characters += block.text.length
    blocks.push(block)
  }
  const end = start + blocks.length
  return legalTextWindowSchema.parse({
    versionId: projection.versionId,
    readerContract: projection.readerContract,
    bodyHash: projection.bodyHash,
    blockGeneration: projection.blockGeneration,
    format: "plain_text",
    blocks,
    totalBlocks: projection.blocks.length,
    startBlock: start,
    nextCursor: end < projection.blocks.length ? encode(end) : null,
    isStart: start === 0,
    isEnd: end === projection.blocks.length,
    availability: projection.blocks.length === 0 ? "empty" : "available",
    textTruncated: false
  })
}
