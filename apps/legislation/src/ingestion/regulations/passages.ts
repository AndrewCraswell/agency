import invariant from "tiny-invariant"
import { z } from "zod"
import { splitEmbeddingText } from "../../models/embedding-preparation.js"
import { MAX_EMBEDDING_INPUT_CHARACTERS } from "../../models/openrouter-embeddings.js"
import { digest } from "./contracts.js"
import { regulatoryRecordSchema } from "./parser-contract.js"
import { legalTextBlockSchema } from "./reader-contract.js"
import { legalReaderContract, type LegalTextProjection } from "./reader-text.js"
import { legalTableLayout, legalTableRowCells, legalTableRows } from "./table-passages.js"

export const legalPassageContract = "legal-passage-context-text"

type PassageTokenizer = { id: string; count: (text: string) => number }

/** Token counts must come from the caller's versioned tokenizer, never a character estimate. */
export function buildLegalPassages(input: {
  projection: LegalTextProjection
  context: string
  tokenizer: PassageTokenizer
  targetTokens?: number
  maximumTokens?: number
  sourceBlocks?: unknown
}) {
  const { projection, tokenizer } = input
  const target = z
    .int()
    .min(1)
    .max(1200)
    .parse(input.targetTokens ?? 800)
  const maximum = z
    .int()
    .min(target)
    .max(1200)
    .parse(input.maximumTokens ?? 1200)
  z.string().min(1).max(256).parse(tokenizer.id)
  z.string().min(1).max(256).parse(projection.versionId)
  invariant(projection.readerContract === legalReaderContract, "passage_reader_contract_mismatch")
  const blocks = z.array(legalTextBlockSchema).parse(projection.blocks)
  const sourceBlocks = regulatoryRecordSchema.shape.blocks.parse(input.sourceBlocks ?? [])
  const body = blocks.map((block) => block.text).join("")
  invariant(Buffer.byteLength(body) <= 64 * 1024 * 1024, "passage_body_limit")
  invariant(digest(body) === projection.bodyHash, "passage_body_hash_mismatch")
  invariant(
    digest(
      JSON.stringify([
        legalReaderContract,
        projection.versionId,
        projection.bodyHash,
        blocks.map(({ text: _text, ...block }) => block)
      ])
    ) === projection.blockGeneration,
    "passage_reader_generation_mismatch"
  )
  let position = 0
  for (const block of blocks) {
    invariant(block.start === position, "passage_reader_gap")
    position = block.end
  }
  const context = z.string().max(16_384).parse(input.context).trim()
  const prefix = context ? `${context}\n\n` : ""
  const count = (text: string) => z.int().nonnegative().parse(tokenizer.count(text))
  invariant(count(prefix) < target, "passage_context_exhausts_budget")
  const generation = digest(
    JSON.stringify([
      legalPassageContract,
      projection.versionId,
      projection.bodyHash,
      projection.blockGeneration,
      prefix,
      tokenizer.id,
      target,
      maximum,
      sourceBlocks.map((block) => [block.ordinal, digest(block.xml), digest(block.text)])
    ])
  )
  const passages: {
    id: string
    versionId: string
    ordinal: number
    start: number
    end: number
    text: string
    inputText: string
    tokenCount: number
    readerSpans: { blockId: string; start: number; end: number }[]
    contextSpans: { blockId: string; start: number; end: number }[]
    inputHash: string
    rowContinuation: { start: number; end: number; longColumn: number } | null
  }[] = []
  let readerIndex = 0
  const emit = (
    start: number,
    end: number,
    header?: { start: number; end: number },
    continuation?: {
      context: string
      spans: { start: number; end: number }[]
      row?: { start: number; end: number; longColumn: number }
    }
  ) => {
    const text = body.slice(start, end)
    const inputText =
      prefix + (header ? body.slice(header.start, header.end) : "") + (continuation?.context ?? "") + text
    const tokenCount = count(inputText)
    invariant(tokenCount <= maximum, "passage_token_limit")
    invariant(inputText.length <= MAX_EMBEDDING_INPUT_CHARACTERS, "passage_character_limit")
    const readerSpans: { blockId: string; start: number; end: number }[] = []
    while (blocks[readerIndex] && (blocks[readerIndex]?.end ?? 0) <= start) {
      readerIndex++
    }
    for (let index = readerIndex; index < blocks.length; index++) {
      const block = blocks[index]
      invariant(block, "passage_block_missing")
      if (block.start >= end) {
        break
      }
      readerSpans.push({ blockId: block.id, start: Math.max(start, block.start), end: Math.min(end, block.end) })
    }
    passages.push({
      id: digest(JSON.stringify([generation, start, end])),
      versionId: projection.versionId,
      ordinal: passages.length,
      start,
      end,
      text,
      inputText,
      tokenCount,
      readerSpans,
      contextSpans: [...(header ? [header] : []), ...(continuation?.spans ?? [])].flatMap((span) =>
        blocks
          .filter((block) => block.start < span.end && block.end > span.start)
          .map((block) => ({
            blockId: block.id,
            start: Math.max(span.start, block.start),
            end: Math.min(span.end, block.end)
          }))
      ),
      inputHash: digest(inputText),
      rowContinuation: continuation?.row ?? null
    })
  }
  const splitText = (start: number, end: number) => {
    const prepared = splitEmbeddingText({ text: body.slice(start, end), prefix, tokenizer, targetTokens: target })
    for (const passage of prepared.passages) {
      emit(start + passage.start, start + passage.end)
    }
  }
  if (body.trim().length > 0) {
    let start = 0
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index]
      invariant(block, "passage_block_missing")
      if (block.kind !== "table") {
        continue
      }
      splitText(start, block.start)
      let end = block.end
      // Reader windows may split a table; recombine its source ordinal before checking the budget.
      while (blocks[index + 1]?.kind === "table" && blocks[index + 1]?.sourceOrdinal === block.sourceOrdinal) {
        index++
        const continuation = blocks[index]
        invariant(continuation, "passage_table_continuation_missing")
        end = continuation.end
      }
      if (
        count(prefix + body.slice(block.start, end)) <= maximum &&
        prefix.length + end - block.start <= MAX_EMBEDDING_INPUT_CHARACTERS
      ) {
        emit(block.start, end)
      } else {
        const source = sourceBlocks.find((source) => source.ordinal === block.sourceOrdinal)
        invariant(
          source && source.kind === "table" && source.text === body.slice(block.start, end),
          "passage_table_source_required"
        )
        let tablePosition = block.start
        for (const table of legalTableLayout(source)) {
          const tableStart = block.start + table.start
          const tableEnd = block.start + table.end
          splitText(tablePosition, tableStart)
          tablePosition = tableEnd
          if (
            prefix.length + table.text.length <= MAX_EMBEDDING_INPUT_CHARACTERS &&
            count(prefix + table.text) <= maximum
          ) {
            emit(tableStart, tableEnd)
            continue
          }
          const layout = legalTableRows(table)
          const header = { start: tableStart, end: tableStart + layout.header.end }
          const headerText = body.slice(header.start, header.end)
          let groupStart = tableStart
          let rowIndex = 0
          while (rowIndex < layout.rows.length) {
            const row = layout.rows[rowIndex]
            invariant(row, "passage_table_row_missing")
            let groupEnd = tableStart + row.end
            const rowContext = row.context.map((span) => ({
              ...span,
              start: tableStart + span.start,
              end: tableStart + span.end
            }))
            const rowContextText = rowContext
              .map((span) => `${span.label}: ${body.slice(span.start, span.end)}\n`)
              .join("")
            const groupPrefix = prefix + (groupStart === tableStart ? "" : headerText) + rowContextText
            const single = groupPrefix + body.slice(groupStart, groupEnd)
            const singleCount = count(single)
            if (singleCount > maximum || single.length > MAX_EMBEDDING_INPUT_CHARACTERS) {
              const evidence = legalTableRowCells(table, row.start)
              const cells = evidence.cells.map((cell) => ({
                ...cell,
                start: tableStart + cell.start,
                end: tableStart + cell.end
              }))
              const largest = cells.reduce((largest, cell) =>
                count(body.slice(cell.start, cell.end)) > count(body.slice(largest.start, largest.end)) ? cell : largest
              )
              const identifying = cells.filter((cell) => cell !== largest)
              const spans = [
                ...(evidence.group
                  ? [{ start: tableStart + evidence.group.start, end: tableStart + evidence.group.end }]
                  : []),
                ...identifying.filter((cell) => cell.end > cell.start)
              ]
              const continuationContext =
                rowContextText +
                (evidence.group
                  ? `Row group: ${body.slice(tableStart + evidence.group.start, tableStart + evidence.group.end)}\n`
                  : "") +
                identifying.map((cell) => `Column ${cell.column}: ${body.slice(cell.start, cell.end)}\n`).join("") +
                `Row continuation; long column ${largest.column}.\n`
              const fullPrefix = prefix + headerText + continuationContext
              invariant(
                fullPrefix.length < MAX_EMBEDDING_INPUT_CHARACTERS && count(fullPrefix) < target,
                "passage_table_continuation_context_exhausts_budget"
              )
              if (groupStart === tableStart && groupStart < tableStart + row.start) {
                emit(groupStart, tableStart + row.start)
                groupStart = tableStart + row.start
              }
              const pieces = splitEmbeddingText({
                text: body.slice(groupStart, groupEnd),
                prefix: fullPrefix,
                tokenizer,
                targetTokens: target
              })
              for (const piece of pieces.passages) {
                emit(
                  groupStart + piece.start,
                  groupStart + piece.end,
                  header.start === header.end ? undefined : header,
                  {
                    context: continuationContext,
                    spans: [...rowContext, ...spans],
                    row: { start: tableStart + row.start, end: groupEnd, longColumn: largest.column }
                  }
                )
              }
              groupStart = groupEnd
              rowIndex++
              continue
            }
            let packed = 1
            // Exponential probes avoid repeatedly tokenizing every growing row prefix in a large table.
            while (singleCount <= target && rowIndex + packed < layout.rows.length) {
              const size = Math.min(packed * 2, layout.rows.length - rowIndex)
              const last = layout.rows[rowIndex + size - 1]
              invariant(last, "passage_table_row_missing")
              if (
                layout.rows
                  .slice(rowIndex, rowIndex + size)
                  .some((candidate) => JSON.stringify(candidate.context) !== JSON.stringify(row.context))
              ) {
                break
              }
              const candidateEnd = tableStart + last.end
              const candidate = groupPrefix + body.slice(groupStart, candidateEnd)
              if (candidate.length > MAX_EMBEDDING_INPUT_CHARACTERS || count(candidate) > target) {
                break
              }
              packed = size
              groupEnd = candidateEnd
            }
            emit(
              groupStart,
              groupEnd,
              groupStart === tableStart || header.start === header.end ? undefined : header,
              rowContext.length ? { context: rowContextText, spans: rowContext } : undefined
            )
            groupStart = groupEnd
            rowIndex += packed
          }
        }
        splitText(tablePosition, end)
      }
      start = end
    }
    splitText(start, body.length)
  }
  return {
    contract: legalPassageContract,
    generation,
    versionId: projection.versionId,
    bodyHash: projection.bodyHash,
    tokenizerId: tokenizer.id,
    eligibility: body.trim().length === 0 ? ("empty_text" as const) : ("eligible" as const),
    passages
  }
}
