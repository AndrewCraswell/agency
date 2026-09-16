import type { EmbeddingTokenizer } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { buildLegalTextProjection, storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalPassagePreparationBlocker } from "./passage-failure.js"
import { buildLegalPassages } from "./passages.js"

const identity = { model: z.string().min(1), tokenizerId: z.string().min(1), contextHash: z.string() }
export const legalPreparationInspectionSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...identity, status: z.literal("blocked"), reason: z.string().regex(/^[a-z_]+$/) }),
  z.strictObject({
    ...identity,
    status: z.literal("prepared"),
    eligibility: z.enum(["eligible", "empty_text"]),
    generation: z.string(),
    manifestHash: z.string(),
    passages: z.int().nonnegative(),
    tokens: z.int().nonnegative(),
    maximumTokens: z.int().nonnegative(),
    maximumInputCharacters: z.int().nonnegative(),
    continuations: z.int().nonnegative()
  })
])

/** Offline canonical preparation evidence. No provider calls, storage writes or readiness promotion. */
export function inspectLegalPassagePreparation(input: {
  versionId: string
  body: string
  blocks: unknown
  inputContract: string
  context: string
  model: string
  tokenizer: EmbeddingTokenizer
}) {
  const context = z.string().max(16000).parse(input.context).trim()
  const identity = { model: input.model, tokenizerId: input.tokenizer.id, contextHash: digest(context) }
  let blocks: ReturnType<typeof storedLegalSourceBlocks>
  try {
    blocks = storedLegalSourceBlocks(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return legalPreparationInspectionSchema.parse({ ...identity, status: "blocked", reason: "invalid_source_blocks" })
    }
    throw error
  }
  let prepared: ReturnType<typeof buildLegalPassages>
  try {
    const projection = buildLegalTextProjection({ ...input, blocks })
    prepared = buildLegalPassages({ projection, sourceBlocks: blocks, context, tokenizer: input.tokenizer })
  } catch (error) {
    const reason = legalPassagePreparationBlocker(error)
    // Known source-shape/budget failures are dispositions. Unknown and tokenizer failures stop the scan.
    if (reason !== null) {
      return legalPreparationInspectionSchema.parse({ ...identity, status: "blocked", reason })
    }
    throw error
  }
  invariant(prepared.passages.map((p) => p.text).join("") === input.body, "preparation_inspection_reconstruction")
  let tokens = 0
  let maximumTokens = 0
  let maximumInputCharacters = 0
  for (const passage of prepared.passages) {
    const count = z.int().nonnegative().parse(input.tokenizer.count(passage.inputText))
    invariant(count === passage.tokenCount && count <= 1200, "preparation_inspection_token_recount")
    invariant(passage.inputText.length <= 16000, "preparation_inspection_character_limit")
    invariant(digest(passage.inputText) === passage.inputHash, "preparation_inspection_input_hash")
    tokens += count
    maximumTokens = Math.max(maximumTokens, count)
    maximumInputCharacters = Math.max(maximumInputCharacters, passage.inputText.length)
  }
  return legalPreparationInspectionSchema.parse({
    ...identity,
    status: "prepared",
    eligibility: prepared.eligibility,
    generation: prepared.generation,
    manifestHash: digest(JSON.stringify(prepared.passages)),
    passages: prepared.passages.length,
    tokens,
    maximumTokens,
    maximumInputCharacters,
    continuations: prepared.passages.filter((p) => p.rowContinuation !== null).length
  })
}
